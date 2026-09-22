"""
backend/database.py — Database connection, queries, and schema initialization.
"""

import sqlite3
import os
from contextlib import contextmanager
from typing import Generator, Dict, Any, List, Optional
from backend.config import DB_PATH

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
        
        # Check if already seeded
        cursor.execute("SELECT COUNT(*) FROM patients WHERE patient_id = 'PAT-1001'")
        if cursor.fetchone()[0] == 0:
            seed_records(conn)
        conn.commit()

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

    # Prescriptions
    cursor.execute("""
        INSERT OR REPLACE INTO prescriptions (
            rx_number, patient_id, drug_name, strength, dosage_form,
            dea_schedule, refills_remaining, days_supply,
            last_fill_date, next_refill_due_date, copay_amount, adjudication_status
        ) VALUES
        ('RX-4829103', 'PAT-1001', 'Atorvastatin Calcium', '20mg', 'Tablet', 0, 2, 30, date('now', '-30 days'), date('now'), 12.40, 'APPROVED'),
        ('RX-4829104', 'PAT-1001', 'Metformin HCl', '500mg', 'Tablet', 0, 3, 30, date('now', '-25 days'), date('now', '+5 days'), 4.00, 'APPROVED'),
        ('RX-4829105', 'PAT-1001', 'Lisinopril', '10mg', 'Tablet', 0, 1, 30, date('now', '-24 days'), date('now', '+6 days'), 3.50, 'APPROVED'),
        ('RX-9900112', 'PAT-1001', 'Oxycodone-Acetaminophen', '5-325mg', 'Tablet', 2, 1, 30, date('now', '-29 days'), date('now', '+1 day'), 15.00, 'APPROVED'),
        ('RX-7718291', 'PAT-1002', 'Omeprazole DR', '40mg', 'Capsule', 0, 0, 30, date('now', '-45 days'), date('now', '-15 days'), 25.00, 'REJECTED_CODE_75')
    """)
    conn.commit()

def get_patient(patient_id: str) -> Optional[Dict[str, Any]]:
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM patients WHERE patient_id = ?", (patient_id,))
        row = cursor.fetchone()
        return dict(row) if row else None

def get_prescriptions_for_patient(patient_id: str) -> List[Dict[str, Any]]:
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM prescriptions WHERE patient_id = ?", (patient_id,))
        return [dict(r) for r in cursor.fetchall()]

def get_dispense_orders(limit: int = 20) -> List[Dict[str, Any]]:
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
