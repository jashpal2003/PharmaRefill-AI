"""
backend/database.py — Database connection, queries, and schema initialization.
Supports multi-patient records, prescriptions, dispense orders, call sessions,
pharmacist consultations, billing accounts, and pharmacy configuration.
"""

import sqlite3
import os
from contextlib import contextmanager
from typing import Generator, Dict, Any, List, Optional
from backend.config import DB_PATH
from backend.db_extended import EXTENDED_DDL, RESETTABLE_TABLES, seed_extended_records

DDL_SCHEMA = """
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS patients (
    patient_id TEXT PRIMARY KEY,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    dob DATE NOT NULL,
    primary_phone TEXT UNIQUE NOT NULL,
    street_address TEXT,
    insurance_carrier TEXT,
    insurance_member_id TEXT,
    is_med_sync_enrolled BOOLEAN DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS prescriptions (
    rx_number TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,
    drug_name TEXT NOT NULL,
    strength TEXT NOT NULL,
    dosage_form TEXT NOT NULL,
    dea_schedule INTEGER NOT NULL DEFAULT 0,
    is_controlled_substance BOOLEAN GENERATED ALWAYS AS (dea_schedule >= 2) STORED,
    refills_remaining INTEGER NOT NULL,
    days_supply INTEGER NOT NULL DEFAULT 30,
    last_fill_date DATE NOT NULL,
    next_refill_due_date DATE NOT NULL,
    copay_amount DECIMAL(10, 2) NOT NULL,
    adjudication_status TEXT NOT NULL DEFAULT 'APPROVED',
    FOREIGN KEY(patient_id) REFERENCES patients(patient_id)
);

CREATE TABLE IF NOT EXISTS call_sessions (
    session_id TEXT PRIMARY KEY,
    caller_phone TEXT NOT NULL,
    ani_match_patient_id TEXT,
    consent_acknowledged BOOLEAN DEFAULT 0,
    caller_verified BOOLEAN DEFAULT 0,
    auth_method TEXT,
    retry_count INTEGER DEFAULT 0,
    call_status TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    escalation_reason TEXT,
    pickup_committed_timestamp TEXT,
    lemur_audit_json TEXT,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP,
    FOREIGN KEY(ani_match_patient_id) REFERENCES patients(patient_id)
);

CREATE TABLE IF NOT EXISTS dispense_orders (
    order_id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    rx_number TEXT NOT NULL,
    patient_id TEXT NOT NULL,
    status TEXT NOT NULL,
    copay_charged DECIMAL(10, 2),
    pickup_date DATE,
    pickup_slot TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(session_id) REFERENCES call_sessions(session_id),
    FOREIGN KEY(rx_number) REFERENCES prescriptions(rx_number),
    FOREIGN KEY(patient_id) REFERENCES patients(patient_id)
);

CREATE TABLE IF NOT EXISTS consultations (
    consultation_id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,
    pharmacist_name TEXT NOT NULL,
    consultation_type TEXT NOT NULL DEFAULT 'Medication Therapy Management',
    scheduled_time TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'SCHEDULED',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(patient_id) REFERENCES patients(patient_id)
);

CREATE TABLE IF NOT EXISTS billing_accounts (
    patient_id TEXT PRIMARY KEY,
    outstanding_balance DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    card_brand TEXT DEFAULT 'Visa',
    card_last_four TEXT DEFAULT '4242',
    last_payment_date DATE,
    last_payment_amount DECIMAL(10, 2) DEFAULT 0.00,
    FOREIGN KEY(patient_id) REFERENCES patients(patient_id)
);

CREATE TABLE IF NOT EXISTS pharmacy_info (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
"""

@contextmanager
def get_db_connection() -> Generator[sqlite3.Connection, None, None]:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    try:
        yield conn
    finally:
        conn.close()

def init_db():
    """Initializes tables and seeds default records."""
    os.makedirs(os.path.dirname(os.path.abspath(DB_PATH)), exist_ok=True)
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.executescript(DDL_SCHEMA)
        cursor.executescript(EXTENDED_DDL)

        # Check if already seeded with new patients
        cursor.execute("SELECT COUNT(*) FROM patients WHERE patient_id = 'PAT-1003'")
        if cursor.fetchone()[0] == 0:
            seed_records(conn)
        cursor.execute("SELECT COUNT(*) FROM patient_profile_ext")
        if cursor.fetchone()[0] == 0:
            seed_extended_records(conn)
        conn.commit()

def reset_db():
    """Drops all demo data (the append-only access log is kept) and re-seeds."""
    with get_db_connection() as conn:
        conn.execute("PRAGMA foreign_keys = OFF;")
        for table in RESETTABLE_TABLES:
            conn.execute(f"DROP TABLE IF EXISTS {table}")
        conn.commit()
    init_db()

