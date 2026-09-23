"""
backend/sms_service.py — Twilio SMS dispatch. Without Twilio credentials messages are recorded
in the outbox with status SIMULATED (clearly labelled, never shown as delivered).
"""

import logging
import uuid
from collections import deque
from datetime import datetime

from backend.config import TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER

logger = logging.getLogger("sms_service")

SMS_OUTBOX: deque = deque(maxlen=200)


def send_pickup_confirmation_sms(to_phone: str, patient_name: str, medications_summary: str,
                                 pickup_window: str, total_copay: float) -> dict:
    body = (f"Community Care Pharmacy: Hello {patient_name}, your {medications_summary} "
            f"is scheduled for pickup {pickup_window}. Estimated copay: ${total_copay:.2f}. Reply STOP to opt out.")
    return _send_sms(to_phone, body, "PICKUP_CONFIRMATION")


def _send_sms(to_phone: str, body: str, message_type: str) -> dict:
    record = {
        "id": f"SMS-{uuid.uuid4().hex[:6].upper()}",
        "to": to_phone,
        "message": body,
        "type": message_type,
        "timestamp": datetime.now().isoformat(sep=" ", timespec="seconds"),
        "status": "SIMULATED",
        "channel": "Simulated (Twilio not configured)",
    }
    if TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN:
        try:
            from twilio.rest import Client
            msg = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN).messages.create(to=to_phone, from_=TWILIO_PHONE_NUMBER, body=body)
            record.update({"twilio_sid": msg.sid, "status": (msg.status or "queued").upper(), "channel": "SMS / Twilio"})
        except Exception as e:
            logger.error("Twilio send failed: %s", e)
            record.update({"status": "FAILED", "error": str(e), "channel": "SMS / Twilio"})
    SMS_OUTBOX.append(record)
    return record


def get_outbox():
    return list(reversed(list(SMS_OUTBOX)[-50:]))
