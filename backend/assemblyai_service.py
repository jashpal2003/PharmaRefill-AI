"""
backend/assemblyai_service.py — Real-time WebSocket streaming STT with word_boost
and post-call clinical audit / SOAP generation via the AssemblyAI LLM Gateway.
"""

import os
import json
import asyncio
import re
import time
import tempfile
import requests
import websockets
import assemblyai as aai
from pydantic import BaseModel, Field
from typing import List, Optional, Callable, Dict, Any
import logging
from backend.config import ASSEMBLYAI_API_KEY, FDA_WORD_BOOST, LLM_GATEWAY_URL, LLM_MODEL

logger = logging.getLogger("assemblyai_service")

aai.settings.api_key = ASSEMBLYAI_API_KEY

# Pydantic Schemas for LeMUR Structured Clinical Extraction
class MedicationExtracted(BaseModel):
    drug_name: str = Field(description="Normalized medical drug name")
    strength: Optional[str] = Field(default="Standard", description="Dosage strength if voiced, e.g., 20mg")
    action_type: str = Field(description="REFILL, MED_SYNC, or BLOCKED_CONTROLLED_SUBSTANCE")
    is_controlled: bool = Field(default=False, description="True if DEA schedule >= 2")

class ClinicalCallAudit(BaseModel):
    patient_full_name: Optional[str] = None
    patient_dob: Optional[str] = None
    consent_disclosed: bool = Field(default=True, description="True if recording disclosure was stated")
    emergency_adverse_reaction_detected: bool = Field(default=False, description="True if allergy/acute symptoms mentioned")
    adverse_reaction_summary: Optional[str] = Field(default=None, description="Summary of symptoms if present")
    medications_processed: List[MedicationExtracted] = Field(default_factory=list)
    total_copay_disclosed: Optional[str] = None
    pickup_window_committed: Optional[str] = None
    pharmacist_action_items: List[str] = Field(default_factory=list, description="Actionable tasks required by pharmacy staff")

async def connect_assemblyai_realtime(
    audio_queue: asyncio.Queue,
    on_transcript_received: Callable[[str, bool], Any]
):
    """Establishes real-time streaming WebSocket with AssemblyAI v3 Universal Streaming."""
    if not ASSEMBLYAI_API_KEY or len(ASSEMBLYAI_API_KEY.strip()) < 5:
        logger.warning("ASSEMBLYAI_API_KEY missing: inbound call audio will not be transcribed.")
        while True:
            chunk = await audio_queue.get()
            if chunk is None:
                break
        return

    url = "wss://streaming.assemblyai.com/v3/ws?sample_rate=16000"
    headers = {"Authorization": ASSEMBLYAI_API_KEY}

    try:
        async with websockets.connect(url, additional_headers=headers) as ws:
            # 1. Receive Begin handshake
            begin_raw = await ws.recv()
            begin_data = json.loads(begin_raw)

            # 2. Configure session with FDA Top 250 Keyterms & Domain Prompt
            config_message = {
                "type": "UpdateConfiguration",
                "keyterms_prompt": FDA_WORD_BOOST,
                "prompt": "Community care retail outpatient pharmacy patient prescription triage and refills."
            }
            await ws.send(json.dumps(config_message))

            async def send_audio_worker():
                while True:
                    chunk = await audio_queue.get()
                    if chunk is None:
                        try:
                            await ws.send(json.dumps({"type": "Terminate"}))
                        except Exception:
                            pass
                        break
                    if isinstance(chunk, bytes):
                        await ws.send(chunk)
                    elif isinstance(chunk, str):
                        try:
                            await ws.send(chunk.encode("latin1"))
                        except Exception:
                            pass

            async def receive_transcripts_worker():
                while True:
                    try:
                        raw_msg = await ws.recv()
                        data = json.loads(raw_msg)
                        msg_type = data.get("type")
                        if msg_type == "Turn":
                            text = data.get("transcript", "")
                            if text:
                                is_final = data.get("turn_is_formatted", False) or data.get("end_of_turn", False)
                                res = on_transcript_received(text, is_final)
                                if asyncio.iscoroutine(res):
                                    await res
                        elif msg_type == "Termination":
                            break
                    except websockets.exceptions.ConnectionClosed:
                        break
                    except Exception:
                        break

            await asyncio.gather(send_audio_worker(), receive_transcripts_worker())
    except Exception as e:
        logger.error("AssemblyAI streaming failed: %s", e)
        # Drain the queue so the call handler can shut down cleanly
        while True:
            chunk = await audio_queue.get()
            if chunk is None:
                break

