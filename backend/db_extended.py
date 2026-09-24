"""
backend/db_extended.py — Clinical, payer and operations tables layered on the core schema:
allergies, conditions, fill history (PDC), prior authorizations, immunizations, inventory,
outreach campaigns, SDOH screenings, DUR overrides, call telemetry and the HIPAA access log.
"""

import sqlite3

EXTENDED_DDL = """
CREATE TABLE IF NOT EXISTS patient_allergies (
    patient_id TEXT NOT NULL,
    allergen TEXT NOT NULL,
    reaction TEXT,
    PRIMARY KEY (patient_id, allergen),
    FOREIGN KEY(patient_id) REFERENCES patients(patient_id)
);

CREATE TABLE IF NOT EXISTS patient_conditions (
    patient_id TEXT NOT NULL,
    condition_code TEXT NOT NULL,
    condition_name TEXT NOT NULL,
    PRIMARY KEY (patient_id, condition_code),
    FOREIGN KEY(patient_id) REFERENCES patients(patient_id)
);

CREATE TABLE IF NOT EXISTS patient_profile_ext (
    patient_id TEXT PRIMARY KEY,
    preferred_language TEXT NOT NULL DEFAULT 'en',
    is_pregnant BOOLEAN NOT NULL DEFAULT 0,
    is_340b_eligible BOOLEAN NOT NULL DEFAULT 0,
    covered_entity TEXT,
    sms_opt_out BOOLEAN NOT NULL DEFAULT 0,
    FOREIGN KEY(patient_id) REFERENCES patients(patient_id)
);

CREATE TABLE IF NOT EXISTS fill_history (
    fill_id INTEGER PRIMARY KEY AUTOINCREMENT,
    rx_number TEXT NOT NULL,
    patient_id TEXT NOT NULL,
    fill_date DATE NOT NULL,
    days_supply INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS prior_authorizations (
    pa_id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,
    rx_number TEXT,
    drug_name TEXT NOT NULL,
    payer TEXT NOT NULL,
    urgency TEXT NOT NULL DEFAULT 'STANDARD',
    status TEXT NOT NULL DEFAULT 'PENDING',
    clinical_justification TEXT,
    denial_reason TEXT,
    appeal_letter TEXT,
    submitted_at TIMESTAMP,
    decision_due_at TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(patient_id) REFERENCES patients(patient_id)
);

CREATE TABLE IF NOT EXISTS immunizations (
    immunization_id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,
    vaccine TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'SCHEDULED',
    scheduled_for TEXT,
    administered_at TIMESTAMP,
    lot_number TEXT,
    screening_json TEXT,
    iis_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(patient_id) REFERENCES patients(patient_id)
);

CREATE TABLE IF NOT EXISTS inventory (
    ndc TEXT NOT NULL,
    lot_number TEXT NOT NULL,
    drug_name TEXT NOT NULL,
    strength TEXT NOT NULL,
    on_hand INTEGER NOT NULL,
    reorder_point INTEGER NOT NULL,
    expiration_date DATE NOT NULL,
    unit_cost DECIMAL(10, 4) NOT NULL,
    is_340b_stock BOOLEAN NOT NULL DEFAULT 0,
    PRIMARY KEY (ndc, lot_number)
);

CREATE TABLE IF NOT EXISTS outreach_campaigns (
    campaign_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    campaign_type TEXT NOT NULL,
    message_template TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'DRAFT',
    target_count INTEGER DEFAULT 0,
    sent_count INTEGER DEFAULT 0,
    skipped_opt_out INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    sent_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sdoh_screenings (
    screening_id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,
    answers_json TEXT NOT NULL,
    risk_flags TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(patient_id) REFERENCES patients(patient_id)
);

CREATE TABLE IF NOT EXISTS dur_overrides (
    override_id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,
    alert_key TEXT NOT NULL,
    rationale TEXT NOT NULL,
    overridden_by TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS call_metrics (
    metric_id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    state TEXT,
    intent TEXT,
    language TEXT,
    stt_ms INTEGER,
    engine_ms INTEGER,
    tts_ms INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS access_log (
    log_id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    role TEXT NOT NULL,
    user_id TEXT,
    user_email TEXT,
    method TEXT NOT NULL,
    path TEXT NOT NULL,
    patient_id TEXT,
    status_code INTEGER,
    client_ip TEXT
);
CREATE TRIGGER IF NOT EXISTS access_log_no_update BEFORE UPDATE ON access_log
BEGIN SELECT RAISE(ABORT, 'access_log is append-only'); END;
CREATE TRIGGER IF NOT EXISTS access_log_no_delete BEFORE DELETE ON access_log
BEGIN SELECT RAISE(ABORT, 'access_log is append-only'); END;
"""

