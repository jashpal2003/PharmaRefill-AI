-- RxTriage AI schema for Supabase Postgres.
-- The backend runs this inside its own schema (DB_SCHEMA, default "rxtriage") with search_path set.
-- To run by hand in the SQL editor, first execute:  create schema if not exists rxtriage; set search_path to rxtriage;
-- The schema is NOT exposed through the Supabase Data API, and RLS is enabled with no policies, so the
-- publishable (anon) key can never read PHI. Only the backend's direct Postgres connection can.

CREATE TABLE IF NOT EXISTS patients (
    patient_id TEXT PRIMARY KEY,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    dob DATE NOT NULL,
    primary_phone TEXT UNIQUE NOT NULL,
    street_address TEXT,
    insurance_carrier TEXT,
    insurance_member_id TEXT,
    is_med_sync_enrolled SMALLINT DEFAULT 0,
    created_at TIMESTAMP DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS prescriptions (
    rx_number TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL REFERENCES patients(patient_id) ON DELETE CASCADE,
    drug_name TEXT NOT NULL,
    strength TEXT NOT NULL,
    dosage_form TEXT NOT NULL,
    dea_schedule INTEGER NOT NULL DEFAULT 0,
    is_controlled_substance BOOLEAN GENERATED ALWAYS AS (dea_schedule >= 2) STORED,
    refills_remaining INTEGER NOT NULL,
    days_supply INTEGER NOT NULL DEFAULT 30,
    last_fill_date DATE NOT NULL,
    next_refill_due_date DATE NOT NULL,
    copay_amount NUMERIC(10, 2) NOT NULL,
    adjudication_status TEXT NOT NULL DEFAULT 'APPROVED'
);
CREATE INDEX IF NOT EXISTS prescriptions_patient_idx ON prescriptions(patient_id);

CREATE TABLE IF NOT EXISTS call_sessions (
    session_id TEXT PRIMARY KEY,
    caller_phone TEXT NOT NULL,
    ani_match_patient_id TEXT REFERENCES patients(patient_id) ON DELETE SET NULL,
    consent_acknowledged SMALLINT DEFAULT 0,
    caller_verified SMALLINT DEFAULT 0,
    auth_method TEXT,
    retry_count INTEGER DEFAULT 0,
    call_status TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    escalation_reason TEXT,
    pickup_committed_timestamp TEXT,
    lemur_audit_json TEXT,
    started_at TIMESTAMP DEFAULT timezone('utc', now()),
    ended_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS dispense_orders (
    order_id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES call_sessions(session_id) ON DELETE CASCADE,
    rx_number TEXT NOT NULL REFERENCES prescriptions(rx_number) ON DELETE CASCADE,
    patient_id TEXT NOT NULL REFERENCES patients(patient_id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    copay_charged NUMERIC(10, 2),
    pickup_date DATE,
    pickup_slot TEXT,
    created_at TIMESTAMP DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS consultations (
    consultation_id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL REFERENCES patients(patient_id) ON DELETE CASCADE,
    pharmacist_name TEXT NOT NULL,
    consultation_type TEXT NOT NULL DEFAULT 'Medication Therapy Management',
    scheduled_time TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'SCHEDULED',
    notes TEXT,
    created_at TIMESTAMP DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS billing_accounts (
    patient_id TEXT PRIMARY KEY REFERENCES patients(patient_id) ON DELETE CASCADE,
    outstanding_balance NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    card_brand TEXT DEFAULT 'Visa',
    card_last_four TEXT DEFAULT '4242',
    last_payment_date DATE,
    last_payment_amount NUMERIC(10, 2) DEFAULT 0.00
);

CREATE TABLE IF NOT EXISTS pharmacy_info (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS patient_allergies (
    patient_id TEXT NOT NULL REFERENCES patients(patient_id) ON DELETE CASCADE,
    allergen TEXT NOT NULL,
    reaction TEXT,
    PRIMARY KEY (patient_id, allergen)
);

CREATE TABLE IF NOT EXISTS patient_conditions (
    patient_id TEXT NOT NULL REFERENCES patients(patient_id) ON DELETE CASCADE,
    condition_code TEXT NOT NULL,
    condition_name TEXT NOT NULL,
    PRIMARY KEY (patient_id, condition_code)
);

CREATE TABLE IF NOT EXISTS patient_profile_ext (
    patient_id TEXT PRIMARY KEY REFERENCES patients(patient_id) ON DELETE CASCADE,
    preferred_language TEXT NOT NULL DEFAULT 'en',
    is_pregnant SMALLINT NOT NULL DEFAULT 0,
    is_340b_eligible SMALLINT NOT NULL DEFAULT 0,
    covered_entity TEXT,
    sms_opt_out SMALLINT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS fill_history (
    fill_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    rx_number TEXT NOT NULL REFERENCES prescriptions(rx_number) ON DELETE CASCADE,
    patient_id TEXT NOT NULL,
    fill_date DATE NOT NULL,
    days_supply INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS fill_history_patient_idx ON fill_history(patient_id);

CREATE TABLE IF NOT EXISTS prior_authorizations (
    pa_id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL REFERENCES patients(patient_id) ON DELETE CASCADE,
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
    updated_at TIMESTAMP DEFAULT timezone('utc', now()),
    created_at TIMESTAMP DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS immunizations (
    immunization_id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL REFERENCES patients(patient_id) ON DELETE CASCADE,
    vaccine TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'SCHEDULED',
    scheduled_for TEXT,
    administered_at TIMESTAMP,
    lot_number TEXT,
    screening_json TEXT,
    iis_message TEXT,
    created_at TIMESTAMP DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS inventory (
    ndc TEXT NOT NULL,
    lot_number TEXT NOT NULL,
    drug_name TEXT NOT NULL,
    strength TEXT NOT NULL,
    on_hand INTEGER NOT NULL,
    reorder_point INTEGER NOT NULL,
    expiration_date DATE NOT NULL,
    unit_cost NUMERIC(10, 4) NOT NULL,
    is_340b_stock SMALLINT NOT NULL DEFAULT 0,
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
    created_at TIMESTAMP DEFAULT timezone('utc', now()),
    sent_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sdoh_screenings (
    screening_id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL REFERENCES patients(patient_id) ON DELETE CASCADE,
    answers_json TEXT NOT NULL,
    risk_flags TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS dur_overrides (
    override_id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,
    alert_key TEXT NOT NULL,
    rationale TEXT NOT NULL,
    overridden_by TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS call_metrics (
    metric_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    session_id TEXT NOT NULL,
    state TEXT,
    intent TEXT,
    language TEXT,
    stt_ms INTEGER,
    engine_ms INTEGER,
    tts_ms INTEGER,
    created_at TIMESTAMP DEFAULT timezone('utc', now())
);

-- HIPAA access log: append-only, enforced by trigger. Survives demo resets.
CREATE TABLE IF NOT EXISTS access_log (
    log_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ts TIMESTAMP DEFAULT timezone('utc', now()),
    role TEXT NOT NULL,
    user_id TEXT,
    user_email TEXT,
    method TEXT NOT NULL,
    path TEXT NOT NULL,
    patient_id TEXT,
    status_code INTEGER,
    client_ip TEXT
);
CREATE INDEX IF NOT EXISTS access_log_patient_idx ON access_log(patient_id);
CREATE INDEX IF NOT EXISTS access_log_ts_idx ON access_log(ts);

CREATE OR REPLACE FUNCTION access_log_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'access_log is append-only';
END;
$$;
DROP TRIGGER IF EXISTS access_log_no_mutation ON access_log;
CREATE TRIGGER access_log_no_mutation BEFORE UPDATE OR DELETE ON access_log
    FOR EACH ROW EXECUTE FUNCTION access_log_append_only();
DROP TRIGGER IF EXISTS access_log_no_truncate ON access_log;
CREATE TRIGGER access_log_no_truncate BEFORE TRUNCATE ON access_log
    FOR EACH STATEMENT EXECUTE FUNCTION access_log_append_only();

-- Lock down: RLS on everything, no policies, and no grants to the Data API roles.
DO $$
DECLARE t record;
BEGIN
    FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = current_schema() LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t.tablename);
    END LOOP;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA %I FROM anon, authenticated', current_schema());
        EXECUTE format('REVOKE ALL ON SCHEMA %I FROM anon, authenticated', current_schema());
    END IF;
END $$;