def _llm_chat(system: str, user: str, max_tokens: int = 1500) -> Optional[str]:
    """Calls the AssemblyAI LLM Gateway (OpenAI-compatible chat completions). Returns None on any failure."""
    if not ASSEMBLYAI_API_KEY or len(ASSEMBLYAI_API_KEY.strip()) < 5:
        return None
    try:
        t0 = time.time()
        resp = requests.post(
            LLM_GATEWAY_URL,
            headers={"authorization": ASSEMBLYAI_API_KEY, "content-type": "application/json"},
            json={"model": LLM_MODEL, "max_tokens": max_tokens, "temperature": 0.1,
                  "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}]},
            timeout=20,
        )
        elapsed = int((time.time() - t0) * 1000)
        if resp.status_code != 200:
            logger.warning("LLM gateway HTTP %s in %sms", resp.status_code, elapsed)
            return None
        logger.info("LLM gateway OK in %sms (model=%s)", elapsed, LLM_MODEL)
        content = resp.json()["choices"][0]["message"]["content"].strip()
        if content.startswith("```"):
            content = re.sub(r"^```(?:json)?", "", content)
            content = re.sub(r"```$", "", content).strip()
        return content
    except Exception as e:
        logger.warning("LLM gateway error: %s", e)
        return None


def run_lemur_clinical_audit(transcript_text: str, patient: Optional[Dict[str, Any]] = None,
                             prescriptions: Optional[List[Dict[str, Any]]] = None) -> dict:
    """Structured post-call compliance audit. LLM when available; otherwise deterministic extraction
    grounded in the transcript and the verified patient's record (never invented values)."""
    prescriptions = prescriptions or []
    raw = _llm_chat(
        "You are a clinical pharmacy audit assistant. Output valid JSON only, without markdown.",
        f"""Review this recorded pharmacy phone call transcript:

{transcript_text}

Return JSON with keys: patient_full_name (string|null), patient_dob (string|null), consent_disclosed (bool),
emergency_adverse_reaction_detected (bool), adverse_reaction_summary (string|null),
medications_processed (list of {{drug_name, strength, action_type: REFILL|MED_SYNC|BLOCKED_CONTROLLED_SUBSTANCE|STATUS_CHECK, is_controlled}}),
total_copay_disclosed (string|null), pickup_window_committed (string|null), pharmacist_action_items (list of strings).
Only include facts stated in the transcript.""",
    )
    if raw:
        try:
            audit = ClinicalCallAudit(**json.loads(raw))
            out = audit.model_dump()
            out["audit_engine"] = f"LLM ({LLM_MODEL})"
            return out
        except Exception as e:
            logger.warning("LLM audit JSON invalid, using deterministic extraction: %s", e)

    t_lower = transcript_text.lower()
    agent_lines = "\n".join(l for l in transcript_text.splitlines() if l.startswith("Agent:")).lower()
    adverse = any(trig in t_lower for trig in ["tight throat", "cannot breathe", "can't breathe", "swollen", "severe rash",
                                               "allergic reaction", "chest pain", "anaphylaxis", "trouble breathing"])
    sync_segment = ""
    if "noticed that your" in agent_lines:
        sync_segment = agent_lines.split("noticed that your", 1)[1].split("will run out", 1)[0]
    meds, actions = [], []
    for rx in prescriptions:
        stem = rx["drug_name"].split()[0].lower().split("-")[0]
        if stem not in t_lower:
            continue
        controlled = rx["dea_schedule"] >= 2
        if controlled:
            action = "BLOCKED_CONTROLLED_SUBSTANCE"
            actions.append(f"DEA hard block: contact prescriber for {rx['drug_name']} (C-{rx['dea_schedule']}).")
        elif stem in sync_segment:
            action = "MED_SYNC"
        else:
            action = "REFILL"
        meds.append(MedicationExtracted(drug_name=rx["drug_name"], strength=rx["strength"],
                                        action_type=action, is_controlled=controlled))
    queued = "routed to our dispensing queue" in agent_lines
    if queued:
        actions.append("Fill and stage queued order for committed pickup window.")
    if adverse:
        actions.insert(0, "EMERGENCY: immediate pharmacist clinical follow-up for reported acute reaction.")
    copay = re.findall(r"copay for .+? is (\$[\d.]+)", agent_lines)
    audit = ClinicalCallAudit(
        patient_full_name=f"{patient['first_name']} {patient['last_name']}" if patient else None,
        patient_dob=patient["dob"] if patient else None,
        consent_disclosed="this call is recorded" in agent_lines,
        emergency_adverse_reaction_detected=adverse,
        adverse_reaction_summary="Caller reported acute symptoms; automated triage suspended." if adverse else None,
        medications_processed=meds,
        total_copay_disclosed=copay[-1] if copay else None,
        pickup_window_committed="Friday 3:00 PM - 6:00 PM" if queued else None,
        pharmacist_action_items=actions,
    )
    out = audit.model_dump()
    out["audit_engine"] = "Deterministic extraction (LLM unavailable)"
    return out


def generate_soap_note_llm(transcript_text: str, context: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    raw = _llm_chat(
        "You are a clinical pharmacist writing concise SOAP documentation. Output valid JSON only.",
        f"""Write a pharmacist SOAP note for this phone encounter. Use ONLY facts from the transcript and record.

PATIENT RECORD (JSON):
{json.dumps(context, default=str)}

TRANSCRIPT:
{transcript_text}

Return JSON: {{"subjective": str, "objective": str, "assessment": str, "plan": str, "icd10_codes": [str]}}.
icd10_codes must come from the record's conditions list.""",
        max_tokens=1200,
    )
    if not raw:
        return None
    try:
        data = json.loads(raw)
        if all(k in data for k in ("subjective", "objective", "assessment", "plan")):
            return data
    except Exception:
        pass
    return None


def transcribe_audio_bytes(audio_bytes: bytes, file_ext: str = "webm") -> Dict[str, Any]:
    """Transcribes caller audio with AssemblyAI (drug-name word boost + automatic language detection)."""
    if not ASSEMBLYAI_API_KEY or len(ASSEMBLYAI_API_KEY.strip()) < 5:
        return {"text": "", "confidence": 0.0, "words": [], "engine": "AssemblyAI Offline (API Key Missing)", "stt_ms": 0}

    clean_ext = (file_ext or "webm").lstrip(".").lower()
    if not re.fullmatch(r"[a-z0-9]{2,5}", clean_ext):
        clean_ext = "webm"
    with tempfile.NamedTemporaryFile(suffix=f".{clean_ext}", delete=False) as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name

    t0 = time.time()
    try:
        config = aai.TranscriptionConfig(word_boost=FDA_WORD_BOOST, boost_param="high", language_detection=True)
        transcript = aai.Transcriber().transcribe(tmp_path, config=config)
        elapsed = int((time.time() - t0) * 1000)
        text = transcript.text or ""
        confidence = getattr(transcript, "confidence", None) or 0.0
        logger.info("STT ok in %sms (%s chars)", elapsed, len(text))  # transcript text is PHI: never logged
        words = []
        for w in (getattr(transcript, "words", None) or []):
            clean_w = "".join(c for c in w.text if c.isalnum()).lower()
            words.append({"text": w.text, "confidence": w.confidence,
                          "is_word_boost_match": any(clean_w == b.lower() for b in FDA_WORD_BOOST)})
        lang = None
        try:
            lang = transcript.json_response.get("language_code")
        except Exception:
            pass
        return {"text": text, "confidence": confidence, "words": words, "language_code": lang,
                "engine": "AssemblyAI Universal STT (Live)", "stt_ms": elapsed}
    except Exception as e:
        logger.error("STT error: %s", e)
        return {"text": "", "confidence": 0.0, "words": [], "error": str(e), "engine": "AssemblyAI Error",
                "stt_ms": int((time.time() - t0) * 1000)}
    finally:
        try:
            os.remove(tmp_path)
        except OSError:
            pass
