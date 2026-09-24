"""
backend/main.py — RxTriage AI FastAPI server.
Audio + dashboard WebSockets, the voice-agent turn API, clinical endpoints (DUR, PDMP, SOAP, FHIR),
and the operations router (backend/ops_routes.py). All routes pass through SecurityMiddleware
(token auth, RBAC, HIPAA access log).
"""

import asyncio
import base64
import json
import logging
import secrets
import time
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, File, Form, HTTPException, Query, Request, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from backend import clinical_kb as kb
from backend.agent_engine import AgentState, EscalationReason, PharmaAgentEngine
from backend.assemblyai_service import (
    connect_assemblyai_realtime,
    generate_soap_note_llm,
    run_lemur_clinical_audit,
    transcribe_audio_bytes,
)
from backend.config import (
    ACTIVE_STATION,
    AUTH_TOKENS,
    CARTESIA_API_KEY,
    CARTESIA_VOICE_ID,
    CORS_ORIGINS,
    FDA_WORD_BOOST,
    HOST,
    LLM_MODEL,
    PORT,
)
from backend.database import (
    add_consultation,
    apply_billing_payment,
    get_all_patients,
    get_billing_account,
    get_call_sessions,
    get_consultations,
    get_db_connection,
    get_dispense_orders,
    get_patient,
    get_patient_clinical_profile,
    get_pharmacy_info,
    get_prescriptions_for_patient,
    init_db,
    reset_db,
    using_postgres,
)
from backend.ops_routes import Snapshot, fetch_many, patient_adherence, patient_dur, router as ops_router
from backend.security import AUTH_ENABLED, SecurityMiddleware, mask_patient, masks_phi
from backend.sms_service import get_outbox, send_pickup_confirmation_sms, _send_sms
from backend.tts_service import AVAILABLE_VOICES, stream_cartesia_tts, synthesize_cartesia_base64
from evals.benchmark_eval import run_benchmark

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("main")

SESSION_TTL_SEC = 30 * 60


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    task = asyncio.create_task(_session_reaper())
    yield
    task.cancel()


app = FastAPI(title="RxTriage AI Engine", version="3.0.0", lifespan=lifespan)
app.add_middleware(SecurityMiddleware)
# CORS is added last so it is the outermost layer and 401/403 responses still carry CORS headers.
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-API-Key"],
)
app.include_router(ops_router)

dashboard_clients: set = set()
ACTIVE_SESSIONS: Dict[str, Dict[str, Any]] = {}


async def _session_reaper():
    """Evicts idle simulator sessions so memory (and PHI held in transcripts) doesn't accumulate."""
    while True:
        await asyncio.sleep(60)
        cutoff = time.time() - SESSION_TTL_SEC
        for sid in [s for s, ctx in ACTIVE_SESSIONS.items() if ctx["last_seen"] < cutoff]:
            ACTIVE_SESSIONS.pop(sid, None)


async def broadcast_to_dashboard(event_type: str, data: dict):
    message = json.dumps({"event": event_type, "type": event_type, "data": data}, default=str)
    for client in list(dashboard_clients):
        try:
            await client.send_text(message)
        except Exception:
            dashboard_clients.discard(client)


def record_turn_metric(session_id: str, state: str, intent: Optional[str], language: str,
                       stt_ms: Optional[int], engine_ms: Optional[int], tts_ms: Optional[int]):
    with get_db_connection() as conn:
        conn.execute("INSERT INTO call_metrics (session_id, state, intent, language, stt_ms, engine_ms, tts_ms) VALUES (?, ?, ?, ?, ?, ?, ?)",
                     (session_id, state, intent, language, stt_ms, engine_ms, tts_ms))
        conn.commit()


def close_session(session_id: str, audit: Optional[dict] = None):
    with get_db_connection() as conn:
        conn.execute("""UPDATE call_sessions SET ended_at = COALESCE(ended_at, CURRENT_TIMESTAMP),
                        lemur_audit_json = COALESCE(?, lemur_audit_json) WHERE session_id = ?""",
                     (json.dumps(audit) if audit else None, session_id))
        conn.commit()