# Tables wiped by a demo reset. access_log is intentionally excluded (append-only).
RESETTABLE_TABLES = [
    "dur_overrides", "sdoh_screenings", "outreach_campaigns", "inventory", "immunizations",
    "prior_authorizations", "fill_history", "patient_profile_ext", "patient_conditions",
    "patient_allergies", "call_metrics", "dispense_orders", "consultations", "billing_accounts",
    "call_sessions", "prescriptions", "patients", "pharmacy_info",
]

# Days-ago offsets for each historical fill. Gaps are intentional so PDC differs by patient.
FILL_HISTORY = {
    "RX-4829103": [-180, -150, -120, -90, -60, -30],
    "RX-4829104": [-175, -145, -115, -85, -55, -25],
    "RX-4829105": [-174, -130, -84, -24],
    "RX-9900112": [-89, -59, -29],
    "RX-7718291": [-178, -148, -118, -88, -58, -28],
    "RX-7718292": [-176, -146, -116, -86, -56, -26],
    "RX-7718293": [-175, -115, -25],
    "RX-9922331": [-90, -60, -30],
    "RX-5544101": [-179, -149, -119, -89, -59, -29],
    "RX-5544102": [-110, -20],
    "RX-5544103": [-177, -120, -57, -27],
    "RX-6633201": [-178, -148, -118, -88, -58, -28],
    "RX-6633202": [-178, -118, -28],
}