def seed_records(conn: sqlite3.Connection):
    cursor = conn.cursor()
    # 1. Eleanor Vance
    cursor.execute("""
        INSERT OR REPLACE INTO patients (
            patient_id, first_name, last_name, dob, primary_phone, street_address,
            insurance_carrier, insurance_member_id, is_med_sync_enrolled
        ) VALUES (
            'PAT-1001', 'Eleanor', 'Vance', '1958-04-12', '+14155550192',
            '742 Evergreen Terrace, San Francisco, CA',
            'BlueCross Medicare Advantage', 'MED-BC-908124', 0
        )
    """)

    # 2. Robert Chen
    cursor.execute("""
        INSERT OR REPLACE INTO patients (
            patient_id, first_name, last_name, dob, primary_phone, street_address,
            insurance_carrier, insurance_member_id, is_med_sync_enrolled
        ) VALUES (
            'PAT-1002', 'Robert', 'Chen', '1965-11-20', '+14155550198',
            '101 California St, San Francisco, CA',
            'Kaiser Senior Gold', 'KSG-449102', 1
        )
    """)

    # 3. Maria Rodriguez
    cursor.execute("""
        INSERT OR REPLACE INTO patients (
            patient_id, first_name, last_name, dob, primary_phone, street_address,
            insurance_carrier, insurance_member_id, is_med_sync_enrolled
        ) VALUES (
            'PAT-1003', 'Maria', 'Rodriguez', '1974-08-15', '+14155550233',
            '520 Mission St, San Francisco, CA',
            'Aetna Premier Choice', 'AET-772910', 0
        )
    """)

    # 4. David Kim
    cursor.execute("""
        INSERT OR REPLACE INTO patients (
            patient_id, first_name, last_name, dob, primary_phone, street_address,
            insurance_carrier, insurance_member_id, is_med_sync_enrolled
        ) VALUES (
            'PAT-1004', 'David', 'Kim', '1982-03-05', '+14155550344',
            '88 Colin P Kelly Jr St, San Francisco, CA',
            'UnitedHealthcare Choice Plus', 'UHC-551940', 1
        )
    """)

    # Prescriptions
    cursor.execute("""
        INSERT OR REPLACE INTO prescriptions (
            rx_number, patient_id, drug_name, strength, dosage_form,
            dea_schedule, refills_remaining, days_supply,
            last_fill_date, next_refill_due_date, copay_amount, adjudication_status
        ) VALUES
        -- Eleanor Vance (PAT-1001)
        ('RX-4829103', 'PAT-1001', 'Atorvastatin Calcium', '20mg', 'Tablet', 0, 2, 30, date('now', '-30 days'), date('now'), 12.40, 'APPROVED'),
        ('RX-4829104', 'PAT-1001', 'Metformin HCl', '500mg', 'Tablet', 0, 3, 30, date('now', '-25 days'), date('now', '+5 days'), 4.00, 'APPROVED'),
        ('RX-4829105', 'PAT-1001', 'Lisinopril', '10mg', 'Tablet', 0, 1, 30, date('now', '-24 days'), date('now', '+6 days'), 3.50, 'APPROVED'),
        ('RX-9900112', 'PAT-1001', 'Oxycodone-Acetaminophen', '5-325mg', 'Tablet', 2, 1, 30, date('now', '-29 days'), date('now', '+1 day'), 15.00, 'APPROVED'),
        
        -- Robert Chen (PAT-1002)
        ('RX-7718291', 'PAT-1002', 'Omeprazole DR', '40mg', 'Capsule', 0, 2, 30, date('now', '-28 days'), date('now', '+2 days'), 8.50, 'APPROVED'),
        ('RX-7718292', 'PAT-1002', 'Amlodipine Besylate', '5mg', 'Tablet', 0, 4, 30, date('now', '-26 days'), date('now', '+4 days'), 3.00, 'APPROVED'),
        ('RX-7718293', 'PAT-1002', 'Sertraline HCl', '50mg', 'Tablet', 0, 1, 30, date('now', '-25 days'), date('now', '+5 days'), 5.20, 'APPROVED'),
        ('RX-9922331', 'PAT-1002', 'Adderall XR', '20mg', 'Capsule', 2, 0, 30, date('now', '-30 days'), date('now'), 25.00, 'BLOCKED_DEA_REVIEW'),

        -- Maria Rodriguez (PAT-1003)
        ('RX-5544101', 'PAT-1003', 'Levothyroxine Sodium', '75mcg', 'Tablet', 0, 3, 30, date('now', '-29 days'), date('now', '+1 day'), 6.50, 'APPROVED'),
        ('RX-5544102', 'PAT-1003', 'Albuterol HFA', '90mcg/actuation', 'Inhaler', 0, 2, 30, date('now', '-20 days'), date('now', '+10 days'), 18.00, 'APPROVED'),
        ('RX-5544103', 'PAT-1003', 'Gabapentin', '300mg', 'Capsule', 0, 1, 30, date('now', '-27 days'), date('now', '+3 days'), 4.80, 'APPROVED'),

        -- David Kim (PAT-1004)
        ('RX-6633201', 'PAT-1004', 'Losartan Potassium', '50mg', 'Tablet', 0, 5, 30, date('now', '-28 days'), date('now', '+2 days'), 4.00, 'APPROVED'),
        ('RX-6633202', 'PAT-1004', 'Rosuvastatin Calcium', '10mg', 'Tablet', 0, 3, 30, date('now', '-28 days'), date('now', '+2 days'), 9.50, 'APPROVED')
    """)

    # Seed Billing Accounts
    cursor.execute("""
        INSERT OR REPLACE INTO billing_accounts (
            patient_id, outstanding_balance, card_brand, card_last_four, last_payment_date, last_payment_amount
        ) VALUES
        ('PAT-1001', 19.90, 'Mastercard', '5812', date('now', '-30 days'), 19.90),
        ('PAT-1002', 16.70, 'Visa', '4242', date('now', '-28 days'), 22.50),
        ('PAT-1003', 11.30, 'Amex', '3009', date('now', '-15 days'), 45.00),
        ('PAT-1004', 13.50, 'Visa', '8910', date('now', '-60 days'), 13.50)
    """)

    # Seed Consultations
    cursor.execute("""
        INSERT OR REPLACE INTO consultations (
            consultation_id, patient_id, pharmacist_name, consultation_type, scheduled_time, status, notes
        ) VALUES
        ('CNS-101', 'PAT-1001', 'Dr. Marcus Vance, PharmD', 'Comprehensive Medication Review (CMR)', 'Tomorrow at 10:30 AM', 'SCHEDULED', 'Review Statin therapy & A1c management with Metformin.'),
        ('CNS-102', 'PAT-1002', 'Dr. Marcus Vance, PharmD', 'Blood Pressure & Amlodipine Adherence', 'Thursday at 2:00 PM', 'SCHEDULED', 'Evaluate evening dosage blood pressure logs.')
    """)

    # Seed Pharmacy Information
    cursor.execute("""
        INSERT OR REPLACE INTO pharmacy_info (key, value) VALUES
        ('name', 'Community Care Pharmacy'),
        ('address', '740 Castro Street, San Francisco, CA 94114'),
        ('phone', '+1 (415) 555-0100'),
        ('hours_mon_fri', '8:00 AM - 8:00 PM'),
        ('hours_sat', '9:00 AM - 6:00 PM'),
        ('hours_sun', '10:00 AM - 4:00 PM'),
        ('drive_thru_hours', 'Open 24/7 with automated prescription pickup lockers'),
        ('vaccines_available', 'Flu, COVID-19 Updated Booster, RSV, Shingles (Shingrix), Pneumococcal'),
        ('delivery_policy', 'Free local courier delivery for orders over $25 or synchronized Med-Sync packages')
    """)

    conn.commit()