def dashboard_summary() -> Dict[str, Any]:
    total_calls, completed, contained, dea_blocks, adverse, queued, vol = (r[0][0] for r in fetch_many([
        "SELECT COUNT(*) FROM call_sessions",
        "SELECT COUNT(*) FROM call_sessions WHERE call_status IN ('COMPLETED', 'DISPENSED')",
        "SELECT COUNT(*) FROM call_sessions WHERE call_status = 'COMPLETED' AND escalation_reason IS NULL",
        "SELECT COUNT(*) FROM dispense_orders WHERE status = 'BLOCKED_DEA_REVIEW'",
        "SELECT COUNT(*) FROM call_sessions WHERE escalation_reason = 'EMERGENCY_ADVERSE_REACTION'",
        "SELECT COUNT(*) FROM dispense_orders WHERE status = 'QUEUED_FOR_FILL'",
        "SELECT COALESCE(SUM(copay_charged), 0) FROM dispense_orders WHERE status IN ('QUEUED_FOR_FILL', 'DISPENSED')",
    ]))
    snap = Snapshot()
    pdcs = [patient_adherence(pid, snap)["average_pdc"] for pid in snap.patients]
    return {
        "total_calls": total_calls,
        "completed_calls": completed,
        "dea_blocks": dea_blocks,
        "adverse_events": adverse,
        "queued_orders": queued,
        "total_copay_volume": round(float(vol), 2),
        "ai_containment_rate": f"{contained / total_calls:.1%}" if total_calls else "n/a",
        "average_pdc": f"{sum(pdcs) / len(pdcs):.1%}" if pdcs else "n/a",
        # Legacy keys kept for older dashboard builds; now computed, not hardcoded.
        "med_sync_retention_rate": f"{sum(pdcs) / len(pdcs):.1%}" if pdcs else "n/a",
        "rts_reduction": f"{contained / total_calls:.1%}" if total_calls else "n/a",
    }


def _patients_for_role(role: str) -> List[Dict[str, Any]]:
    pts = get_all_patients()
    return [mask_patient(p) for p in pts] if masks_phi(role) else pts


def build_dashboard_snapshot(role: str) -> Dict[str, Any]:
    all_patients = _patients_for_role(role)
    first_id = all_patients[0]["patient_id"] if all_patients else None
    return {
        "summary": dashboard_summary(),
        "patients": all_patients,
        "patient": all_patients[0] if all_patients else None,
        "prescriptions": get_prescriptions_for_patient(first_id) if first_id else [],
        "orders": get_dispense_orders(limit=25),
        "sessions": get_call_sessions(limit=15),
        "consultations": get_consultations(),
        "billing": get_billing_account(first_id) if first_id else None,
        "pharmacy_info": get_pharmacy_info(),
        "role": role,
    }


# -------------------------------------------------------------
# WebSockets
# -------------------------------------------------------------
@app.websocket("/ws/dashboard")
async def dashboard_websocket(websocket: WebSocket):
    await websocket.accept()
    dashboard_clients.add(websocket)
    role = websocket.scope.get("state", {}).get("role", "admin")
    try:
        snapshot = await asyncio.to_thread(build_dashboard_snapshot, role)
        await websocket.send_text(json.dumps({"type": "INITIAL_SNAPSHOT", "event": "INITIAL_SNAPSHOT", "data": snapshot}, default=str))
        while True:
            if await websocket.receive_text() == "ping":
                await websocket.send_text(json.dumps({"type": "PONG"}))
    except WebSocketDisconnect:
        dashboard_clients.discard(websocket)
    except Exception:
        logger.exception("dashboard websocket error")
        dashboard_clients.discard(websocket)


@app.websocket("/ws/call/{session_id}")
async def handle_call_stream(websocket: WebSocket, session_id: str):
    """Bi-directional telephony audio: PCM16 in -> AssemblyAI streaming STT -> engine -> Cartesia TTS out."""
    await websocket.accept()
    caller_phone = websocket.query_params.get("caller_phone", "")
    engine = await asyncio.to_thread(PharmaAgentEngine, session_id, caller_phone)
    inbound: asyncio.Queue = asyncio.Queue()
    outbound: asyncio.Queue = asyncio.Queue()
    interruption = asyncio.Event()
    log: List[str] = []

    first = await asyncio.to_thread(engine.process_utterance, "START")
    log.append(f"Agent: {first['spoken_text']}")
    await broadcast_to_dashboard("CALL_STARTED", {"session_id": session_id, "caller_phone": caller_phone,
                                                  "ani_matched": engine.ani_matched})
    asyncio.create_task(stream_cartesia_tts(first["spoken_text"], outbound, interruption, language=engine.language))

    async def on_transcript(text: str, is_final: bool):
        nonlocal interruption
        interruption.set()  # barge-in: stop current TTS
        await broadcast_to_dashboard("TRANSCRIPT_UPDATE", {"text": text, "is_final": is_final, "session_id": session_id})
        if not is_final:
            return
        log.append(f"Caller: {text}")
        interruption = asyncio.Event()
        t0 = time.perf_counter()
        result = await asyncio.to_thread(engine.process_utterance, text)
        engine_ms = int((time.perf_counter() - t0) * 1000)
        log.append(f"Agent: {result['spoken_text']}")
        await asyncio.to_thread(record_turn_metric, session_id, str(engine.state.value), result.get("intent"), engine.language, None, engine_ms, None)
        await broadcast_to_dashboard("STATE_TRANSITION", {
            "session_id": session_id, "state": result["current_state"], "is_escalation": result["is_escalation"],
            "escalation_reason": result.get("escalation_reason"), "agent_speech": result["spoken_text"],
            "patient": result.get("patient"), "language": engine.language})
        if result["is_escalation"]:
            await broadcast_to_dashboard("WARM_TRANSFER_CONTEXT", await asyncio.to_thread(build_handoff_packet, engine, log))
        asyncio.create_task(stream_cartesia_tts(result["spoken_text"], outbound, interruption, language=engine.language))

    aai_task = asyncio.create_task(connect_assemblyai_realtime(inbound, on_transcript))

    async def send_worker():
        try:
            while (chunk := await outbound.get()) is not None:
                await websocket.send_bytes(chunk)
        except Exception:
            pass

    async def recv_worker():
        try:
            while True:
                msg = await websocket.receive()
                if msg.get("type") == "websocket.disconnect":
                    break
                if msg.get("bytes"):
                    await inbound.put(msg["bytes"])
                elif msg.get("text"):
                    try:
                        if json.loads(msg["text"]).get("type") == "HANGUP":
                            break
                    except ValueError:
                        pass
        except Exception:
            pass
        finally:
            await inbound.put(None)
            await outbound.put(None)

    send_task = asyncio.create_task(send_worker())
    await recv_worker()
    send_task.cancel()
    aai_task.cancel()

    transcript = "\n".join(log)
    rx = await asyncio.to_thread(get_prescriptions_for_patient, engine.patient_id) if engine.patient_id and engine.is_authenticated else []
    audit = await asyncio.to_thread(run_lemur_clinical_audit, transcript, engine.patient if engine.is_authenticated else None, rx)
    with get_db_connection() as conn:
        conn.execute("UPDATE call_sessions SET call_status = CASE WHEN call_status = 'IN_PROGRESS' THEN 'ABANDONED' ELSE call_status END WHERE session_id = ?",
                     (session_id,))
        conn.commit()
    await asyncio.to_thread(close_session, session_id, audit)
    await broadcast_to_dashboard("LEMUR_AUDIT_COMPLETED", {"session_id": session_id, "audit": audit})


