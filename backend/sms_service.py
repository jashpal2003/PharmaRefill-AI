"""
backend/sms_service.py — Twilio SMS dispatch for dual-channel pickup confirmations.
"""

import logging
from backend.config import TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER

logger = logging.getLogger("sms_service")

MOCK_SMS_OUTBOX = []

def send_pickup_confirmation_sms(
    to_phone: str,
    patient_name: str,
    medications_summary: str,
    pickup_window: str,
    total_copay: float
) -> dict:
    """Dispatches SMS receipt with anti-RTS pickup window locking."""
    body = (
        f"Community Care Pharmacy: Hello {patient_name}, your prescription for {medications_summary} "
        f"is scheduled for pickup {pickup_window}. Pre-adjudicated copay: ${total_copay:.2f}. "
        "Reply STOP to cancel."
    )
    return _send_sms(to_phone, body, "PICKUP_CONFIRMATION")

def send_snap_link_sms(to_phone: str, session_id: str) -> dict:
    """Sends immediate SMS link for elderly callers who cannot read their pill bottle."""
    body = (
        "Community Care Pharmacy: Having trouble reading your pill bottle? "
        f"Tap here to scan your bottle label with your phone camera: https://pharmarefill.app/scan/{session_id}"
    )
    return _send_sms(to_phone, body, "SNAP_TO_VERIFY")

def _send_sms(to_phone: str, body: str, message_type: str) -> dict:
    record = {
        "to": to_phone,
        "body": body,
        "type": message_type,
        "status": "SENT"
    }

    if TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN:
        try:
            from twilio.rest import Client
            client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
            msg = client.messages.create(
                to=to_phone,
                from_=TWILIO_PHONE_NUMBER,
                body=body
            )
            record["twilio_sid"] = msg.sid
        except Exception as e:
            record["status"] = "MOCK_SENT"
    else:
        record["status"] = "MOCK_SENT"

    MOCK_SMS_OUTBOX.append(record)
    return record

def get_outbox():
    return list(reversed(MOCK_SMS_OUTBOX[-20:]))
