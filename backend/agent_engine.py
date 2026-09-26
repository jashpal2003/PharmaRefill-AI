"""
backend/agent_engine.py — Pharmacy conversational agent (deterministic finite-state machine).

Features:
- Caller authentication: passive ANI match + FULL date-of-birth confirmation, or full name + full DOB
- Intent triage: refills, prescription status, Med-Sync, consultations, billing, FAQs
- Title 21 CFR § 1306 controlled-substance hard block (negation-aware)
- Acute adverse reaction / anaphylaxis sentinel with immediate escalation
- English / Spanish (auto-detected per utterance, sticky once detected)
- Warm-transfer hand-off packet for the pharmacist (see main.build_handoff_packet)

Intent recognition is keyword/rule based by design: it is auditable and deterministic, which
matters for a regulated workflow. The LLM is used only post-call (audit, SOAP note).
"""

import logging
import re
from datetime import date, datetime, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional

from backend.clinical_kb import detect_language, ingredient_of
from backend.database import (
    add_consultation,
    apply_billing_payment,
    find_patient_by_name_and_dob,
    get_billing_account,
    get_db_connection,
    get_patient_by_phone,
    get_pharmacy_info,
    get_prescriptions_for_patient,
)
from backend.i18n import localize_outbound, normalize_inbound
from backend.identity import parse_spoken_dob
from backend.phonetic_repair import find_phonetic_repair_candidate

logger = logging.getLogger("PharmaAgentEngine")

PHARMACIST_NAME = "Dr. Marcus Vance, PharmD"


class AgentState(str, Enum):
    GREETING_AND_CONSENT = "GREETING_AND_CONSENT"
    AUTHENTICATION = "AUTHENTICATION"
    INTENT_TRIAGE = "INTENT_TRIAGE"
    MED_SYNC_PROPOSAL = "MED_SYNC_PROPOSAL"
    COPAY_CONFIRMATION = "COPAY_CONFIRMATION"
    PICKUP_COMMITMENT = "PICKUP_COMMITMENT"
    CONSULTATION_SCHEDULING = "CONSULTATION_SCHEDULING"
    BILLING_INQUIRY = "BILLING_INQUIRY"
    CALL_COMPLETED = "CALL_COMPLETED"
    HOLD_AND_TRANSFER = "HOLD_AND_TRANSFER"
    ESCALATE_HUMAN = "ESCALATE_HUMAN"


class EscalationReason(str, Enum):
    DEA_CONTROLLED_SUBSTANCE = "DEA_CONTROLLED_SUBSTANCE"
    EMERGENCY_ADVERSE_REACTION = "EMERGENCY_ADVERSE_REACTION"
    RETRY_LIMIT_EXCEEDED = "RETRY_LIMIT_EXCEEDED"
    UNRESOLVABLE_INTENT = "UNRESOLVABLE_INTENT"
    CALLER_REQUEST = "CALLER_REQUEST"
    ZERO_REFILLS_DOCTOR_RENEWAL = "ZERO_REFILLS_DOCTOR_RENEWAL"
    PRIOR_AUTH_REQUIRED = "PRIOR_AUTH_REQUIRED"


CONTROLLED_SUBSTANCES = [
    "oxycodone", "hydrocodone", "adderall", "amphetamine", "xanax", "alprazolam", "percocet",
    "vicodin", "ambien", "zolpidem", "codeine", "morphine", "tramadol",
    "buprenorphine", "clonazepam", "lorazepam", "diazepam", "fentanyl",
    "methadone", "methylphenidate", "ritalin", "concerta",
]

EMERGENCY_TRIGGERS = [
    "tight throat", "throat feels tight", "throat is swollen", "can't breathe",
    "cannot breathe", "shortness of breath", "swollen lip", "swelling in my tongue",
    "severe rash", "chest pain", "allergic reaction", "anaphylaxis", "throat closing",
    "trouble breathing", "passed out", "swallowing difficulty",
]

HUMAN_REQUEST = ["speak to a human", "real person", "pharmacist please", "operator", "speak to someone",
                 "human agent", "talk to pharmacist", "talk to a pharmacist", "speak to a pharmacist"]

