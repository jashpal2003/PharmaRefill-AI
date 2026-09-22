"""
test_system.py — Comprehensive Unit & Integration Test Suite for PharmaRefill AI.
"""
import pytest
import os
import sys
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.database import init_db, get_db_path
from app.fsm.state_machine import PharmacyStateMachine
from app.fsm.states import AgentState, EscalationReason
from app.audit.lemur_audit import execute_lemur_audit, ClinicalAuditReport
from app.benchmark.benchmark_eval import run_benchmark, compute_levenshtein_wer
from app.main import app

@pytest.fixture(scope="module", autouse=True)
def setup_database():
    init_db(seed_data=True)

@pytest.fixture
def client():
    return TestClient(app)

def test_database_and_health(client):
    res = client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ONLINE"
    assert "2.0.0" in data["version"]

def test_dashboard_metrics(client):
    res = client.get("/api/dashboard")
    assert res.status_code == 200
    data = res.json()
    assert "dea_blocks" in data
    assert "med_sync_retention_rate" in data

def test_patient_prescriptions(client):
    res = client.get("/api/prescriptions?patient_id=PAT-1001")
    assert res.status_code == 200
    meds = res.json()
    assert len(meds) >= 4
    drug_names = [m["drug_name"] for m in meds]
    assert any("Atorvastatin" in d for d in drug_names)
    assert any("Metformin" in d for d in drug_names)
    assert any("Oxycodone" in d for d in drug_names)

def test_happy_path_med_sync_commitment():
    db_path = get_db_path()
    fsm = PharmacyStateMachine(session_id="test-happy-1", caller_phone="+14155550192", db_path=db_path)
    
    # 1. Greeting & Consent
    r1 = fsm.process_utterance("")
    assert fsm.state == AgentState.AUTHENTICATION
    assert "recorded" in r1["spoken_text"].lower()
    assert fsm.ani_matched is True
    
    # 2. Authentication by DOB (1958)
    r2 = fsm.process_utterance("I was born in 1958")
    assert fsm.state == AgentState.INTENT_TRIAGE
    assert "verified" in r2["spoken_text"].lower()
    
    # 3. Intent: Refill Atorvastatin -> Med-Sync Offer
    r3 = fsm.process_utterance("Yes, refill my Atorvastatin please")
    assert fsm.state == AgentState.MED_SYNC_PROPOSAL
    assert "synchronize" in r3["spoken_text"].lower()
    assert len(fsm.synced_medications) >= 2
    
    # 4. Med-Sync Acceptance -> Copay quote ($19.90)
    r4 = fsm.process_utterance("Yes, sync all three together")
    assert fsm.state == AgentState.COPAY_CONFIRMATION
    assert fsm.total_copay == 19.90
    assert "$19.90" in r4["spoken_text"]
    
    # 5. Copay Confirmation -> Pickup slot offer
    r5 = fsm.process_utterance("Yes that copay sounds good")
    assert fsm.state == AgentState.PICKUP_COMMITMENT
    assert "drive-thru" in r5["spoken_text"].lower()
    
    # 6. Pickup Commitment -> Order committed & SMS
    r6 = fsm.process_utterance("Yes Friday afternoon works")
    assert fsm.state == AgentState.CALL_COMPLETED
    assert r6.get("trigger_sms") is True
    assert "dispensing queue" in r6["spoken_text"].lower()

def test_dea_controlled_substance_hard_block():
    db_path = get_db_path()
    fsm = PharmacyStateMachine(session_id="test-dea-block", caller_phone="+14155550192", db_path=db_path)
    fsm.process_utterance("")
    fsm.process_utterance("1958")
    
    # Request Oxycodone
    r = fsm.process_utterance("I need to refill my Oxycodone pills")
    assert fsm.state == AgentState.ESCALATE_HUMAN
    assert r["is_escalation"] is True
    assert r["escalation_reason"] == EscalationReason.DEA_CONTROLLED_SUBSTANCE.value
    assert "Schedule 2" in r["spoken_text"] or "controlled" in r["spoken_text"].lower()

def test_emergency_anaphylaxis_sentinel():
    db_path = get_db_path()
    fsm = PharmacyStateMachine(session_id="test-anaphylaxis", caller_phone="+14155550192", db_path=db_path)
    
    # Emergency trigger voiced immediately
    r = fsm.process_utterance("Help, my throat feels tight and my lip is swollen!")
    assert fsm.state == AgentState.ESCALATE_HUMAN
    assert r["is_escalation"] is True
    assert r["escalation_reason"] == EscalationReason.EMERGENCY_ADVERSE_REACTION.value
    assert "warm transfer" in r["spoken_text"].lower()

def test_two_retry_dead_end_escape():
    db_path = get_db_path()
    fsm = PharmacyStateMachine(session_id="test-retry-escape", caller_phone="+14155550192", db_path=db_path)
    fsm.process_utterance("")
    
    # Attempt 1 failed
    r1 = fsm.process_utterance("random background static noise")
    assert fsm.retry_count == 1
    assert r1["is_escalation"] is False
    
    # Attempt 2 failed -> Escalate
    r2 = fsm.process_utterance("more unparseable noise")
    assert fsm.retry_count == 2
    assert fsm.state == AgentState.ESCALATE_HUMAN
    assert r2["is_escalation"] is True
    assert r2["escalation_reason"] == EscalationReason.RETRY_LIMIT_EXCEEDED.value

def test_lemur_post_call_audit():
    transcript = (
        "Agent: This call is recorded. I see you're calling from Eleanor Vance's number. State your birth year.\n"
        "Caller: 1958.\n"
        "Agent: Identity verified. Refill Atorvastatin 20mg?\n"
        "Caller: Yes, please.\n"
        "Agent: We can sync Metformin and Lisinopril for Friday pickup for a total of $19.90.\n"
        "Caller: Sounds good, confirm it."
    )
    audit = execute_lemur_audit(
        session_id="test-audit-1",
        caller_phone="+14155550192",
        full_transcript=transcript,
        fsm_state_summary={
            "patient_name": "Eleanor Vance",
            "copay_total": 19.90,
            "pickup_slot": "Friday 3:00 PM - 6:00 PM"
        }
    )
    assert audit["consent_obtained"] is True
    assert len(audit["medications_processed"]) >= 1
    assert audit["total_copay_disclosed"] == "$19.90"
    assert len(audit["pharmacist_action_items"]) > 0

def test_benchmark_wer_suite():
    res = run_benchmark()
    assert res["total_reference_tokens"] > 100
    metrics = res["metrics"]
    baseline = metrics["baseline_no_boost"]
    boosted = metrics["boosted_assemblyai"]
    assert boosted["wer_percentage"] < baseline["wer_percentage"]
    assert boosted["drug_name_precision"] > baseline["drug_name_precision"]
