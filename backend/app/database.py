"""
Database layer for PharmaRefill AI (RxTriage).
Implements SQLite schema version 2.0.0 with foreign keys, generated columns, and pre-seeded demo records.
"""
import sqlite3
import os
from contextlib import contextmanager
from typing import Generator
from app.config import settings

DDL_SCHEMA = """
PRAGMA foreign_keys = ON;

-- Patients Master Table
CREATE TABLE IF NOT EXISTS patients (
    patient_id TEXT PRIMARY KEY,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    dob DATE NOT NULL,
    primary_phone TEXT UNIQUE NOT NULL, -- E.164 formatted (+1XXXXXXXXXX)
    street_address TEXT,
    insurance_carrier TEXT,
    insurance_member_id TEXT,
    is_med_sync_enrolled BOOLEAN DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Prescriptions Table with DEA Schedule & Controlled Substance Flag
CREATE TABLE IF NOT EXISTS prescriptions (
    rx_number TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,
    drug_name TEXT NOT NULL,
    strength TEXT NOT NULL,
    dosage_form TEXT NOT NULL, -- e.g., 'Tablet', 'Capsule', 'Inhaler'
    dea_schedule INTEGER NOT NULL DEFAULT 0, -- 0 = Non-controlled, 2 = Sched II, 3 = Sched III, 4 = Sched IV, 5 = Sched V
    is_controlled_substance BOOLEAN GENERATED ALWAYS AS (dea_schedule >= 2) STORED,
    refills_remaining INTEGER NOT NULL,
    days_supply INTEGER NOT NULL DEFAULT 30,
    last_fill_date DATE NOT NULL,
    next_refill_due_date DATE NOT NULL,
    copay_amount DECIMAL(10, 2) NOT NULL,
    adjudication_status TEXT NOT NULL DEFAULT 'APPROVED', -- 'APPROVED', 'REJECTED_CODE_79' (Too soon), 'REJECTED_CODE_75' (Prior Auth)
    FOREIGN KEY(patient_id) REFERENCES patients(patient_id)
);

-- Inbound Call Sessions & Telemetry
CREATE TABLE IF NOT EXISTS call_sessions (
    session_id TEXT PRIMARY KEY,
    caller_phone TEXT NOT NULL,
    ani_match_patient_id TEXT,
    consent_acknowledged BOOLEAN DEFAULT 0,
    caller_verified BOOLEAN DEFAULT 0,
    auth_method TEXT, -- 'PASSIVE_ANI_MATCH', 'MANUAL_DOB_FALLBACK', 'FAILED'
    retry_count INTEGER DEFAULT 0,
    call_status TEXT NOT NULL DEFAULT 'IN_PROGRESS', -- 'IN_PROGRESS', 'COMPLETED', 'ESCALATED', 'ESCALATED_DEA', 'ESCALATED_EMERGENCY', 'ESCALATED_RETRY_LIMIT'
    escalation_reason TEXT,
    pickup_committed_timestamp TEXT,
    lemur_audit_json TEXT,
    transcript_summary TEXT,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP,
    FOREIGN KEY(ani_match_patient_id) REFERENCES patients(patient_id)
);

-- Refill Execution Orders
CREATE TABLE IF NOT EXISTS dispense_orders (
    order_id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    rx_number TEXT NOT NULL,
    patient_id TEXT NOT NULL,
    status TEXT NOT NULL, -- 'QUEUED_FOR_FILL', 'BLOCKED_DEA_REVIEW', 'BLOCKED_ADJUDICATION', 'EMERGENCY_HALT'
    copay_charged DECIMAL(10, 2),
    pickup_date DATE,
    pickup_slot TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(session_id) REFERENCES call_sessions(session_id),
    FOREIGN KEY(rx_number) REFERENCES prescriptions(rx_number),
    FOREIGN KEY(patient_id) REFERENCES patients(patient_id)
);
"""

def get_db_path() -> str:
    return settings.DATABASE_PATH

@contextmanager
def get_db_connection() -> Generator[sqlite3.Connection, None, None]:
    conn = sqlite3.connect(get_db_path())
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    try:
        yield conn
    finally:
        conn.close()