def get_all_patients() -> List[Dict[str, Any]]:
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM patients ORDER BY last_name ASC")
        return [dict(r) for r in cursor.fetchall()]

def get_patient(patient_id: str) -> Optional[Dict[str, Any]]:
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM patients WHERE patient_id = ?", (patient_id,))
        row = cursor.fetchone()
        return dict(row) if row else None

def get_patient_by_phone(phone: str) -> Optional[Dict[str, Any]]:
    digits = "".join(c for c in phone if c.isdigit())
    if len(digits) < 10:
        return None
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM patients WHERE primary_phone LIKE ?", (f"%{digits[-10:]}",))
        row = cursor.fetchone()
        return dict(row) if row else None

def find_patient_by_name_and_dob(name: str, dob_text: str) -> Optional[Dict[str, Any]]:
    """Returns a patient only when first name, last name AND full date of birth match exactly one record."""
    from backend.identity import parse_spoken_dob
    dob = parse_spoken_dob(dob_text)
    if not dob:
        return None
    words = f" {''.join(c if c.isalnum() else ' ' for c in name.lower())} "
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM patients WHERE dob = ?", (dob,))
        candidates = [dict(r) for r in cursor.fetchall()]
    matches = [
        p for p in candidates
        if f" {p['first_name'].lower()} " in words and f" {p['last_name'].lower()} " in words
    ]
    return matches[0] if len(matches) == 1 else None

