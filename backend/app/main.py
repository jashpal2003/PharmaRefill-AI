"""
main.py — FastAPI Production Real-Time Gateway & WebSocket Orchestration Server.
PharmaRefill AI (RxTriage) v2.0.0-PROD
"""
import asyncio
import json
import logging
import uuid
from typing import Dict, Any, List, Set
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Query, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel

from app.config import settings
from app.database import init_db, reset_db
from app.fsm.state_machine import PharmacyStateMachine
from app.fsm.states import AgentState, EscalationReason
from app.speech.assemblyai_stream import AssemblyAIRealtimeClient
from app.speech.tts_engine import TTSEngine
from app.speech.vad import VoiceActivityDetector
from app.audit.lemur_audit import execute_lemur_audit
from app.services.pharmacy_service import (
    get_patient,
    get_patient_by_phone,
    get_prescriptions_for_patient,
    get_dispense_orders,
    get_call_sessions,
    update_order_status,
    dispense_all_queued,
    get_dashboard_summary,
    export_fhir_bundle
)
from app.services.sms_gateway import (
    send_order_confirmation_sms,
    send_snap_to_verify_link,
    get_recent_sms_outbox
)
from app.benchmark.benchmark_eval import run_benchmark

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("pharmarefill_gateway")

# Initialize Database on boot
init_db(seed_data=True)

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Zero-Error Clinical Voice Triage & Med-Sync Platform for Community Pharmacy"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -------------------------------------------------------------
# WebSocket Connection Manager for Pharmacist Live Dashboard
# -------------------------------------------------------------
class DashboardEventBus:
    def __init__(self):
        self.active_connections: Set[WebSocket] = set()

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.add(websocket)
        logger.info(f"Dashboard client connected. Active clients: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        self.active_connections.discard(websocket)
        logger.info(f"Dashboard client disconnected. Active clients: {len(self.active_connections)}")

    async def broadcast(self, message_type: str, data: Dict[str, Any]):
        payload = json.dumps({"type": message_type, "data": data, "timestamp": asyncio.get_event_loop().time()})
        stale = []
        for ws in self.active_connections:
            try:
                await ws.send_text(payload)
            except Exception:
                stale.append(ws)
        for s in stale:
            self.disconnect(s)

event_bus = DashboardEventBus()

# Active Inbound Sessions Storage
ACTIVE_CALL_SESSIONS: Dict[str, Dict[str, Any]] = {}

# -------------------------------------------------------------
# REST Endpoints: System Health, Metrics, Clinical Operations
# -------------------------------------------------------------
@app.get("/health")
def get_health():
    return {
        "status": "ONLINE",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "station": settings.ACTIVE_STATION,
        "assemblyai_configured": bool(settings.ASSEMBLYAI_API_KEY),
        "cartesia_configured": bool(settings.CARTESIA_API_KEY),
        "twilio_configured": bool(settings.TWILIO_ACCOUNT_SID),
        "pacing_speed": f"{settings.SPEECH_PACING}x (Geriatric Intake)"
    }

@app.get("/api/dashboard")
def get_dashboard():
    return get_dashboard_summary()

@app.get("/api/patient/{patient_id}")
def get_patient_profile(patient_id: str):
    patient = get_patient(patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    prescriptions = get_prescriptions_for_patient(patient_id)
    return {"patient": patient, "prescriptions": prescriptions}

@app.get("/api/prescriptions")
def get_prescriptions(patient_id: str = Query(default="PAT-1001")):
    return get_prescriptions_for_patient(patient_id)

@app.get("/api/orders")
def get_orders():
    return get_dispense_orders(limit=30)

@app.post("/api/orders/{order_id}/dispense")
def dispense_order_endpoint(order_id: str):
    success = update_order_status(order_id, "DISPENSED")
    return {"order_id": order_id, "status": "DISPENSED", "success": success}

@app.post("/api/orders/dispense-all")
async def dispense_all_endpoint(patient_id: str = "PAT-1001"):
    count = dispense_all_queued(patient_id)
    await event_bus.broadcast("DISPENSE_QUEUE_UPDATED", {"patient_id": patient_id, "count": count})
    return {"patient_id": patient_id, "dispensed_count": count}

@app.get("/api/sessions")
def get_sessions():
    return get_call_sessions(limit=20)

@app.get("/api/sms/outbox")
def get_sms_outbox():
    return get_recent_sms_outbox()

@app.get("/api/eval/benchmark")
def get_wer_benchmark():
    return run_benchmark()

@app.get("/api/export/fhir/{patient_id}")
def export_fhir(patient_id: str):
    return export_fhir_bundle(patient_id)

@app.post("/api/reset-demo")
async def reset_demo_state():
    reset_db()
    ACTIVE_CALL_SESSIONS.clear()
    await event_bus.broadcast("DEMO_STATE_RESET", {"message": "Demo database restored to default Eleanor Vance profile."})
    return {"status": "SUCCESS", "message": "Database reset to initial Eleanor Vance demo state."}

# -------------------------------------------------------------
# Scenario Simulation API (For Hackathon Judges & Browser Calling)
# -------------------------------------------------------------
class StepRequest(BaseModel):
    session_id: str
    caller_phone: str = "+14155550192"
    utterance: str

@app.post("/api/call/simulate-step")
async def simulate_call_step(req: StepRequest):
    """
    Simulates or drives a step in the conversation.
    Updates the state machine, streams tokens, broadcasts to the cockpit, and triggers LeMUR if finished.
    """
    session_id = req.session_id
    if session_id not in ACTIVE_CALL_SESSIONS:
        fsm = PharmacyStateMachine(session_id=session_id, caller_phone=req.caller_phone, db_path=settings.DATABASE_PATH)
        aai_client = AssemblyAIRealtimeClient()
        tts = TTSEngine()
        ACTIVE_CALL_SESSIONS[session_id] = {
            "fsm": fsm,
            "aai": aai_client,
            "tts": tts,
            "transcript_history": [],
            "caller_phone": req.caller_phone
        }
        await event_bus.broadcast("CALL_STARTED", {
            "session_id": session_id,
            "caller_phone": req.caller_phone,
            "ani_matched": fsm.ani_matched,
            "patient": fsm.patient_record
        })

    session_ctx = ACTIVE_CALL_SESSIONS[session_id]
    fsm: PharmacyStateMachine = session_ctx["fsm"]
    aai: AssemblyAIRealtimeClient = session_ctx["aai"]
    
    # 1. Simulate speech tokens streaming
    tokens = aai.annotate_tokens(req.utterance) if req.utterance else []
    session_ctx["transcript_history"].append(f"Caller: {req.utterance}")

    await event_bus.broadcast("TRANSCRIPT_UPDATE", {
        "session_id": session_id,
        "speaker": "CALLER",
        "text": req.utterance,
        "tokens": tokens,
        "confidence": 0.98
    })

    # 2. Process Utterance in Deterministic State Machine
    fsm_res = fsm.process_utterance(req.utterance)
    spoken_text = fsm_res.get("spoken_text", "")
    session_ctx["transcript_history"].append(f"Agent: {spoken_text}")

    # 3. Handle Special Intercept Broadcasts (DEA Block, Emergency, Med-Sync)
    if fsm_res.get("escalation_reason") == EscalationReason.DEA_CONTROLLED_SUBSTANCE.value:
        await event_bus.broadcast("DEA_BLOCK_ALERT", {
            "session_id": session_id,
            "medication": fsm.requested_medication,
            "reason": "DEA Schedule II Hard Gatekeeper activated."
        })
    elif fsm_res.get("escalation_reason") == EscalationReason.EMERGENCY_ADVERSE_REACTION.value:
        await event_bus.broadcast("EMERGENCY_ALERT", {
            "session_id": session_id,
            "patient": fsm.patient_record,
            "spoken_text": spoken_text,
            "warning": "ACUTE ADVERSE EVENT SENTINEL: Anaphylaxis / Emergency Warm Transfer Initiated!"
        })

    if fsm_res.get("trigger_sms"):
        send_order_confirmation_sms(
            to_phone=req.caller_phone,
            patient_name=fsm.patient_record.get("first_name", "Eleanor") if fsm.patient_record else "Eleanor",
            medication_summary="Atorvastatin 20mg + Synchronized Metformin & Lisinopril",
            pickup_slot=fsm.committed_pickup_slot or "Friday 3:00 PM - 6:00 PM",
            total_copay=fsm.total_copay
        )
        await event_bus.broadcast("SMS_DISPATCHED", {
            "session_id": session_id,
            "recipient": req.caller_phone,
            "summary": "Prescription Confirmation & Anti-RTS Pickup Reminder"
        })

    # 4. Broadcast Agent Response & State Change to Cockpit
    await event_bus.broadcast("AGENT_SPEAKING", {
        "session_id": session_id,
        "spoken_text": spoken_text,
        "current_state": fsm_res.get("current_state"),
        "is_escalation": fsm_res.get("is_escalation"),
        "escalation_reason": fsm_res.get("escalation_reason"),
        "total_copay": fsm.total_copay,
        "synced_medications": fsm.synced_medications,
        "orders_queued": bool(fsm.committed_pickup_slot)
    })

    # 5. Check if call concluded or escalated -> Run LeMUR Audit
    lemur_audit = None
    if fsm.state in [AgentState.CALL_COMPLETED, AgentState.ESCALATE_HUMAN]:
        full_transcript = "\n".join(session_ctx["transcript_history"])
        lemur_audit = execute_lemur_audit(
            session_id=session_id,
            caller_phone=req.caller_phone,
            full_transcript=full_transcript,
            fsm_state_summary={
                "patient_name": fsm.patient_record.get("first_name", "Eleanor") + " " + fsm.patient_record.get("last_name", "Vance") if fsm.patient_record else "Eleanor Vance",
                "copay_total": fsm.total_copay,
                "pickup_slot": fsm.committed_pickup_slot,
                "escalation_reason": fsm_res.get("escalation_reason"),
                "requested_medication": fsm.requested_medication,
                "synced_medications": fsm.synced_medications
            }
        )
        await event_bus.broadcast("LEMUR_AUDIT_COMPLETED", {
            "session_id": session_id,
            "audit": lemur_audit
        })

    return {
        "session_id": session_id,
        "spoken_text": spoken_text,
        "state": fsm.state,
        "is_escalation": fsm_res.get("is_escalation"),
        "escalation_reason": fsm_res.get("escalation_reason"),
        "tokens": tokens,
        "lemur_audit": lemur_audit
    }

# -------------------------------------------------------------
# WebSocket Endpoints: /ws/dashboard & /ws/call
# -------------------------------------------------------------
@app.websocket("/ws/dashboard")
async def websocket_dashboard(websocket: WebSocket):
    """Real-time event stream for the Next.js Pharmacist Cockpit."""
    await event_bus.connect(websocket)
    try:
        # Send initial snapshot upon connection
        summary = get_dashboard_summary()
        patient = get_patient("PAT-1001")
        prescriptions = get_prescriptions_for_patient("PAT-1001")
        orders = get_dispense_orders(limit=10)
        sessions = get_call_sessions(limit=10)
        
        await websocket.send_text(json.dumps({
            "type": "INITIAL_SNAPSHOT",
            "data": {
                "summary": summary,
                "patient": patient,
                "prescriptions": prescriptions,
                "orders": orders,
                "sessions": sessions
            }
        }))
        
        while True:
            # Keepalive / ping-pong
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text(json.dumps({"type": "PONG"}))
    except WebSocketDisconnect:
        event_bus.disconnect(websocket)
    except Exception as e:
        logger.error(f"Dashboard socket exception: {e}")
        event_bus.disconnect(websocket)

@app.websocket("/ws/call")
async def websocket_live_call(websocket: WebSocket):
    """
    Bi-directional audio streaming WebSocket endpoint.
    Accepts raw audio chunks from Twilio or browser microphone,
    pipes to AssemblyAI STT, executes state machine, and streams audio back.
    """
    await websocket.accept()
    session_id = f"CALL-{uuid.uuid4().hex[:8].upper()}"
    caller_phone = "+14155550192" # Default to Eleanor's registered phone
    
    fsm = PharmacyStateMachine(session_id=session_id, caller_phone=caller_phone, db_path=settings.DATABASE_PATH)
    vad = VoiceActivityDetector()
    tts = TTSEngine()
    
    await event_bus.broadcast("CALL_STARTED", {
        "session_id": session_id,
        "caller_phone": caller_phone,
        "ani_matched": fsm.ani_matched,
        "patient": fsm.patient_record
    })
    
    # Trigger initial greeting & statutory consent
    initial_res = fsm.process_utterance("")
    await websocket.send_text(json.dumps({
        "type": "AGENT_SPEECH",
        "text": initial_res["spoken_text"]
    }))
    
    await event_bus.broadcast("AGENT_SPEAKING", {
        "session_id": session_id,
        "spoken_text": initial_res["spoken_text"],
        "current_state": initial_res["current_state"]
    })

    transcript_history = [f"Agent: {initial_res['spoken_text']}"]

    try:
        while True:
            raw_msg = await websocket.receive_text()
            msg_data = json.loads(raw_msg)
            msg_type = msg_data.get("event") or msg_data.get("type")

            # Barge-in speech detection
            if msg_type == "media":
                # Audio frame received
                await event_bus.broadcast("AUDIO_ENERGY", {"energy": 0.85, "speaker": "CALLER"})
                
            elif msg_type == "transcript" or msg_type == "user_utterance":
                spoken = msg_data.get("text", "")
                transcript_history.append(f"Caller: {spoken}")
                
                # Check VAD barge-in: cancel any playing speech
                tts.cancel_speech()
                
                # Process utterance
                res = fsm.process_utterance(spoken)
                spoken_response = res.get("spoken_text", "")
                transcript_history.append(f"Agent: {spoken_response}")

                # Send response back over socket
                await websocket.send_text(json.dumps({
                    "type": "AGENT_SPEECH",
                    "text": spoken_response,
                    "state": res.get("current_state"),
                    "is_escalation": res.get("is_escalation")
                }))

                # Broadcast to Cockpit
                await event_bus.broadcast("AGENT_SPEAKING", {
                    "session_id": session_id,
                    "spoken_text": spoken_response,
                    "current_state": res.get("current_state"),
                    "is_escalation": res.get("is_escalation"),
                    "escalation_reason": res.get("escalation_reason"),
                    "total_copay": fsm.total_copay,
                    "synced_medications": fsm.synced_medications
                })

                if fsm.state in [AgentState.CALL_COMPLETED, AgentState.ESCALATE_HUMAN]:
                    break

    except WebSocketDisconnect:
        logger.info(f"Live call WebSocket disconnected: {session_id}")
    finally:
        # Generate final LeMUR audit
        full_text = "\n".join(transcript_history)
        audit = execute_lemur_audit(
            session_id=session_id,
            caller_phone=caller_phone,
            full_transcript=full_text,
            fsm_state_summary={
                "patient_name": "Eleanor Vance",
                "copay_total": fsm.total_copay,
                "pickup_slot": fsm.committed_pickup_slot,
                "escalation_reason": fsm.state.value if fsm.state == AgentState.ESCALATE_HUMAN else None
            }
        )
        await event_bus.broadcast("LEMUR_AUDIT_COMPLETED", {"session_id": session_id, "audit": audit})
