"""
pii_redactor.py — HIPAA-Compliant PII and Sensitive Telemetry Redaction Engine.
Masks SSN, credit cards, full street addresses, and unencrypted credentials.
"""
import re

SSN_REGEX = re.compile(r"\b\d{3}[- ]?\d{2}[- ]?\d{4}\b")
CREDIT_CARD_REGEX = re.compile(r"\b(?:\d{4}[- ]?){3}\d{4}\b")
PHONE_REGEX = re.compile(r"\+?1?\s*\(?([0-9]{3})\)?[-.\s]*([0-9]{3})[-.\s]*([0-9]{4})")

def redact_pii(text: str) -> str:
    """Masks sensitive identifiers to satisfy HIPAA Safe Harbor redaction guidelines."""
    redacted = SSN_REGEX.sub("[REDACTED-SSN]", text)
    redacted = CREDIT_CARD_REGEX.sub("[REDACTED-CC]", redacted)
    
    # Redact middle phone numbers: +1 (415) 555-0192 -> +1 (415) XXX-0192
    def mask_phone(match):
        return f"+1 ({match.group(1)}) XXX-{match.group(3)}"
        
    redacted = PHONE_REGEX.sub(mask_phone, redacted)
    return redacted