def seed_extended_records(conn: sqlite3.Connection):
    cursor = conn.cursor()
    cursor.executemany("INSERT OR REPLACE INTO patient_profile_ext (patient_id, preferred_language, is_pregnant, is_340b_eligible, covered_entity, sms_opt_out) VALUES (?, ?, ?, ?, ?, ?)", [
        ("PAT-1001", "en", 0, 1, "SF Community Health Center (340B CH)", 0),
        ("PAT-1002", "en", 0, 0, None, 0),
        ("PAT-1003", "es", 0, 1, "SF Community Health Center (340B CH)", 0),
        ("PAT-1004", "en", 0, 0, None, 1),
    ])
    cursor.executemany("INSERT OR REPLACE INTO patient_allergies (patient_id, allergen, reaction) VALUES (?, ?, ?)", [
        ("PAT-1001", "Penicillin", "Hives"),
        ("PAT-1002", "Sulfonamides", "Rash"),
        ("PAT-1003", "Codeine", "Nausea / vomiting"),
    ])
    cursor.executemany("INSERT OR REPLACE INTO patient_conditions (patient_id, condition_code, condition_name) VALUES (?, ?, ?)", [
        ("PAT-1001", "E78.00", "Hyperlipidemia"),
        ("PAT-1001", "E11.9", "Type 2 diabetes mellitus"),
        ("PAT-1001", "I10", "Essential hypertension"),
        ("PAT-1001", "M54.50", "Low back pain"),
        ("PAT-1002", "K21.9", "Gastro-esophageal reflux disease"),
        ("PAT-1002", "I10", "Essential hypertension"),
        ("PAT-1002", "F32.9", "Major depressive disorder"),
        ("PAT-1002", "F90.0", "Attention-deficit hyperactivity disorder"),
        ("PAT-1003", "E03.9", "Hypothyroidism"),
        ("PAT-1003", "J45.909", "Asthma"),
        ("PAT-1003", "G62.9", "Polyneuropathy"),
        ("PAT-1004", "I10", "Essential hypertension"),
        ("PAT-1004", "E78.00", "Hyperlipidemia"),
    ])
    cursor.execute("SELECT rx_number, patient_id, days_supply FROM prescriptions")
    for rx, pid, ds in cursor.fetchall():
        for offset in FILL_HISTORY.get(rx, []):
            cursor.execute(
                "INSERT INTO fill_history (rx_number, patient_id, fill_date, days_supply) VALUES (?, ?, date('now', ?), ?)",
                (rx, pid, f"{offset} days", ds),
            )
    cursor.executemany("""
        INSERT OR REPLACE INTO inventory (ndc, lot_number, drug_name, strength, on_hand, reorder_point,
            expiration_date, unit_cost, is_340b_stock)
        VALUES (?, ?, ?, ?, ?, ?, date('now', ?), ?, ?)
    """, [
        ("00071-0156-23", "LT2291A", "Atorvastatin Calcium", "20mg", 420, 300, "+400 days", 0.0410, 0),
        ("00071-0156-23", "LT2291B", "Atorvastatin Calcium", "20mg", 90, 0, "+45 days", 0.0410, 1),
        ("00093-7212-01", "MF8810", "Metformin HCl", "500mg", 1200, 500, "+600 days", 0.0210, 0),
        ("68180-0513-01", "LS4411", "Lisinopril", "10mg", 180, 250, "+300 days", 0.0190, 0),
        ("00406-0512-01", "OX7701", "Oxycodone-Acetaminophen", "5-325mg", 60, 100, "+200 days", 0.2100, 0),
        ("62175-0118-37", "OM1120", "Omeprazole DR", "40mg", 300, 200, "+80 days", 0.0900, 0),
        ("00069-1530-68", "AM3301", "Amlodipine Besylate", "5mg", 90, 200, "+25 days", 0.0150, 0),
        ("16729-0092-17", "SR0091", "Sertraline HCl", "50mg", 240, 150, "+500 days", 0.0450, 1),
        ("00555-0788-02", "AD5520", "Adderall XR", "20mg", 0, 60, "+365 days", 2.1000, 0),
        ("00378-1805-01", "LV7750", "Levothyroxine Sodium", "75mcg", 350, 200, "+15 days", 0.1100, 1),
        ("00173-0682-20", "AL2020", "Albuterol HFA", "90mcg/actuation", 12, 20, "+280 days", 18.5000, 0),
        ("27241-0050-50", "GB3003", "Gabapentin", "300mg", 800, 300, "+700 days", 0.0600, 0),
        ("00093-7365-98", "LZ5050", "Losartan Potassium", "50mg", 260, 200, "+350 days", 0.0520, 0),
        ("00310-0751-90", "RS1010", "Rosuvastatin Calcium", "10mg", 45, 150, "+120 days", 0.0800, 0),
    ])
    cursor.executemany("""
        INSERT OR REPLACE INTO prior_authorizations (pa_id, patient_id, rx_number, drug_name, payer, urgency, status,
            clinical_justification, submitted_at, decision_due_at, denial_reason)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now', ?), datetime('now', ?), ?)
    """, [
        ("PA-2001", "PAT-1002", "RX-9922331", "Adderall XR 20mg", "Kaiser Senior Gold", "STANDARD", "SUBMITTED",
         "ADHD (F90.0) diagnosed 2019; failed methylphenidate IR trial.", "-2 days", "+5 days", None),
        ("PA-2002", "PAT-1003", "RX-5544102", "Albuterol HFA 90mcg", "Aetna Premier Choice", "URGENT", "DENIED",
         "Moderate persistent asthma (J45.909); rescue inhaler.", "-3 days", "+0 days",
         "Non-formulary brand; step therapy with generic required."),
    ])
