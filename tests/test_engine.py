from backend.agent_engine import AgentState, EscalationReason, PharmaAgentEngine
from backend.database import get_billing_account, get_consultations, get_db_connection
from backend.identity import parse_spoken_dob

ELEANOR = "+14155550192"
MARIA = "+14155550233"
UNKNOWN = "+15555550100"


def start(phone=ELEANOR, sid="T-1"):
    e = PharmaAgentEngine(sid, phone)
    e.process_utterance("START")
    return e


# --- identity -------------------------------------------------------------
def test_dob_parser_requires_full_date():
    assert parse_spoken_dob("April 12, 1958") == "1958-04-12"
    assert parse_spoken_dob("04/12/1958") == "1958-04-12"
    assert parse_spoken_dob("1958") is None
    assert parse_spoken_dob("April 1958") is None


def test_year_only_does_not_authenticate():
    e = start()
    e.process_utterance("1958")
    assert not e.is_authenticated


def test_wrong_dob_rejected():
    e = start()
    e.process_utterance("April 13, 1958")
    assert not e.is_authenticated


def test_ani_plus_full_dob_authenticates():
    e = start()
    r = e.process_utterance("April 12, 1958")
    assert e.is_authenticated and "Eleanor" in r["spoken_text"]


def test_unknown_caller_name_then_dob():
    e = start(UNKNOWN)
    e.process_utterance("This is Robert Chen")
    assert not e.is_authenticated
    e.process_utterance("November 20, 1965")
    assert e.is_authenticated and e.patient_id == "PAT-1002"


def test_unknown_caller_first_name_only_is_not_enough():
    e = start(UNKNOWN)
    e.process_utterance("Robert, November 20, 1965")
    assert not e.is_authenticated


def test_retry_limit_escalates():
    e = start()
    for _ in range(3):
        r = e.process_utterance("banana")
    assert r["escalation_reason"] == EscalationReason.RETRY_LIMIT_EXCEEDED.value


# --- refill / med sync ----------------------------------------------------
def test_full_refill_flow_creates_orders_and_ends():
    e = start()
    e.process_utterance("April 12, 1958")
    assert e.process_utterance("Refill my Atorvastatin")["current_state"] == AgentState.MED_SYNC_PROPOSAL
    r = e.process_utterance("Yes sync them")
    assert r["total_copay"] == 19.90
    e.process_utterance("Yes confirm")
    r = e.process_utterance("Yes Friday works")
    assert r["trigger_sms"] and e.state == AgentState.CALL_COMPLETED
    with get_db_connection() as conn:
        n = conn.execute("SELECT COUNT(*) FROM dispense_orders WHERE session_id = 'T-1' AND status = 'QUEUED_FOR_FILL'").fetchone()[0]
    assert n == 3
    assert e.process_utterance("No that's all").get("end_call")


def test_completed_call_can_continue_to_new_intent():
    e = start()
    e.process_utterance("April 12, 1958")
    e.process_utterance("what's my balance")
    e.process_utterance("yes pay it")
    assert e.state == AgentState.CALL_COMPLETED
    r = e.process_utterance("Can I schedule a medication review?")
    assert r["current_state"] == AgentState.CONSULTATION_SCHEDULING


def test_copay_decline_does_not_escalate():
    e = start()
    e.process_utterance("April 12, 1958")
    e.process_utterance("Refill my Atorvastatin")
    e.process_utterance("no thanks")
    r = e.process_utterance("no")
    assert not r["is_escalation"] and e.state == AgentState.CALL_COMPLETED


def test_zero_refills_escalates_for_renewal():
    e = start("+14155550198")
    e.process_utterance("November 20, 1965")
    with get_db_connection() as conn:
        conn.execute("UPDATE prescriptions SET refills_remaining = 0 WHERE rx_number = 'RX-7718293'")
        conn.commit()
    r = e.process_utterance("refill my sertraline")
    assert r["escalation_reason"] == EscalationReason.ZERO_REFILLS_DOCTOR_RENEWAL.value


# --- guardrails -----------------------------------------------------------
def test_dea_block_on_controlled_request():
    e = start()
    e.process_utterance("April 12, 1958")
    r = e.process_utterance("I need my oxycodone refilled")
    assert r["escalation_reason"] == EscalationReason.DEA_CONTROLLED_SUBSTANCE.value


def test_dea_block_on_brand_name():
    e = start()
    e.process_utterance("April 12, 1958")
    assert e.process_utterance("refill my percocet")["is_escalation"]


def test_dea_negation_does_not_block():
    e = start()
    e.process_utterance("April 12, 1958")
    r = e.process_utterance("I'm not on oxycodone anymore, just refill my atorvastatin")
    assert not r["is_escalation"]
    assert "Atorvastatin" in e.requested_medication["drug_name"]


def test_emergency_sentinel_preempts_everything():
    e = start()
    r = e.process_utterance("my throat is closing and I can't breathe")
    assert r["escalation_reason"] == EscalationReason.EMERGENCY_ADVERSE_REACTION.value


def test_escalated_call_stays_on_hold():
    e = start()
    e.process_utterance("April 12, 1958")
    e.process_utterance("speak to a pharmacist")
    r = e.process_utterance("refill my atorvastatin")
    assert r["is_hold"] and e.state == AgentState.HOLD_AND_TRANSFER


# --- consultations / billing -------------------------------------------------
def test_consultation_books_offered_slot():
    before = len(get_consultations("PAT-1001"))
    e = start()
    e.process_utterance("April 12, 1958")
    e.process_utterance("I want to schedule a medication review")
    slot = e.offered_slots[1]
    e.process_utterance(f"{slot.split()[0]} please")
    after = get_consultations("PAT-1001")
    assert len(after) == before + 1 and any(c["scheduled_time"] == slot for c in after)


def test_billing_pays_actual_balance():
    e = start("+14155550198")
    e.process_utterance("November 20, 1965")
    e.process_utterance("what is my balance")
    r = e.process_utterance("yes")
    assert "$16.70" in r["spoken_text"]
    assert float(get_billing_account("PAT-1002")["outstanding_balance"]) == 0.0


# --- multilingual -----------------------------------------------------------
def test_spanish_preferred_language_greeting():
    e = PharmaAgentEngine("T-ES", MARIA)
    r = e.process_utterance("START")
    assert r["language"] == "es" and r["spoken_text"].startswith("Gracias por llamar")


def test_spanish_detected_mid_call_and_refill():
    e = start()
    e.process_utterance("April 12, 1958")
    r = e.process_utterance("Hola, necesito resurtir mi receta de Atorvastatin por favor")
    assert e.language == "es" and r["intent"] == "REFILL"
    assert "He puesto en cola" in r["spoken_text"]
