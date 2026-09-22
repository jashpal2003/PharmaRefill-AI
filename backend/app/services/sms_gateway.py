"""
sms_gateway.py — Twilio SMS Gateway & Dual-Channel Patient Communication Service.
Features:
- Order Confirmation & Anti-RTS Pickup Commitment receipts
- "Snap-to-Verify" multimodal pill bottle camera links
- Pharmacist On-Duty Critical Emergency Alerts
"""
import logging
from typing import Dict, Any, Optional
from app.config import settings

logger = logging.getLogger("sms_gateway")

# In-memory outbox for hackathon demo visualization
MOCK_SMS_OUTBOX = []

def send_order_confirmation_sms(
    to_phone: str,
    patient_name: str,
    medication_summary: str,
    pickup_slot: str,
    total_copay: float
) -> Dict[str, Any]:
    """Dispatches order confirmation receipt with pickup reminder."""
    body = (
        f"Community Care Pharmacy: Hello {patient_name}, your prescription for {medication_summary} "
        f"is scheduled for pickup this {pickup_slot}. Pre-adjudicated copay: ${total_copay:.2f}. "
        "Reply STOP to opt out."
    )
    return _send_or_mock_sms(to_phone, body, "ORDER_CONFIRMATION")

def send_snap_to_verify_link(to_phone: str, session_id: str) -> Dict[str, Any]:
    """Sends immediate SMS link for elderly callers who cannot find or pronounce their Rx number."""
    body = (
        "Community Care Pharmacy: Having trouble reading your pill bottle? "
        f"Tap here to scan your bottle label with your phone camera: https://pharmarefill.app/scan/{session_id}"
    )
    return _send_or_mock_sms(to_phone, body, "SNAP_TO_VERIFY_LINK")

def send_pharmacist_emergency_alert(phone: str, symptom_summary: str, patient_name: str) -> Dict[str, Any]:
    """Alerts dispensing pharmacist of acute patient adverse event."""
    body = (
        f"URGENT CLINICAL ALERT: Patient {patient_name} reported severe symptoms ({symptom_summary}). "
        "Automated call halted; live emergency warm transfer in progress."
    )
    return _send_or_mock_sms(phone, body, "CLINICAL_EMERGENCY")

def _send_or_mock_sms(to_phone: str, body: str, message_type: str) -> Dict[str, Any]:
    """Sends real SMS if Twilio credentials exist, else records in live demo outbox."""
    record = {
        "to": to_phone,
        "body": body,
        "message_type": message_type,
        "status": "SENT",
        "timestamp": "Just now"
    }

    if settings.TWILIO_ACCOUNT_SID and settings.TWILIO_AUTH_TOKEN:
        try:
            from twilio.rest import Client
            client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
            message = client.messages.create(
                to=to_phone,
                from_=settings.TWILIO_PHONE_NUMBER,
                body=body
            )
            record["twilio_sid"] = message.sid
            logger.info(f"Sent Twilio SMS to {to_phone}: {message.sid}")
        except Exception as e:
            logger.warning(f"Twilio SMS delivery failed, recorded in local mock outbox: {e}")
            record["status"] = "MOCK_DISPATCHED"
    else:
        record["status"] = "MOCK_DISPATCHED"

    MOCK_SMS_OUTBOX.append(record)
    return record

def get_recent_sms_outbox():
    return list(reversed(MOCK_SMS_OUTBOX[-20:]))