def build_handoff_packet(engine: PharmaAgentEngine, transcript_log: List[str]) -> Dict[str, Any]:
    """Screen-pop context for the pharmacist taking a warm transfer."""
    packet: Dict[str, Any] = {
        "session_id": engine.session_id,
        "caller_phone": engine.caller_phone,
        "escalation_reason": engine.escalation_reason,
        "verified": engine.is_authenticated,
        "auth_method": engine.auth_method,
        "language": engine.language,
        "transcript": transcript_log[-20:],
        "requested_medication": engine.requested_medication,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    if engine.is_authenticated and engine.patient_id:
        prof = get_patient_clinical_profile(engine.patient_id)
        snap = Snapshot([engine.patient_id])
        dur = patient_dur(engine.patient_id, snap)
        packet.update({
            "patient": engine.patient,
            "active_prescriptions": get_prescriptions_for_patient(engine.patient_id),
            "allergies": prof["allergies"],
            "conditions": prof["conditions"],
            "dur_top_alerts": dur["alerts"][:3],
            "adherence": {k: v for k, v in patient_adherence(engine.patient_id, snap).items() if k in ("risk_score", "risk_band", "average_pdc")},
        })
    return packet


# -------------------------------------------------------------
# Core REST
# -------------------------------------------------------------
@app.get("/health")
def get_health():
    return {
        "status": "ONLINE",
        "app": "RxTriage AI Engine (FastAPI WebSockets + AssemblyAI STT + Cartesia TTS)",
        "version": "3.0.0",
        "station": ACTIVE_STATION,
        "auth_enabled": AUTH_ENABLED,
        "database": "supabase-postgres" if using_postgres() else "sqlite",
        "llm_model": LLM_MODEL,
    }


@app.get("/api/dashboard")
def get_dashboard():
    return dashboard_summary()


@app.get("/api/patients")
def list_patients(request: Request):
    return _patients_for_role(request.scope.get("state", {}).get("role", "admin"))


@app.get("/api/patient/{patient_id}")
def patient_profile(patient_id: str, request: Request):
    p = get_patient(patient_id)
    if not p:
        raise HTTPException(404, "Patient not found")
    role = request.scope.get("state", {}).get("role", "admin")
    return {
        "patient": mask_patient(p) if masks_phi(role) else p,
        "prescriptions": get_prescriptions_for_patient(patient_id),
        "billing": get_billing_account(patient_id),
        "consultations": get_consultations(patient_id),
        "clinical": get_patient_clinical_profile(patient_id),
        "adherence": patient_adherence(patient_id),
    }


@app.get("/api/prescriptions")
def prescriptions(patient_id: str = Query(...)):
    return get_prescriptions_for_patient(patient_id)


@app.get("/api/orders")
def orders():
    return get_dispense_orders(limit=25)


@app.post("/api/orders/dispense-all")
async def dispense_all():
    dispensed = await asyncio.to_thread(_dispense_all_sync)
    await broadcast_to_dashboard("DISPENSE_QUEUE_UPDATED", {})
    return {"status": "SUCCESS", "dispensed": dispensed}


def _dispense_all_sync() -> int:
    with get_db_connection() as conn:
        rows = conn.execute("SELECT rx_number, patient_id FROM dispense_orders WHERE status = 'QUEUED_FOR_FILL'").fetchall()
        for rx, pid in rows:
            ds = conn.execute("SELECT days_supply FROM prescriptions WHERE rx_number = ?", (rx,)).fetchone()[0]
            conn.execute("INSERT INTO fill_history (rx_number, patient_id, fill_date, days_supply) VALUES (?, ?, date('now'), ?)", (rx, pid, ds))
            conn.execute("""UPDATE prescriptions SET refills_remaining = CASE WHEN refills_remaining > 0 THEN refills_remaining - 1 ELSE 0 END, last_fill_date = date('now'),
                            next_refill_due_date = date('now', '+' || days_supply || ' days') WHERE rx_number = ?""", (rx,))
        conn.execute("UPDATE dispense_orders SET status = 'DISPENSED' WHERE status = 'QUEUED_FOR_FILL'")
        conn.commit()
    return len(rows)


@app.get("/api/consultations")
def consultations(patient_id: Optional[str] = Query(default=None)):
    return get_consultations(patient_id)


class AddConsultationReq(BaseModel):
    patient_id: str
    scheduled_time: str
    reason: str
    pharmacist_name: Optional[str] = "Dr. Marcus Vance, PharmD"


@app.post("/api/consultations")
async def schedule_consultation_endpoint(req: AddConsultationReq):
    if not await asyncio.to_thread(get_patient, req.patient_id):
        raise HTTPException(404, "Patient not found")
    c = await asyncio.to_thread(add_consultation, req.patient_id, req.scheduled_time, req.reason, req.pharmacist_name)
    await broadcast_to_dashboard("CONSULTATION_SCHEDULED", c)
    return c


@app.get("/api/billing/{patient_id}")
def billing_endpoint(patient_id: str):
    b = get_billing_account(patient_id)
    if not b:
        raise HTTPException(404, "Billing account not found")
    return b


class ApplyPaymentReq(BaseModel):
    amount: float


@app.post("/api/billing/{patient_id}/pay")
async def pay_billing_endpoint(patient_id: str, req: ApplyPaymentReq):
    if req.amount <= 0:
        raise HTTPException(400, "Amount must be positive")
    res = await asyncio.to_thread(apply_billing_payment, patient_id, req.amount)
    await broadcast_to_dashboard("BILLING_PAYMENT_PROCESSED", {"patient_id": patient_id, "res": res})
    return res


@app.get("/api/pharmacy-info")
def pharmacy_info_endpoint():
    return get_pharmacy_info()


@app.get("/api/sessions")
def sessions():
    return get_call_sessions(limit=15)


@app.get("/api/eval/benchmark")
def benchmark():
    return run_benchmark()


@app.get("/api/handoff/{session_id}")
def handoff(session_id: str):
    ctx = ACTIVE_SESSIONS.get(session_id)
    if not ctx:
        raise HTTPException(404, "No active session")
    return build_handoff_packet(ctx["engine"], ctx["transcript_log"])


@app.get("/api/export/fhir/{patient_id}")
def export_fhir(patient_id: str):
    """FHIR R4 Bundle: Patient, MedicationRequest, AllergyIntolerance, Condition."""
    p = get_patient(patient_id)
    if not p:
        raise HTTPException(404, "Patient not found")
    base = "urn:rxtriage"
    subject = {"reference": f"Patient/{p['patient_id']}"}
    entries = [{"fullUrl": f"{base}:Patient/{p['patient_id']}", "resource": {
        "resourceType": "Patient", "id": p["patient_id"],
        "identifier": [{"system": f"{base}:mrn", "value": p["patient_id"]}],
        "name": [{"family": p["last_name"], "given": [p["first_name"]]}],
        "birthDate": p["dob"],
        "telecom": [{"system": "phone", "value": p["primary_phone"], "use": "mobile"}],
        "address": [{"text": p["street_address"]}] if p.get("street_address") else []}}]
    for rx in get_prescriptions_for_patient(patient_id):
        ing = kb.ingredient_of(rx["drug_name"])
        coding = [{"system": "http://www.nlm.nih.gov/research/umls/rxnorm", "code": kb.DRUGS[ing]["rxnorm"], "display": ing}] if ing else []
        entries.append({"fullUrl": f"{base}:MedicationRequest/{rx['rx_number']}", "resource": {
            "resourceType": "MedicationRequest", "id": rx["rx_number"],
            "status": "on-hold" if rx["adjudication_status"] != "APPROVED" else "active",
            "intent": "order", "subject": subject,
            "medicationCodeableConcept": {"coding": coding, "text": f"{rx['drug_name']} {rx['strength']} {rx['dosage_form']}"},
            "dosageInstruction": [{"text": f"{rx['strength']} {rx['dosage_form']}"}],
            "dispenseRequest": {"numberOfRepeatsAllowed": rx["refills_remaining"],
                                "expectedSupplyDuration": {"value": rx["days_supply"], "unit": "days",
                                                           "system": "http://unitsofmeasure.org", "code": "d"}}}})
    prof = get_patient_clinical_profile(patient_id)
    for i, a in enumerate(prof["allergies"]):
        entries.append({"fullUrl": f"{base}:AllergyIntolerance/{patient_id}-{i}", "resource": {
            "resourceType": "AllergyIntolerance", "id": f"{patient_id}-alg-{i}", "patient": subject,
            "clinicalStatus": {"coding": [{"system": "http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical", "code": "active"}]},
            "code": {"text": a["allergen"]},
            "reaction": [{"manifestation": [{"text": a["reaction"] or "unspecified"}]}]}})
    for c in prof["conditions"]:
        entries.append({"fullUrl": f"{base}:Condition/{patient_id}-{c['condition_code']}", "resource": {
            "resourceType": "Condition", "id": f"{patient_id}-{c['condition_code'].replace('.', '')}", "subject": subject,
            "clinicalStatus": {"coding": [{"system": "http://terminology.hl7.org/CodeSystem/condition-clinical", "code": "active"}]},
            "code": {"coding": [{"system": "http://hl7.org/fhir/sid/icd-10-cm", "code": c["condition_code"], "display": c["condition_name"]}]}}})
    return {"resourceType": "Bundle", "type": "collection", "timestamp": datetime.now(timezone.utc).isoformat(), "entry": entries}


# -------------------------------------------------------------
# TTS / STT
# -------------------------------------------------------------
@app.get("/api/tts/voices")
def get_tts_voices():
    return {"active_voice_id": CARTESIA_VOICE_ID, "is_cartesia_active": bool(CARTESIA_API_KEY and len(CARTESIA_API_KEY.strip()) > 5),
            "engine": "Cartesia Sonic-2", "languages": ["en", "es"], "voices": list(AVAILABLE_VOICES.values())}


class TtsSynthesizeReq(BaseModel):
    text: str
    voice_id: Optional[str] = None
    speed: float = 0.92
    language: str = "en"


@app.post("/api/tts/synthesize")
async def tts_synthesize(req: TtsSynthesizeReq):
    voice = req.voice_id or CARTESIA_VOICE_ID
    t0 = time.perf_counter()
    audio_b64 = await synthesize_cartesia_base64(req.text, voice_id=voice, speed=req.speed, language=req.language)
    return {"audio_base64": audio_b64, "is_cartesia": bool(audio_b64), "tts_ms": int((time.perf_counter() - t0) * 1000),
            "engine": "Cartesia Sonic-2" if audio_b64 else "Browser Fallback", "voice_id": voice,
            "voice_name": AVAILABLE_VOICES.get(voice, {}).get("name", "Cartesia Voice")}


class TranscribeBase64Req(BaseModel):
    audio_base64: str
    file_ext: str = "webm"


def _decode_b64_audio(raw: str) -> bytes:
    if "base64," in raw:
        raw = raw.split("base64,", 1)[1]
    try:
        return base64.b64decode(raw)
    except Exception:
        raise HTTPException(400, "Invalid base64 audio")


@app.post("/api/voice/transcribe")
async def voice_transcribe(file: UploadFile = File(None), body: TranscribeBase64Req = None):
    audio, ext = None, "webm"
    if file:
        audio = await file.read()
        ext = file.filename.rsplit(".", 1)[-1] if file.filename and "." in file.filename else "webm"
    elif body and body.audio_base64:
        audio, ext = _decode_b64_audio(body.audio_base64), body.file_ext or "webm"
    if not audio:
        raise HTTPException(400, "No audio data provided")
    return await asyncio.to_thread(transcribe_audio_bytes, audio, ext)


# -------------------------------------------------------------
# Voice agent turn API (browser simulator + soft-phone)
# -------------------------------------------------------------
class SimulateStepReq(BaseModel):
    session_id: str
    caller_phone: str = "+14155550192"
    utterance: str
    voice_id: Optional[str] = None


async def run_agent_turn(req: SimulateStepReq, stt_ms: Optional[int] = None) -> Dict[str, Any]:
    session_id = req.session_id
    voice = req.voice_id or CARTESIA_VOICE_ID
    voice_meta = AVAILABLE_VOICES.get(voice, {"name": "Cartesia Voice"})

    if session_id not in ACTIVE_SESSIONS:
        engine = await asyncio.to_thread(PharmaAgentEngine, session_id, req.caller_phone)
        ACTIVE_SESSIONS[session_id] = {"engine": engine, "transcript_log": [], "last_seen": time.time(), "audited": False}
        await broadcast_to_dashboard("CALL_STARTED", {"session_id": session_id, "caller_phone": req.caller_phone,
                                                      "ani_matched": engine.ani_matched})
    ctx = ACTIVE_SESSIONS[session_id]
    ctx["last_seen"] = time.time()
    engine: PharmaAgentEngine = ctx["engine"]

    tokens = []
    for w in req.utterance.split():
        clean = "".join(c for c in w if c.isalnum()).lower()
        tokens.append({"text": w, "is_word_boost_match": any(clean == b.lower() for b in FDA_WORD_BOOST)})

    if req.utterance and req.utterance.upper() != "START":
        ctx["transcript_log"].append(f"Caller: {req.utterance}")
        await broadcast_to_dashboard("TRANSCRIPT_UPDATE", {"session_id": session_id, "speaker": "CALLER",
                                                           "text": req.utterance, "tokens": tokens})

    t0 = time.perf_counter()
    res = await asyncio.to_thread(engine.process_utterance, req.utterance)
    engine_ms = int((time.perf_counter() - t0) * 1000)
    spoken = res.get("spoken_text", "")
    ctx["transcript_log"].append(f"Agent: {spoken}")

    t1 = time.perf_counter()
    audio_b64 = await synthesize_cartesia_base64(spoken, voice_id=voice, speed=0.92, language=engine.language) if spoken else None
    tts_ms = int((time.perf_counter() - t1) * 1000) if audio_b64 else None
    await asyncio.to_thread(record_turn_metric, session_id, engine.state.value, res.get("intent"), engine.language, stt_ms, engine_ms, tts_ms)

    reason = res.get("escalation_reason")
    if reason == EscalationReason.DEA_CONTROLLED_SUBSTANCE.value:
        await broadcast_to_dashboard("DEA_BLOCK_ALERT", {"session_id": session_id, "medication": engine.requested_medication,
                                                         "reason": "Title 21 CFR § 1306 hard block: controlled substance cannot be refilled by automated voice."})
    elif reason == EscalationReason.EMERGENCY_ADVERSE_REACTION.value:
        await broadcast_to_dashboard("EMERGENCY_ALERT", {"session_id": session_id, "patient": res.get("patient"),
                                                         "warning": "ACUTE ADVERSE EVENT: caller reported symptoms consistent with a severe reaction. Warm transfer initiated."})
    if res.get("is_escalation"):
        await broadcast_to_dashboard("WARM_TRANSFER_CONTEXT", await asyncio.to_thread(build_handoff_packet, engine, ctx["transcript_log"]))

    if res.get("trigger_sms") and engine.patient:
        meds = engine.requested_medication["drug_name"] if engine.requested_medication else "your prescription"
        if engine.synced_medications:
            meds += f" + {len(engine.synced_medications)} synchronized refills"
        await asyncio.to_thread(send_pickup_confirmation_sms, engine.patient["primary_phone"], engine.patient["first_name"], meds,
                                     engine.committed_pickup_slot or "Friday 3:00 PM - 6:00 PM", engine.total_copay)

    await broadcast_to_dashboard("AGENT_SPEAKING", {
        "session_id": session_id, "spoken_text": spoken, "current_state": res.get("current_state"),
        "is_escalation": res.get("is_escalation"), "escalation_reason": reason, "total_copay": engine.total_copay,
        "synced_medications": engine.synced_medications, "audio_base64": audio_b64, "language": engine.language,
        "tts_engine": "Cartesia Sonic-2 (Live)" if audio_b64 else "Browser Fallback",
        "voice_name": voice_meta.get("name"), "patient": res.get("patient")})

    audit = None
    terminal = engine.state in (AgentState.ESCALATE_HUMAN, AgentState.HOLD_AND_TRANSFER) or res.get("end_call")
    if terminal and not ctx["audited"]:
        ctx["audited"] = True
        rx = await asyncio.to_thread(get_prescriptions_for_patient, engine.patient_id) if engine.is_authenticated and engine.patient_id else []
        audit = await asyncio.to_thread(run_lemur_clinical_audit, "\n".join(ctx["transcript_log"]),
                                        engine.patient if engine.is_authenticated else None, rx)
        await asyncio.to_thread(close_session, session_id, audit)
        await broadcast_to_dashboard("LEMUR_AUDIT_COMPLETED", {"session_id": session_id, "audit": audit})

    return {
        "session_id": session_id, "spoken_text": spoken, "spoken_text_en": res.get("spoken_text_en"),
        "language": engine.language, "state": engine.state, "intent": res.get("intent"),
        "is_escalation": res.get("is_escalation"), "escalation_reason": reason, "is_hold": res.get("is_hold", False),
        "end_call": bool(res.get("end_call")), "tokens": tokens, "lemur_audit": audit, "audio_base64": audio_b64,
        "tts_engine": "Cartesia Sonic-2 (Live)" if audio_b64 else "Browser Fallback", "voice_id": voice,
        "voice_name": voice_meta.get("name"), "patient": res.get("patient"),
        "latency_ms": {"stt": stt_ms, "engine": engine_ms, "tts": tts_ms},
    }


@app.post("/api/call/simulate-step")
async def simulate_call_step(req: SimulateStepReq):
    return await run_agent_turn(req)


@app.post("/api/call/voice-step")
async def voice_step(
    audio_file: UploadFile = File(None),
    audio_base64: str = Form(None),
    file_ext: str = Form("webm"),
    session_id: str = Form(...),
    caller_phone: str = Form("+14155550192"),
    voice_id: str = Form(None),
):
    """Mic recording -> AssemblyAI STT -> agent engine -> Cartesia TTS, with measured per-stage latency."""
    raw, ext = None, file_ext or "webm"
    if audio_file:
        raw = await audio_file.read()
        if audio_file.filename and "." in audio_file.filename:
            ext = audio_file.filename.rsplit(".", 1)[-1]
    elif audio_base64:
        raw = _decode_b64_audio(audio_base64)
    if not raw:
        raise HTTPException(400, "No audio provided")

    stt = await asyncio.to_thread(transcribe_audio_bytes, raw, ext)
    text = (stt.get("text") or "").strip()
    if not text:
        # Don't feed silence into the FSM (it would restart the greeting or burn a retry)
        return {"session_id": session_id, "spoken_text": "", "caller_transcript": "", "no_speech": True,
                "stt_engine": stt.get("engine"), "stt_error": stt.get("error"), "latency_ms": {"stt": stt.get("stt_ms")}}
    out = await run_agent_turn(SimulateStepReq(session_id=session_id, caller_phone=caller_phone, utterance=text,
                                               voice_id=voice_id or CARTESIA_VOICE_ID), stt_ms=stt.get("stt_ms"))
    out.update({"caller_transcript": text, "stt_confidence": stt.get("confidence"), "stt_engine": stt.get("engine"),
                "stt_words": stt.get("words", []), "stt_language": stt.get("language_code")})
    return out


@app.post("/api/reset-demo")
async def reset_demo():
    await asyncio.to_thread(reset_db)
    ACTIVE_SESSIONS.clear()
    await broadcast_to_dashboard("DEMO_STATE_RESET", {})
    return {"status": "SUCCESS"}


# -------------------------------------------------------------
# Clinical intelligence (DDI/DUR, SOAP, PDMP, SMS)
# -------------------------------------------------------------
@app.get("/api/clinical/ddi-check/{patient_id}")
def clinical_ddi_check(patient_id: str):
    """Legacy shape used by the call-center panel; backed by the full DUR engine."""
    d = patient_dur(patient_id)
    return {
        "patient_id": patient_id,
        "patient_name": d["patient_name"],
        "total_active_medications": len(get_prescriptions_for_patient(patient_id)),
        "overall_interaction_risk": d["overall_risk"],
        "interactions": [{"drug_pair": a["drugs"], "severity": a["severity"], "category": a["category"],
                          "clinical_effect": a["clinical_effect"], "recommendation": a["recommendation"],
                          "evidence_level": d["source"], "alert_key": a["alert_key"]} for a in d["alerts"]],
        "checked_at": d["checked_at"],
        "clinical_pharmacist_reviewer": "Pending pharmacist verification",
    }


class SoapNoteReq(BaseModel):
    session_id: Optional[str] = None
    patient_id: str
    caller_utterance: Optional[str] = None


def _deterministic_soap(p, rx, prof, transcript, orders, session) -> Dict[str, str]:
    caller_lines = [l[7:].strip() for l in transcript.splitlines() if l.startswith("Caller:")]
    ctrl = [r for r in rx if r["dea_schedule"] >= 2]
    return {
        "subjective": (f"{p['first_name']} {p['last_name']} contacted the pharmacy by phone. "
                       + (f"Caller stated: \"{' / '.join(caller_lines[-4:])}\"." if caller_lines else "No caller transcript recorded for this encounter.")),
        "objective": (f"Identity: {session.get('auth_method') or 'not recorded'}; verified={bool(session.get('caller_verified'))}. "
                      f"{len(rx)} active prescriptions: " + ", ".join(f"{r['drug_name']} {r['strength']}" for r in rx) + ". "
                      f"Allergies: {', '.join(a['allergen'] for a in prof['allergies']) or 'NKDA'}. "
                      f"Payer: {p['insurance_carrier']}."),
        "assessment": "\n".join([f"{i + 1}. {c['condition_name']} ({c['condition_code']})" for i, c in enumerate(prof["conditions"])]
                                + ([f"Controlled substances on profile: {', '.join(r['drug_name'] for r in ctrl)} — automated refill blocked per 21 CFR § 1306."] if ctrl else [])),
        "plan": "\n".join([f"{i + 1}. {o['status'].replace('_', ' ').title()}: {o['drug_name']} {o['strength']}"
                           + (f" — pickup {o['pickup_slot']}" if o.get("pickup_slot") else "") for i, o in enumerate(orders)]
                          or ["1. No dispensing actions recorded for this session."]),
    }


@app.post("/api/clinical/soap-note")
async def generate_clinical_soap_note(req: SoapNoteReq):
    return await asyncio.to_thread(_soap_note_sync, req)


def _soap_note_sync(req: SoapNoteReq):
    p = get_patient(req.patient_id)
    if not p:
        raise HTTPException(404, "Patient not found")
    rx = get_prescriptions_for_patient(req.patient_id)
    prof = get_patient_clinical_profile(req.patient_id)
    ctx = ACTIVE_SESSIONS.get(req.session_id or "")
    transcript = "\n".join(ctx["transcript_log"]) if ctx else (f"Caller: {req.caller_utterance}" if req.caller_utterance else "")
    with get_db_connection() as conn:
        srow = conn.execute("SELECT * FROM call_sessions WHERE session_id = ?", (req.session_id or "",)).fetchone()
        session = dict(srow) if srow else {}
        if not transcript and srow and srow["lemur_audit_json"]:
            transcript = f"[Post-call audit]\n{srow['lemur_audit_json']}"
        orders = [dict(r) for r in conn.execute("""
            SELECT o.*, pr.drug_name, pr.strength FROM dispense_orders o JOIN prescriptions pr ON pr.rx_number = o.rx_number
            WHERE o.session_id = ?""", (req.session_id or "",)).fetchall()]
    record = {"patient": {k: p[k] for k in ("first_name", "last_name", "dob", "insurance_carrier")},
              "prescriptions": rx, "allergies": prof["allergies"], "conditions": prof["conditions"],
              "session": {k: session.get(k) for k in ("auth_method", "caller_verified", "call_status", "escalation_reason")},
              "orders": orders}
    soap = generate_soap_note_llm(transcript, record) if transcript else None
    engine_label = f"LLM ({LLM_MODEL})"
    if not soap:
        soap = _deterministic_soap(p, rx, prof, transcript, orders, session)
        engine_label = "Deterministic template from record (LLM unavailable or no transcript)"
    codes = soap.pop("icd10_codes", None) or [f"{c['condition_code']} ({c['condition_name']})" for c in prof["conditions"]]
    return {"patient_id": p["patient_id"], "patient_name": f"{p['first_name']} {p['last_name']}", "session_id": req.session_id,
            "date_recorded": datetime.now().date().isoformat(), "soap": soap, "icd10_codes": codes,
            "generated_by": engine_label, "author": "DRAFT — requires pharmacist review and signature"}


@app.get("/api/clinical/pdmp/{patient_id}")
def clinical_pdmp_check(patient_id: str):
    """Controlled-substance summary from THIS pharmacy's records, with computed MME/day."""
    p = get_patient(patient_id)
    if not p:
        raise HTTPException(404, "Patient not found")
    ctrl = []
    for rx in get_prescriptions_for_patient(patient_id):
        if rx["dea_schedule"] < 2:
            continue
        mme = kb.compute_mme(rx)
        ctrl.append({"rx_number": rx["rx_number"], "drug_name": f"{rx['drug_name']} {rx['strength']}",
                     "schedule": f"DEA Schedule {rx['dea_schedule']}", "days_supply": rx["days_supply"],
                     "last_dispensed": rx["last_fill_date"], "mme_daily_dose": mme})
    total = round(sum(c["mme_daily_dose"] or 0 for c in ctrl), 1)
    status = ("HIGH (>= 90 MME/day: avoid or justify, co-prescribe naloxone)" if total >= 90 else
              "ELEVATED (>= 50 MME/day: reassess benefit/risk, offer naloxone)" if total >= 50 else
              "WITHIN CDC 2022 THRESHOLDS (< 50 MME/day)")
    dur = patient_dur(patient_id)
    co_depressants = [a for a in dur["alerts"]
                      if a["category"] == "DRUG_DRUG" and "depression" in a["clinical_effect"].lower()]
    return {
        "patient_id": patient_id, "patient_name": f"{p['first_name']} {p['last_name']}",
        "pdmp_state_registry": "Local dispensing records only — state PDMP (e.g., CA CURES) integration not configured",
        "active_controlled_substances": ctrl, "total_mme_daily": total, "mme_threshold_status": status,
        "mme_assumption": "No sig stored; MME assumes 1 dose twice daily.",
        "co_prescribed_cns_depressant_alerts": len(co_depressants),
        "dea_rule_enforced": "Title 21 CFR § 1306: automated voice refills blocked for Schedule II-V; pharmacist review required.",
    }


@app.get("/api/sms/outbox")
def get_sms_outbox():
    outbox = get_outbox()
    return {"outbox": outbox, "total_sent": len(outbox)}


class SendLockerOtpReq(BaseModel):
    to_phone: str
    patient_name: str
    rx_summary: str
    locker_number: Optional[str] = "Locker 4B"


@app.post("/api/sms/send-locker-otp")
def send_locker_otp(req: SendLockerOtpReq):
    otp = f"{secrets.randbelow(10000):04d}"
    pharmacy = get_pharmacy_info().get("name", "Community Care Pharmacy")
    msg = (f"{pharmacy}: Hello {req.patient_name}, your order ({req.rx_summary}) is ready in {req.locker_number}. "
           f"Enter PIN {otp} on the locker keypad. Reply STOP to opt out.")
    result = _send_sms(req.to_phone, msg, "LOCKER_OTP")
    return {"status": result["status"], "to_phone": req.to_phone, "message": msg, "locker_number": req.locker_number,
            "otp_code": otp, "timestamp": datetime.now(timezone.utc).isoformat()}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host=HOST, port=PORT)
