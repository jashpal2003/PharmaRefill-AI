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

export interface ExtractedDrugItem {
  drug_name: string;
  strength?: string;
  action_performed: string;
  controlled_substance_detected: boolean;
}

export interface LeMURAudit {
  patient_full_name?: string;
  patient_dob?: string;
  caller_phone: string;
  consent_obtained: boolean;
  adverse_reaction_detected: boolean;
  adverse_reaction_summary?: string;
  medications_processed: ExtractedDrugItem[];
  total_copay_disclosed?: string;
  pickup_commitment_slot?: string;
  pharmacist_action_items: string[];
}

export interface CallSession {
  session_id: string;
  caller_phone: string;
  ani_match_patient_id?: string;
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
}

export interface BenchmarkResult {
  dataset_name: string;
  total_reference_tokens: number;
  total_drug_entities: number;
  metrics: {
    baseline_no_boost: {
      label: string;
      substitutions: number;
      deletions: number;
      insertions: number;
      wer_percentage: number;
      drug_name_precision: number;
      error_rate_status: string;
    };
    boosted_assemblyai: {
      label: string;
      substitutions: number;
      deletions: number;
      insertions: number;
      wer_percentage: number;
      drug_name_precision: number;
      error_rate_status: string;
    };
  };
  wer_reduction_absolute: number;
  precision_gain_absolute: number;
  sample_cases: Array<{
    id: number;
    ground_truth: string;
    baseline_stt: string;
    boosted_stt: string;
    baseline_wer: number;
    boosted_wer: number;
    target_drugs: string[];
  }>;
}