def init_db(seed_data: bool = True):
    """Initializes the database tables and populates with verified demo data."""
    db_path = get_db_path()
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.executescript(DDL_SCHEMA)
        
        if seed_data:
            seed_demo_records(conn)
        conn.commit()

def seed_demo_records(conn: sqlite3.Connection):
    """Inserts pre-seeded hackathon demo patients and prescriptions."""
    cursor = conn.cursor()
    
    # Check if Eleanor Vance already exists
    cursor.execute("SELECT COUNT(*) FROM patients WHERE patient_id = 'PAT-1001'")
    if cursor.fetchone()[0] > 0:
        return  # Already seeded
    
    # 1. Eleanor Vance (Primary Demo Patient - Chronic Elderly)
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
    
    # 2. Robert Chen (Secondary Patient - For doctor/prior auth demo)
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
    
    # Rx 1: Atorvastatin (Maintenance, Due Today, Sched 0)
    cursor.execute("""
    INSERT OR REPLACE INTO prescriptions (
        rx_number, patient_id, drug_name, strength, dosage_form,
        dea_schedule, refills_remaining, days_supply,
        last_fill_date, next_refill_due_date, copay_amount, adjudication_status
    ) VALUES (
        'RX-4829103', 'PAT-1001', 'Atorvastatin Calcium', '20mg', 'Tablet',
        0, 2, 30, date('now', '-30 days'), date('now'), 12.40, 'APPROVED'
    )
    """)

    # Rx 2: Metformin (Maintenance, Due in 5 Days, Med-Sync candidate)
    cursor.execute("""
    INSERT OR REPLACE INTO prescriptions (
        rx_number, patient_id, drug_name, strength, dosage_form,
        dea_schedule, refills_remaining, days_supply,
        last_fill_date, next_refill_due_date, copay_amount, adjudication_status
    ) VALUES (
        'RX-4829104', 'PAT-1001', 'Metformin HCl', '500mg', 'Tablet',
        0, 3, 30, date('now', '-25 days'), date('now', '+5 days'), 4.00, 'APPROVED'
    )
    """)

    # Rx 3: Lisinopril (Maintenance, Due in 6 Days, Med-Sync candidate)
    cursor.execute("""
    INSERT OR REPLACE INTO prescriptions (
        rx_number, patient_id, drug_name, strength, dosage_form,
        dea_schedule, refills_remaining, days_supply,
        last_fill_date, next_refill_due_date, copay_amount, adjudication_status
    ) VALUES (
        'RX-4829105', 'PAT-1001', 'Lisinopril', '10mg', 'Tablet',
        0, 1, 30, date('now', '-24 days'), date('now', '+6 days'), 3.50, 'APPROVED'
    )
    """)

    # Rx 4: Oxycodone (Schedule II Controlled Substance - DEMO TRIGGER FOR DEA HARD BLOCK)
    cursor.execute("""
    INSERT OR REPLACE INTO prescriptions (
        rx_number, patient_id, drug_name, strength, dosage_form,
        dea_schedule, refills_remaining, days_supply,
        last_fill_date, next_refill_due_date, copay_amount, adjudication_status
    ) VALUES (
        'RX-9900112', 'PAT-1001', 'Oxycodone-Acetaminophen', '5-325mg', 'Tablet',
        2, 1, 30, date('now', '-29 days'), date('now', '+1 day'), 15.00, 'APPROVED'
    )
    """)
    
    # Rx 5: Robert's Omeprazole (Prior Auth rejection demo candidate)
    cursor.execute("""
    INSERT OR REPLACE INTO prescriptions (
        rx_number, patient_id, drug_name, strength, dosage_form,
        dea_schedule, refills_remaining, days_supply,
        last_fill_date, next_refill_due_date, copay_amount, adjudication_status
    ) VALUES (
        'RX-7718291', 'PAT-1002', 'Omeprazole DR', '40mg', 'Capsule',
        0, 0, 30, date('now', '-45 days'), date('now', '-15 days'), 25.00, 'REJECTED_CODE_75'
    )
    """)
    
    conn.commit()

def reset_db():
    """Resets tables for testing / clean demo state."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM dispense_orders;")
        cursor.execute("DELETE FROM prescriptions;")
        cursor.execute("DELETE FROM call_sessions;")
        cursor.execute("DELETE FROM patients;")
        conn.commit()
        seed_demo_records(conn)