def get_patient_clinical_profile(patient_id: str) -> Dict[str, Any]:
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT allergen, reaction FROM patient_allergies WHERE patient_id = ?", (patient_id,))
        allergies = [dict(r) for r in cursor.fetchall()]
        cursor.execute("SELECT condition_code, condition_name FROM patient_conditions WHERE patient_id = ?", (patient_id,))
        conditions = [dict(r) for r in cursor.fetchall()]
        cursor.execute("SELECT * FROM patient_profile_ext WHERE patient_id = ?", (patient_id,))
        ext = cursor.fetchone()
    return {
        "allergies": allergies,
        "conditions": conditions,
        "ext": dict(ext) if ext else {"preferred_language": "en", "is_pregnant": 0, "is_340b_eligible": 0, "sms_opt_out": 0},
    }

def get_prescriptions_for_patient(patient_id: str) -> List[Dict[str, Any]]:
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM prescriptions WHERE patient_id = ? ORDER BY next_refill_due_date ASC", (patient_id,))
        return [dict(r) for r in cursor.fetchall()]

def get_dispense_orders(limit: int = 25) -> List[Dict[str, Any]]:
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT o.*, p.drug_name, p.strength, p.dosage_form, p.dea_schedule, pt.first_name, pt.last_name
            FROM dispense_orders o
            JOIN prescriptions p ON o.rx_number = p.rx_number
            JOIN patients pt ON o.patient_id = pt.patient_id
            ORDER BY o.created_at DESC LIMIT ?
        """, (limit,))
        return [dict(r) for r in cursor.fetchall()]

def get_call_sessions(limit: int = 15) -> List[Dict[str, Any]]:
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT s.*, p.first_name, p.last_name, p.dob
            FROM call_sessions s
            LEFT JOIN patients p ON s.ani_match_patient_id = p.patient_id
            ORDER BY s.started_at DESC LIMIT ?
        """, (limit,))
        return [dict(r) for r in cursor.fetchall()]

def get_consultations(patient_id: Optional[str] = None) -> List[Dict[str, Any]]:
    with get_db_connection() as conn:
        cursor = conn.cursor()
        if patient_id:
            cursor.execute("""
                SELECT c.*, p.first_name, p.last_name, p.primary_phone
                FROM consultations c
                JOIN patients p ON c.patient_id = p.patient_id
                WHERE c.patient_id = ?
                ORDER BY c.created_at DESC
            """, (patient_id,))
        else:
            cursor.execute("""
                SELECT c.*, p.first_name, p.last_name, p.primary_phone
                FROM consultations c
                JOIN patients p ON c.patient_id = p.patient_id
                ORDER BY c.created_at DESC
            """)
        return [dict(r) for r in cursor.fetchall()]

def add_consultation(patient_id: str, scheduled_time: str, reason: str, pharmacist_name: str = "Dr. Marcus Vance, PharmD") -> Dict[str, Any]:
    import uuid
    consultation_id = f"CNS-{uuid.uuid4().hex[:6].upper()}"
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO consultations (consultation_id, patient_id, pharmacist_name, consultation_type, scheduled_time, status, notes)
            VALUES (?, ?, ?, ?, ?, 'SCHEDULED', ?)
        """, (consultation_id, patient_id, pharmacist_name, 'Pharmacist Clinical Consultation', scheduled_time, reason))
        conn.commit()
    return {
        "consultation_id": consultation_id,
        "patient_id": patient_id,
        "pharmacist_name": pharmacist_name,
        "scheduled_time": scheduled_time,
        "status": "SCHEDULED",
        "notes": reason
    }

def get_billing_account(patient_id: str) -> Optional[Dict[str, Any]]:
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM billing_accounts WHERE patient_id = ?", (patient_id,))
        row = cursor.fetchone()
        return dict(row) if row else None

def apply_billing_payment(patient_id: str, amount: float) -> Dict[str, Any]:
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT outstanding_balance FROM billing_accounts WHERE patient_id = ?", (patient_id,))
        row = cursor.fetchone()
        if not row:
            return {"status": "ERROR", "message": "Account not found"}
        curr_bal = float(row[0])
        new_bal = max(0.0, curr_bal - amount)
        cursor.execute("""
            UPDATE billing_accounts
            SET outstanding_balance = ?, last_payment_date = date('now'), last_payment_amount = ?
            WHERE patient_id = ?
        """, (round(new_bal, 2), round(amount, 2), patient_id))
        conn.commit()
        return {"status": "SUCCESS", "previous_balance": curr_bal, "payment_applied": amount, "remaining_balance": round(new_bal, 2)}

def get_pharmacy_info() -> Dict[str, str]:
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT key, value FROM pharmacy_info")
        return {r["key"]: r["value"] for r in cursor.fetchall()}