NEGATIONS = ["not on", "no longer", "stopped", "don't take", "do not take", "not taking", "quit", "off my", "off the"]

AFFIRM = re.compile(r"\b(yes|yeah|yep|sure|correct|please do|ok|okay|confirm|sounds good|great|definitely|absolutely)\b")
DECLINE = re.compile(r"\b(no|nope|not now|no thanks|that's all|that is all|nothing else|goodbye|bye)\b")

CONSULT_SLOTS = [(1, 10, 30), (3, 14, 0), (4, 11, 0), (6, 15, 30)]  # (days ahead, hour, minute)


def _contains_word(text: str, word: str) -> bool:
    return re.search(rf"\b{re.escape(word)}\b", text) is not None


class PharmaAgentEngine:
    def __init__(self, session_id: str, caller_phone: str = "+14155550192"):
        self.session_id = session_id
        self.caller_phone = caller_phone

        self.state = AgentState.GREETING_AND_CONSENT
        self.retry_count = 0
        self.max_retries = 3
        self.language = "en"

        self.patient: Optional[Dict[str, Any]] = None
        self.patient_id: Optional[str] = None
        self.pending_name_patient: Optional[Dict[str, Any]] = None
        self.ani_matched = False
        self.is_authenticated = False
        self.auth_method = "PENDING"

        self.requested_medication: Optional[Dict[str, Any]] = None
        self.synced_medications: List[Dict[str, Any]] = []
        self.committed_pickup_slot: Optional[str] = None
        self.total_copay = 0.0
        self.offered_slots: List[str] = []
        self.last_intent = "GREETING"
        self.escalation_reason: Optional[str] = None
        self.pending_phonetic_candidate: Optional[Dict[str, Any]] = None

        self._check_passive_ani()

    # ------------------------------------------------------------------
    def _check_passive_ani(self):
        matched = get_patient_by_phone(self.caller_phone)
        if matched:
            self.ani_matched = True
            self.patient = matched
            self.patient_id = matched["patient_id"]
            self.auth_method = "PASSIVE_ANI_PLUS_DOB"
            with get_db_connection() as conn:
                row = conn.execute("SELECT preferred_language FROM patient_profile_ext WHERE patient_id = ?",
                                   (self.patient_id,)).fetchone()
            if row and row[0]:
                self.language = row[0]

        with get_db_connection() as conn:
            conn.execute("""
                INSERT OR REPLACE INTO call_sessions (
                    session_id, caller_phone, ani_match_patient_id, consent_acknowledged,
                    caller_verified, auth_method, retry_count, call_status
                ) VALUES (?, ?, ?, 1, 0, ?, 0, 'IN_PROGRESS')
            """, (self.session_id, self.caller_phone, self.patient_id, self.auth_method))
            conn.commit()

    def _reply(self, text: str, **extra) -> Dict[str, Any]:
        out = {
            "spoken_text": localize_outbound(text, self.language),
            "spoken_text_en": text,
            "language": self.language,
            "current_state": self.state,
            "is_escalation": False,
            "intent": self.last_intent,
            "patient": self.patient if self.is_authenticated else None,
        }
        out.update(extra)
        return out

    # ------------------------------------------------------------------
    def process_utterance(self, text: str) -> Dict[str, Any]:
        raw = (text or "").strip()
        if raw and raw.upper() not in ("START", "START_CALL"):
            detected = detect_language(raw)
            if detected == "es":
                self.language = "es"
        text_clean = normalize_inbound(raw, self.language)
        text_lower = text_clean.lower()

        if self.state == AgentState.GREETING_AND_CONSENT and raw.lower() in ("start", "start_call", "hello", "hi", "hola", ""):
            return self._handle_greeting()

        if not raw:
            return self._handle_retry("I didn't hear anything.")

        # Global guardrail 1: emergency sentinel (always first)
        if any(trig in text_lower for trig in EMERGENCY_TRIGGERS):
            self.last_intent = "EMERGENCY"
            return self._trigger_escalation(
                EscalationReason.EMERGENCY_ADVERSE_REACTION,
                "I hear that you are reporting acute clinical symptoms. For your immediate safety, "
                "I am holding all automated requests and connecting you immediately to our emergency "
                "pharmacist line. If you cannot breathe, hang up and call 911.",
            )

        # Terminal states
        if self.state in (AgentState.ESCALATE_HUMAN, AgentState.HOLD_AND_TRANSFER):
            return self._reply("A pharmacist is joining the call now. Please stay on the line.",
                               is_escalation=True, is_hold=True, escalation_reason=self.escalation_reason)
        if self.state == AgentState.CALL_COMPLETED:
            if DECLINE.search(text_lower) and not AFFIRM.search(text_lower):
                self.last_intent = "END_CALL"
                return self._reply("Thank you for calling. Take care, goodbye!", end_call=True)
            self.state = AgentState.INTENT_TRIAGE

        # Global guardrail 2: human request
        if any(p in text_lower for p in HUMAN_REQUEST):
            self.last_intent = "HUMAN_REQUEST"
            return self._trigger_warm_transfer()

        # Global FAQ
        if self.state != AgentState.PICKUP_COMMITMENT and any(
                kw in text_lower for kw in ["hours", "open today", "close today", "when do you close",
                                            "store location", "what is your address", "address", "vaccine", "flu shot"]):
            faq = self._handle_pharmacy_faq(text_lower)
            if faq:
                self.last_intent = "FAQ"
                return self._reply(faq)

        if self.state in (AgentState.GREETING_AND_CONSENT, AgentState.AUTHENTICATION) or not self.is_authenticated:
            if self.state == AgentState.GREETING_AND_CONSENT:
                self.state = AgentState.AUTHENTICATION
            return self._handle_authentication(text_clean)

        handlers = {
            AgentState.INTENT_TRIAGE: self._handle_triage_intents,
            AgentState.MED_SYNC_PROPOSAL: self._handle_med_sync_response,
            AgentState.COPAY_CONFIRMATION: self._handle_copay_confirmation,
            AgentState.PICKUP_COMMITMENT: self._handle_pickup_commitment,
            AgentState.CONSULTATION_SCHEDULING: self._handle_consultation_scheduling,
            AgentState.BILLING_INQUIRY: self._handle_billing_payment,
        }
        return handlers.get(self.state, self._handle_triage_intents)(text_clean)

    # ------------------------------------------------------------------
    def _handle_greeting(self) -> Dict[str, Any]:
        self.state = AgentState.AUTHENTICATION
        self.last_intent = "GREETING"
        name = get_pharmacy_info().get("name", "Community Care Pharmacy")
        consent = f"Thank you for calling {name}. This call is recorded for clinical quality and accuracy. "
        if self.ani_matched and self.patient:
            return self._reply(
                f"{consent}I see you're calling from the number on file for "
                f"{self.patient['first_name']} {self.patient['last_name']}. "
                "To verify your record, could you please confirm your date of birth, including the year?")
        return self._reply(f"{consent}Welcome! May I please have your full name and date of birth to look up your profile?")

    def _mark_verified(self, method: str):
        self.is_authenticated = True
        self.state = AgentState.INTENT_TRIAGE
        self.retry_count = 0
        self.auth_method = method
        with get_db_connection() as conn:
            conn.execute("""
                UPDATE call_sessions SET ani_match_patient_id = ?, caller_verified = 1, auth_method = ?
                WHERE session_id = ?
            """, (self.patient_id, method, self.session_id))
            conn.commit()

    def _handle_authentication(self, text: str) -> Dict[str, Any]:
        self.last_intent = "AUTHENTICATION"
        spoken_dob = parse_spoken_dob(text)

        # Case A: ANI matched -> full DOB must match exactly
        if self.ani_matched and self.patient:
            if spoken_dob and spoken_dob == self.patient["dob"]:
                self._mark_verified("PASSIVE_ANI_PLUS_DOB")
                rx_list = get_prescriptions_for_patient(self.patient_id)
                due = [r for r in rx_list if r["dea_schedule"] == 0]
                prompt = f" Are you calling today to refill your {due[0]['drug_name'].split()[0]}?" if due else ""
                return self._reply(f"Thank you, {self.patient['first_name']}. Your identity is verified.{prompt} How can I help you today?")
            if spoken_dob:
                return self._handle_retry("That date of birth doesn't match our records.")
            return self._handle_retry("I need your full date of birth, including month, day and year.")

        # Case B: full name + full DOB in this utterance, or name from a previous turn
        search_text = text
        if self.pending_name_patient:
            search_text = f"{self.pending_name_patient['first_name']} {self.pending_name_patient['last_name']} {text}"
        matched = find_patient_by_name_and_dob(search_text, text)
        if matched:
            self.patient = matched
            self.patient_id = matched["patient_id"]
            self.pending_name_patient = None
            self._mark_verified("MANUAL_NAME_DOB_VERIFIED")
            return self._reply(f"Found your record, {matched['first_name']}. What prescription or pharmacy service can I assist you with today?")

        # Case C: name only -> remember it (not verified, nothing disclosed) and ask for DOB
        if not spoken_dob:
            words = f" {''.join(c if c.isalnum() else ' ' for c in text.lower())} "
            with get_db_connection() as conn:
                pts = [dict(r) for r in conn.execute("SELECT * FROM patients").fetchall()]
            hits = [p for p in pts if f" {p['first_name'].lower()} " in words and f" {p['last_name'].lower()} " in words]
            if len(hits) == 1:
                self.pending_name_patient = hits[0]
                return self._reply(f"Thanks, {hits[0]['first_name']}. And could you please state your full date of birth, including the year, for verification?")

        return self._handle_retry("I couldn't confirm those patient details.")

    # ------------------------------------------------------------------
    def _mentions_controlled(self, text_lower: str, prescriptions: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        names = list(CONTROLLED_SUBSTANCES)
        for rx in prescriptions:
            if rx["dea_schedule"] >= 2:
                names.append(rx["drug_name"].split()[0].lower().split("-")[0])
        for cd in names:
            m = re.search(rf"\b{re.escape(cd)}\b", text_lower)
            if not m:
                continue
            window = text_lower[max(0, m.start() - 25):m.start()]
            if any(neg in window for neg in NEGATIONS):
                continue
            ing = ingredient_of(cd) or cd
            matched = next((rx for rx in prescriptions
                            if cd in rx["drug_name"].lower() or ingredient_of(rx["drug_name"]) == ing), None)
            return {"name": cd, "rx": matched}
        return None

    def _handle_triage_intents(self, text: str) -> Dict[str, Any]:
        text_lower = text.lower()
        prescriptions = get_prescriptions_for_patient(self.patient_id) if self.patient_id else []

        # Check if caller is confirming a pending phonetic repair candidate ("Say Less" pattern)
        if self.pending_phonetic_candidate:
            cand = self.pending_phonetic_candidate
            if AFFIRM.search(text_lower) or any(w in text_lower for w in ["that one", "that's it", "correct", "the statin", "right", "yes please"]):
                self.pending_phonetic_candidate = None
                matched = cand["matched_rx"]
                self.last_intent = "REFILL"
                self.requested_medication = matched
                if matched.get("refills_remaining", 0) <= 0:
                    return self._trigger_escalation(
                        EscalationReason.ZERO_REFILLS_DOCTOR_RENEWAL,
                        f"Your prescription for {matched['drug_name']} has zero refills remaining. "
                        "I am connecting you to our prescriber line so we can request a renewal authorization from your doctor.")

                with get_db_connection() as conn:
                    sync = [dict(s) for s in conn.execute("""
                        SELECT * FROM prescriptions
                        WHERE patient_id = ? AND rx_number != ? AND dea_schedule = 0 AND refills_remaining > 0
                        AND next_refill_due_date BETWEEN date('now') AND date('now', '+7 days')
                    """, (self.patient_id, matched["rx_number"])).fetchall()]
                self.synced_medications = sync
                if sync:
                    self.state = AgentState.MED_SYNC_PROPOSAL
                    self.retry_count = 0
                    names = " and ".join(s["drug_name"].split()[0] for s in sync)
                    return self._reply(
                        f"I have queued your {matched['drug_name']}. I also noticed that your {names} "
                        "will run out in less than a week. Would you like me to synchronize them so you can pick up all medications together this Friday?")
                self.state = AgentState.COPAY_CONFIRMATION
                return self._execute_copay_check(False)
            elif DECLINE.search(text_lower):
                self.pending_phonetic_candidate = None
                return self._reply("Understood. Which prescription would you like to refill?")
            else:
                self.pending_phonetic_candidate = None

        # 1. DEA controlled substance hard block
        ctrl = self._mentions_controlled(text_lower, prescriptions)
        if ctrl:
            self.last_intent = "REFILL_CONTROLLED"
            rx = ctrl["rx"]
            drug = rx["drug_name"] if rx else ctrl["name"].capitalize()
            sched = rx["dea_schedule"] if rx else "II-V"
            if rx:
                with get_db_connection() as conn:
                    conn.execute("""
                        INSERT OR REPLACE INTO dispense_orders (order_id, session_id, rx_number, patient_id, status)
                        VALUES (?, ?, ?, ?, 'BLOCKED_DEA_REVIEW')
                    """, (f"ORD-{rx['rx_number']}-BLKD", self.session_id, rx["rx_number"], self.patient_id))
                    conn.commit()
                self.requested_medication = rx
            return self._trigger_escalation(
                EscalationReason.DEA_CONTROLLED_SUBSTANCE,
                f"Under Title 21 of the Code of Federal Regulations and pharmacy safety policy, "
                f"automated refills are not permitted for {drug}, as it is a Schedule {sched} controlled substance. "
                "I have flagged your record for review and am transferring you directly to our on-duty pharmacist.")

        # 2. Status inquiry
        if any(kw in text_lower for kw in ["status", "is my prescription ready", "is it ready", "ready for pickup",
                                           "when will it be ready", "check on my"]):
            self.last_intent = "STATUS"
            rx = self._match_rx(text_lower, prescriptions) or next((p for p in prescriptions if p["dea_schedule"] == 0), None)
            if rx:
                self.requested_medication = rx
                return self._reply(
                    f"Your prescription for {rx['drug_name']} has {rx['refills_remaining']} refills remaining and is scheduled for refill on {rx['next_refill_due_date']}. "
                    f"Your copay on file is ${float(rx['copay_amount']):.2f}. Would you like me to submit this refill?")

        # 3. Consultation scheduling
        if any(kw in text_lower for kw in ["consultation", "appointment", "speak with the doctor", "medication review",
                                           "mtm", "schedule", "talk with doctor"]):
            self.last_intent = "CONSULTATION"
            self.state = AgentState.CONSULTATION_SCHEDULING
            self.offered_slots = self._open_consult_slots()[:2]
            return self._reply(
                f"I would be glad to schedule a clinical consultation with {PHARMACIST_NAME}. "
                f"We have appointments available {self.offered_slots[0]} or {self.offered_slots[1]}. Which time works best for you?")

        # 4. Billing
        if any(kw in text_lower for kw in ["balance", "bill", "billing", "how much do i owe", "pay my copay", "payment", "card"]):
            self.last_intent = "BILLING"
            acct = get_billing_account(self.patient_id)
            bal = float(acct["outstanding_balance"]) if acct else 0.0
            if bal <= 0:
                self.state = AgentState.CALL_COMPLETED
                return self._reply("You have no outstanding balance. Is there anything else I can help you with today?")
            self.state = AgentState.BILLING_INQUIRY
            return self._reply(
                f"Your current outstanding prescription balance is ${bal:.2f}. "
                f"We have your card ending in {acct.get('card_last_four', '----')} on file. Would you like me to process payment for this balance today?")

        # 5. Refill
        matched = self._match_rx(text_lower, prescriptions)
        if not matched:
            # Phonetic Smart Clarification ("Say Less" pattern)
            cand = find_phonetic_repair_candidate(text_lower, prescriptions)
            if cand:
                rx_match = cand["matched_rx"]
                if rx_match.get("dea_schedule", 0) >= 2:
                    self.last_intent = "REFILL_CONTROLLED"
                    self.requested_medication = rx_match
                    with get_db_connection() as conn:
                        conn.execute("""
                            INSERT OR REPLACE INTO dispense_orders (order_id, session_id, rx_number, patient_id, status)
                            VALUES (?, ?, ?, ?, 'BLOCKED_DEA_REVIEW')
                        """, (f"ORD-{rx_match['rx_number']}-BLKD", self.session_id, rx_match["rx_number"], self.patient_id))
                        conn.commit()
                    return self._trigger_escalation(
                        EscalationReason.DEA_CONTROLLED_SUBSTANCE,
                        f"Under Title 21 of the Code of Federal Regulations and pharmacy safety policy, "
                        f"automated refills are not permitted for {rx_match['drug_name']}, as it is a Schedule {rx_match['dea_schedule']} controlled substance. "
                        "I have flagged your record for review and am transferring you directly to our on-duty pharmacist.")

                self.pending_phonetic_candidate = cand
                self.last_intent = "PHONETIC_CLARIFICATION"
                reply = self._reply(cand["clarification_prompt"])
                reply["phonetic_repair"] = {
                    "target_drug": cand["target_drug"],
                    "confidence": cand["confidence"],
                    "repair_type": cand["repair_type"],
                    "voiced_token": cand["voiced_token"]
                }
                return reply

        if not matched and (AFFIRM.search(text_lower) or _contains_word(text_lower, "refill")):
            matched = self.requested_medication or next((m for m in prescriptions if m["dea_schedule"] == 0), None)

        if not matched:
            if DECLINE.search(text_lower):
                self.state = AgentState.CALL_COMPLETED
                self.last_intent = "END_CALL"
                return self._reply("Thank you for calling. Take care, goodbye!", end_call=True)
            self.last_intent = "UNKNOWN"
            return self._handle_retry("I couldn't identify the specific prescription name.")

        self.last_intent = "REFILL"
        self.requested_medication = matched
        if matched.get("refills_remaining", 0) <= 0:
            return self._trigger_escalation(
                EscalationReason.ZERO_REFILLS_DOCTOR_RENEWAL,
                f"Your prescription for {matched['drug_name']} has zero refills remaining. "
                "I am connecting you to our prescriber line so we can request a renewal authorization from your doctor.")

        with get_db_connection() as conn:
            sync = [dict(s) for s in conn.execute("""
                SELECT * FROM prescriptions
                WHERE patient_id = ? AND rx_number != ? AND dea_schedule = 0 AND refills_remaining > 0
                AND next_refill_due_date BETWEEN date('now') AND date('now', '+7 days')
            """, (self.patient_id, matched["rx_number"])).fetchall()]
        self.synced_medications = sync
        if sync:
            self.state = AgentState.MED_SYNC_PROPOSAL
            self.retry_count = 0
            names = " and ".join(s["drug_name"].split()[0] for s in sync)
            return self._reply(
                f"I have queued your {matched['drug_name']}. I also noticed that your {names} "
                "will run out in less than a week. Would you like me to synchronize them so you can pick up all medications together this Friday?")
        self.state = AgentState.COPAY_CONFIRMATION
        return self._execute_copay_check(False)

    def _match_rx(self, text_lower: str, prescriptions: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        for p in prescriptions:
            stem = p["drug_name"].split()[0].lower().split("-")[0]
            if _contains_word(text_lower, stem) or p["rx_number"].lower() in text_lower:
                return p
        return None

    def _handle_med_sync_response(self, text: str) -> Dict[str, Any]:
        text_lower = text.lower()
        self.state = AgentState.COPAY_CONFIRMATION
        self.retry_count = 0
        accepted = bool(AFFIRM.search(text_lower) or any(k in text_lower for k in ["sync", "all of them", "all three", "please"]))
        if not accepted:
            self.synced_medications = []
        return self._execute_copay_check(accepted)

    def _execute_copay_check(self, med_sync_accepted: bool) -> Dict[str, Any]:
        req = self.requested_medication
        total = float(req["copay_amount"])
        summary = req["drug_name"]
        if med_sync_accepted and self.synced_medications:
            total += sum(float(s["copay_amount"]) for s in self.synced_medications)
            n = len(self.synced_medications)
            summary += f" plus {n} synchronized maintenance medication{'s' if n > 1 else ''}"
        self.total_copay = round(total, 2)
        return self._reply(
            f"Your estimated copay for {summary} is ${self.total_copay:.2f}, based on the copay on file for your plan. "
            "Would you like to confirm this order for Friday pickup?", total_copay=self.total_copay)

    def _handle_copay_confirmation(self, text: str) -> Dict[str, Any]:
        text_lower = text.lower()
        if any(kw in text_lower for kw in ["expensive", "too high", "too much", "cancel", "can't afford"]):
            self.last_intent = "COPAY_OBJECTION"
            return self._trigger_escalation(
                EscalationReason.UNRESOLVABLE_INTENT,
                "I understand you have questions about the copay amount. Let me connect you with our billing specialist to review coupon and manufacturer assistance options.")
        if AFFIRM.search(text_lower):
            self.state = AgentState.PICKUP_COMMITMENT
            self.retry_count = 0
            return self._reply("Perfect. Will you be picking this up at our drive-thru window between 3:00 PM and 6:00 PM on Friday?")
        if DECLINE.search(text_lower):
            self.state = AgentState.CALL_COMPLETED
            return self._reply("No problem, I have not placed the order. Is there anything else I can help you with today?")
        return self._handle_retry("Would you like me to confirm the prescription order for that copay?")

    def _handle_pickup_commitment(self, text: str) -> Dict[str, Any]:
        text_lower = text.lower()
        if DECLINE.search(text_lower) and not AFFIRM.search(text_lower):
            self.state = AgentState.CALL_COMPLETED
            return self._reply("No problem. A pharmacist will call you to arrange another pickup time. Is there anything else I can help you with today?")
        self.state = AgentState.CALL_COMPLETED
        self.committed_pickup_slot = "Friday 3:00 PM - 6:00 PM"
        req = self.requested_medication
        with get_db_connection() as conn:
            for med in [req] + self.synced_medications:
                conn.execute("""
                    INSERT OR REPLACE INTO dispense_orders (order_id, session_id, rx_number, patient_id, status,
                        copay_charged, pickup_date, pickup_slot)
                    VALUES (?, ?, ?, ?, 'QUEUED_FOR_FILL', ?, date('now', '+3 days'), ?)
                """, (f"ORD-{med['rx_number']}", self.session_id, med["rx_number"], self.patient_id,
                      med["copay_amount"], self.committed_pickup_slot))
            conn.execute("UPDATE call_sessions SET call_status = 'COMPLETED', pickup_committed_timestamp = ? WHERE session_id = ?",
                         (self.committed_pickup_slot, self.session_id))
            conn.commit()
        first = self.patient.get("first_name", "there") if self.patient else "there"
        return self._reply(
            f"You're all set, {first}! Your prescriptions have been routed to our dispensing queue and will be packaged together for Friday afternoon. "
            "I have also sent a confirmation text with your pickup details. Is there anything else I can help you with today?",
            trigger_sms=True)

    def _open_consult_slots(self) -> List[str]:
        with get_db_connection() as conn:
            taken = {r[0] for r in conn.execute("SELECT scheduled_time FROM consultations WHERE status = 'SCHEDULED'").fetchall()}
        out = []
        for days, h, mnt in CONSULT_SLOTS:
            d = datetime.combine(date.today() + timedelta(days=days), datetime.min.time()).replace(hour=h, minute=mnt)
            if d.weekday() == 6:
                d += timedelta(days=1)
            label = d.strftime("%A %b %d at %I:%M %p").replace(" 0", " ")
            if label not in taken:
                out.append(label)
        return out

    def _handle_consultation_scheduling(self, text: str) -> Dict[str, Any]:
        text_lower = text.lower()
        chosen = None
        for slot in self.offered_slots:
            day = slot.split()[0].lower()
            hour = slot.split(" at ")[1].split(":")[0]
            if day in text_lower or re.search(rf"\b{hour}\b", text_lower):
                chosen = slot
                break
        if not chosen and ("first" in text_lower or "tomorrow" in text_lower or AFFIRM.search(text_lower)):
            chosen = self.offered_slots[0]
        if not chosen and ("second" in text_lower or "later" in text_lower):
            chosen = self.offered_slots[1]
        if not chosen:
            return self._handle_retry(f"Which works better: {self.offered_slots[0]} or {self.offered_slots[1]}?")
        add_consultation(self.patient_id, chosen, "Patient requested clinical consultation via voice agent", PHARMACIST_NAME)
        self.state = AgentState.CALL_COMPLETED
        return self._reply(
            f"I have booked your clinical consultation for {chosen} with {PHARMACIST_NAME}. "
            "We will text you a reminder. Is there anything else I can help you with today?")

    def _handle_billing_payment(self, text: str) -> Dict[str, Any]:
        text_lower = text.lower()
        if AFFIRM.search(text_lower) or any(k in text_lower for k in ["pay", "charge"]):
            acct = get_billing_account(self.patient_id)
            amount = float(acct["outstanding_balance"]) if acct else 0.0
            res = apply_billing_payment(self.patient_id, amount)
            self.state = AgentState.CALL_COMPLETED
            return self._reply(
                f"Thank you. Your payment of ${res.get('payment_applied', amount):.2f} has been processed successfully. "
                f"Your remaining account balance is ${res.get('remaining_balance', 0.0):.2f}. Is there anything else I can help you with today?")
        self.state = AgentState.INTENT_TRIAGE
        return self._reply("No problem, I will keep your account balance on file. What else can I assist you with today?")

    def _handle_pharmacy_faq(self, text_lower: str) -> Optional[str]:
        info = get_pharmacy_info()
        name = info.get("name", "Community Care Pharmacy")
        if any(kw in text_lower for kw in ["hours", "open today", "close today", "when do you close"]):
            return (f"{name} is open Monday through Friday from {info.get('hours_mon_fri')}, Saturday from {info.get('hours_sat')}, "
                    f"and Sunday from {info.get('hours_sun')}. Our drive-thru pickup lockers are available 24/7.")
        if any(kw in text_lower for kw in ["drive thru", "drive-thru", "location", "address"]):
            return f"We are located at {info.get('address')}. The drive-thru lane is on the north side of the building."
        if any(kw in text_lower for kw in ["vaccine", "flu shot", "covid"]):
            return f"We offer immunizations for {info.get('vaccines_available')}. Walk-ins are welcome, or I can book a time for you."
        return None

    def _handle_retry(self, prompt: str) -> Dict[str, Any]:
        self.retry_count += 1
        with get_db_connection() as conn:
            conn.execute("UPDATE call_sessions SET retry_count = ? WHERE session_id = ?", (self.retry_count, self.session_id))
            conn.commit()
        if self.retry_count >= self.max_retries:
            return self._trigger_escalation(
                EscalationReason.RETRY_LIMIT_EXCEEDED,
                "I'm having a little difficulty catching that clearly today. To make sure we take care of your health accurately, let me transfer you directly to our pharmacy team.")
        return self._reply(f"{prompt} Please repeat that or speak slowly.", retry_count=self.retry_count)

    def _trigger_warm_transfer(self) -> Dict[str, Any]:
        self.state = AgentState.HOLD_AND_TRANSFER
        self.escalation_reason = EscalationReason.CALLER_REQUEST.value
        with get_db_connection() as conn:
            conn.execute("UPDATE call_sessions SET call_status = 'WARM_TRANSFER_IN_PROGRESS', escalation_reason = 'CALLER_REQUEST' WHERE session_id = ?",
                         (self.session_id,))
            conn.commit()
        return self._reply(
            "Please hold for just a moment while I transfer you to our on-duty pharmacist. I've sent your record over so they will be ready to help.",
            is_escalation=True, escalation_reason=self.escalation_reason, is_hold=True)

    def _trigger_escalation(self, reason: EscalationReason, spoken: str) -> Dict[str, Any]:
        self.state = AgentState.ESCALATE_HUMAN
        self.escalation_reason = reason.value
        with get_db_connection() as conn:
            conn.execute("UPDATE call_sessions SET call_status = 'ESCALATED', escalation_reason = ? WHERE session_id = ?",
                         (reason.value, self.session_id))
            conn.commit()
        return self._reply(spoken, is_escalation=True, escalation_reason=reason.value)
