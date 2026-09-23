export interface Patient {
  patient_id: string;
  first_name: string;
  last_name: string;
  dob: string;
  primary_phone: string;
  street_address?: string;
  insurance_carrier?: string;
  insurance_member_id?: string;
  is_med_sync_enrolled?: boolean;
}

export interface Prescription {
  rx_number: string;
  patient_id: string;
  drug_name: string;
  strength: string;
  dosage_form: string;
  dea_schedule: number;
  is_controlled_substance: boolean;
  refills_remaining: number;
  days_supply: number;
  last_fill_date: string;
  next_refill_due_date: string;
  copay_amount: number;
  adjudication_status: string;
  directions?: string;
}

export interface DispenseOrder {
  order_id: string;
  session_id: string;
  rx_number: string;
  patient_id: string;
  status: 'QUEUED_FOR_FILL' | 'BLOCKED_DEA_REVIEW' | 'BLOCKED_ADJUDICATION' | 'EMERGENCY_HALT' | 'DISPENSED';
  copay_charged: number;
  pickup_date: string;
  pickup_slot: string;
  created_at: string;
  drug_name?: string;
  strength?: string;
  dosage_form?: string;
  dea_schedule?: number;
  first_name?: string;
  last_name?: string;
}

export interface Consultation {
  consultation_id: string;
  patient_id: string;
  pharmacist_name: string;
  consultation_type: string;
  scheduled_time: string;
  status: string;
  notes?: string;
  created_at?: string;
  first_name?: string;
  last_name?: string;
  primary_phone?: string;
  reason?: string;
  patient_name?: string;
}

export interface BillingAccount {
  patient_id: string;
  outstanding_balance: number;
  card_brand?: string;
  card_last_four?: string;
  card_last4?: string;
  card_exp?: string;
  auto_pay_enabled?: boolean;
  insurance_provider?: string;
  bin?: string;
  pcn?: string;
  group_number?: string;
  last_payment_date?: string;
  last_payment_amount?: number;
}

export interface PharmacyInfo {
  name?: string;
  address?: string;
  phone?: string;
  hours?: string;
  drive_thru?: string;
  hours_mon_fri?: string;
  hours_sat?: string;
  hours_sun?: string;
  drive_thru_hours?: string;
  vaccines_available?: string;
  delivery_policy?: string;
  [key: string]: string | undefined;
}

export interface ExtractedDrugItem {
  drug_name: string;
  strength?: string;
  action_type: string;
  is_controlled: boolean;
}

// Mirrors backend ClinicalCallAudit (assemblyai_service.py)
export interface LeMURAudit {
  patient_full_name?: string | null;
  patient_dob?: string | null;
  consent_disclosed: boolean;
  emergency_adverse_reaction_detected: boolean;
  adverse_reaction_summary?: string | null;
  medications_processed: ExtractedDrugItem[];
  total_copay_disclosed?: string | null;
  pickup_window_committed?: string | null;
  pharmacist_action_items: string[];
  audit_engine?: string;
}

export interface CallSession {
  session_id: string;
  caller_phone: string;
  ani_match_patient_id?: string;
  patient_id?: string;
  consent_acknowledged: boolean;
  caller_verified: boolean;
  auth_method?: string;
  retry_count: number;
  call_status: string;
  escalation_reason?: string;
  pickup_committed_timestamp?: string;
  lemur_audit_json?: string;
  lemur_audit?: LeMURAudit;
  started_at: string;
  created_at?: string;
  ended_at?: string;
  first_name?: string;
  last_name?: string;
  dob?: string;
}

export interface DashboardSummary {
  total_calls: number;
  completed_calls: number;
  dea_blocks: number;
  adverse_events: number;
  queued_orders: number;
  total_copay_volume: number;
  med_sync_retention_rate: string;
  rts_reduction: string;
  ai_containment_rate?: string;
  average_pdc?: string;
}

export interface TokenItem {
  text: string;
  confidence: number;
  is_word_boost_match: boolean;
}

export interface TranscriptMessage {
  id: string;
  speaker: 'CALLER' | 'AGENT' | 'SYSTEM';
  text: string;
  timestamp: string;
  tokens?: TokenItem[];
  confidence?: number;
  isEscalation?: boolean;
  audioBase64?: string;
  sttEngine?: string;
}

export interface BenchmarkResult {
  mode: 'LIVE_AUDIO' | 'REFERENCE';
  is_measured: boolean;
  disclaimer: string | null;
  dataset_name: string;
  samples: number;
  metrics: {
    baseline_no_boost: { label: string; wer_percentage: number; drug_name_precision: number };
    boosted_assemblyai: { label: string; wer_percentage: number; drug_name_precision: number };
  };
  wer_reduction_absolute: number;
  sample_cases: Array<{
    id: number;
    ground_truth: string;
    baseline_output: string;
    boosted_output: string;
    baseline_wer: number;
    boosted_wer: number;
    baseline_entity_recall: number;
    boosted_entity_recall: number;
  }>;
}
