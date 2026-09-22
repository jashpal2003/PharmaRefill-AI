"""
Deterministic Clinical Safety Guardrails and Regulatory Intercepts.
Enforces:
1. Adverse Drug Event / Anaphylaxis Sentinel (Immediate warm transfer)
2. DEA Schedule II-V Controlled Substance Hard Block (Title 21 CFR § 1306)
3. Prescriber / Doctor Line Fast-Track Detection
4. Human Bailout / Operator Escalation
"""
import re
from typing import Optional, Dict, Any

# Clinical emergency adverse reaction triggers (anaphylaxis, respiratory, cardiovascular)
EMERGENCY_TRIGGERS = [
    "tight throat", "throat feels tight", "throat is swollen", "can't breathe",
    "cannot breathe", "shortness of breath", "swollen lip", "swelling in my tongue",
    "swollen tongue", "severe rash", "hives all over", "chest pain", "allergic reaction",
    "anaphylaxis", "face is swelling", "dizzy and faint", "throat closing"
]

# Human / Operator bailout triggers
OPERATOR_TRIGGERS = [
    "speak to a human", "real person", "pharmacist please", "human please",
    "operator", "talk to someone", "customer service", "agent please", "representative"
]

# Prescriber / Clinic Fast-Track keywords
PRESCRIBER_TRIGGERS = [
    "calling from dr", "dr.", "doctor's office", "medical assistant", "clinic calling",
    "prescriber", "leave a prescription", "verbal prescription", "npi number", "calling in a script"
]

def check_emergency_adverse_reaction(text: str) -> Optional[str]:
    """
    Evaluates transcript for acute allergic or life-threatening symptoms.
    Returns matched trigger phrase or None.
    """
    text_lower = text.lower()
    for trigger in EMERGENCY_TRIGGERS:
        if trigger in text_lower:
            return trigger
    return None

def check_human_bailout(text: str) -> bool:
    """Returns True if the caller explicitly demands a human representative."""
    text_lower = text.lower()
    return any(trig in text_lower for trig in OPERATOR_TRIGGERS)

def check_prescriber_intent(text: str) -> bool:
    """Detects if the incoming caller is a physician or clinic staff leaving a script."""
    text_lower = text.lower()
    return any(trig in text_lower for trig in PRESCRIBER_TRIGGERS)

def is_dea_controlled(medication_record: Dict[str, Any]) -> bool:
    """
    Title 21 CFR § 1306 Guardrail:
    Returns True if medication is Schedule II, III, IV, or V.
    """
    if medication_record.get("is_controlled_substance"):
        return True
    schedule = medication_record.get("dea_schedule", 0)
    try:
        return int(schedule) >= 2
    except (ValueError, TypeError):
        return False
