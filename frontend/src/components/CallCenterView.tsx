'use client';

import { apiFetch } from '@/lib/api';
import React, { useState, useEffect } from 'react';
import {
  PhoneCall,
  Sparkles,
  User,
  ShieldCheck,
  Calendar,
  ArrowUpRight,
  ShieldAlert,
  FileText,
  HeartPulse,
  AlertTriangle,
  Pill,
  ChevronDown,
  ChevronUp,
  Activity,
  CheckCircle2
} from 'lucide-react';
import { LiveCallMonitor } from './LiveCallMonitor';
import { CallQueuePanel } from './CallQueuePanel';
import { Patient, TranscriptMessage, TokenItem } from '@/lib/types';

interface Interaction {
  drug_pair: string[];
  severity: string;
  clinical_effect: string;
  recommendation: string;
  evidence_level: string;
}

interface DdiResponse {
  patient_id: string;
  patient_name: string;
  total_active_medications: number;
  overall_interaction_risk: string;
  interactions: Interaction[];
  clinical_pharmacist_reviewer: string;
}

interface PdmpResponse {
  patient_id: string;
  total_mme_daily: number;
  mme_threshold_status: string;
  pdmp_state_registry: string;
  dea_rule_enforced: string;
}

interface CallCenterViewProps {
  activeSessionId: string | null;
  activeState: string;
  isAgentSpeaking: boolean;
  transcript: TranscriptMessage[];
  recentTokens: TokenItem[];
  retryCount: number;
  selectedPatient: Patient | null;
  onOpenPhoneModal: () => void;
  onOpenSoapModal?: () => void;
}

export const CallCenterView: React.FC<CallCenterViewProps> = ({
  activeSessionId,
  activeState,
  isAgentSpeaking,
  transcript,
  recentTokens,
  retryCount,
  selectedPatient,
  onOpenPhoneModal,
  onOpenSoapModal
}) => {
  const isLive = Boolean(activeSessionId) || activeState !== 'DISCONNECTED';
  const patientId = selectedPatient?.patient_id || 'PAT-1001';

  const [ddiData, setDdiData] = useState<DdiResponse | null>(null);
  const [pdmpData, setPdmpData] = useState<PdmpResponse | null>(null);
  const [showAllDdi, setShowAllDdi] = useState(false);

  useEffect(() => {
    const fetchClinicalData = async () => {
      try {
        const [ddiRes, pdmpRes] = await Promise.all([
          apiFetch(`/api/clinical/ddi-check/${patientId}`),
          apiFetch(`/api/clinical/pdmp/${patientId}`)
        ]);
        if (ddiRes.ok) {
          const ddi = await ddiRes.json();
          setDdiData(ddi);
        }
        if (pdmpRes.ok) {
          const pdmp = await pdmpRes.json();
          setPdmpData(pdmp);
        }
      } catch (e) {
        console.error('Error fetching DDI / PDMP telemetry:', e);
      }
    };
    fetchClinicalData();
  }, [patientId]);

  return (
    <div className="flex-1 flex flex-col gap-6 p-6 min-h-0">
      {/* Executive Quick Telemetry & Action Bar */}
      <div className="glass-panel-elevated rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 border border-slate-800/80 shadow-md shrink-0">
        <div className="flex items-center gap-3.5">
          <div className="relative">
            <div className="h-11 w-11 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 p-[1px] shadow-md shadow-blue-600/20">
              <div className="h-full w-full rounded-2xl bg-[#0F172A] flex items-center justify-center">
                <HeartPulse className="h-5 w-5 text-blue-400" />
              </div>
            </div>
            {isLive && (
              <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500"></span>
              </span>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-white tracking-tight">
                Live Clinical Inbound Triage Sentinel
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700/60">
                Cartesia Sonic-2 TTS
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700/60">
                AssemblyAI Universal-2
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Autonomous clinical conversational AI agent enforcing DEA Title 21 § 1306, Med-Sync synchronization & copay locking.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto justify-end">
          {onOpenSoapModal && (
            <button
              onClick={onOpenSoapModal}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-purple-950/60 hover:bg-purple-900/60 text-purple-300 border border-purple-500/40 text-xs font-semibold transition cursor-pointer"
            >
              <FileText className="h-3.5 w-3.5" />
              <span>Generate SOAP Note</span>
            </button>
          )}

          <button
            onClick={onOpenPhoneModal}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition shadow-md shadow-blue-600/25 active:scale-95 cursor-pointer"
          >
            <PhoneCall className="h-4 w-4" />
            <span>Launch Inbound Softphone Simulator</span>
          </button>
        </div>
      </div>

      {/* Main Call Center Grid (2 Columns) */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0">
        {/* Left 7 Columns: Real-Time Audio Visualizer & Live Transcript Feed */}
        <div className="lg:col-span-7 flex flex-col h-full min-h-0 overflow-hidden">
          <div className="mb-4"><CallQueuePanel /></div>
          <LiveCallMonitor
            activeSessionId={activeSessionId}
            activeState={activeState}
            isAgentSpeaking={isAgentSpeaking}
            transcript={transcript}
            recentTokens={recentTokens}
            retryCount={retryCount}
          />
        </div>

        {/* Right 5 Columns: Active Caller EHR Profile & Clinical Scenario Launchers */}
        <div className="lg:col-span-5 flex flex-col gap-5 overflow-y-auto pr-1">
          {/* Active Caller Telemetry Card */}
          <div className="glass-panel-elevated rounded-2xl p-5 border border-slate-800/80 shadow-md">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 text-xs mb-3.5">
              <span className="font-bold text-slate-200 flex items-center gap-2">
                <User className="h-4 w-4 text-blue-400" />
                Active Caller EHR Telemetry
              </span>
              <span className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full border ${
                isLive
                  ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                  : 'bg-slate-900 border-slate-800 text-slate-400'
              }`}>
                {isLive ? 'Active Telephony Inbound' : 'Standby / Verified Match'}
              </span>
            </div>

            {/* Profile Overview Pill */}
            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-950/50 border border-slate-800/80 mb-3.5">
              <div className="h-10 w-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-300 font-bold text-sm">
                {selectedPatient ? selectedPatient.first_name[0] : 'E'}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-white text-sm truncate">
                    {selectedPatient ? `${selectedPatient.first_name} ${selectedPatient.last_name}` : 'No patient selected'}
                  </h3>
                  <span className="text-[10px] font-mono text-slate-400">
                    {selectedPatient?.patient_id || 'PAT-1001'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 truncate">
                  DOB: {selectedPatient?.dob || '1958-04-12'} (Age 68) • Female
                </p>
              </div>
            </div>

            {/* Clinical Telemetry Fields */}
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/40 border border-slate-800/60">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <PhoneCall className="h-3.5 w-3.5 text-slate-500" />
                  Inbound ANI Phone:
                </span>
                <span className="font-mono text-slate-200 font-semibold">
                  {selectedPatient?.primary_phone || '+1 (415) 555-0192'}
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/40 border border-slate-800/60">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-slate-500" />
                  Primary Payer:
                </span>
                <span className="text-slate-200 font-medium">
                  {selectedPatient?.insurance_carrier || 'BlueCross Medicare Advantage'}
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/40 border border-slate-800/60">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-slate-500" />
                  Med-Sync Status:
                </span>
                <span className="font-semibold px-2 py-0.5 rounded-md text-[11px] bg-slate-800 text-slate-200 border border-slate-700/60">
                  {selectedPatient?.is_med_sync_enrolled ? 'Enrolled (Synchronized)' : 'Eligible for 7-Day Sync'}
                </span>
              </div>

              {/* PDMP & Controlled Substance Sentinel */}
              <div className="p-2.5 rounded-xl bg-amber-950/20 border border-amber-500/30 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-amber-400 font-medium flex items-center gap-1.5 text-[11px]">
                    <ShieldAlert className="h-3.5 w-3.5 text-amber-500" />
                    PDMP MME / DEA Guardrail:
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-950/60 border border-amber-500/40 text-amber-300 font-bold">
                    {pdmpData ? `${pdmpData.total_mme_daily} MME/day` : '—'}
                  </span>
                </div>
                <p className="text-[10px] text-amber-300/80 leading-relaxed">
                  Title 21 CFR § 1306 Enforced: Schedule II Oxycodone requires electronic prescriber order. Refills blocked.
                </p>
              </div>
            </div>
          </div>

          {/* Real-time Drug-Drug Interaction (DDI) Sentinel Card */}
          <div className="glass-panel-elevated rounded-2xl p-5 border border-slate-800/80 shadow-md space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/80 text-xs">
              <span className="font-bold text-slate-200 flex items-center gap-2">
                <Pill className="h-4 w-4 text-blue-400" />
                DDI Sentinel & Cross-Reaction Monitor
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950/60 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                {ddiData?.overall_interaction_risk?.replace(/_/g, ' ') || 'Loading…'}
              </span>
            </div>

            <p className="text-[11px] text-slate-400">
              Active surveillance over {ddiData?.total_active_medications ?? 0} active prescriptions for {selectedPatient ? selectedPatient.first_name : 'the selected patient'}:
            </p>

            {/* DDI Interaction List */}
            <div className="space-y-2">
              {ddiData?.interactions.slice(0, showAllDdi ? undefined : 2).map((item, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-xl bg-slate-950/50 border border-slate-800/80 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-[11px]">
                      {item.drug_pair.join(' + ')}
                    </span>
                    <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                      item.severity === 'MODERATE'
                        ? 'bg-amber-950/60 text-amber-300 border border-amber-500/30'
                        : 'bg-blue-950/60 text-blue-300 border border-blue-500/30'
                    }`}>
                      {item.severity}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-300">
                    {item.clinical_effect}
                  </p>
                  <p className="text-[10px] text-slate-400 italic">
                    Guidance: {item.recommendation}
                  </p>
                </div>
              ))}
            </div>

            {ddiData && ddiData.interactions.length > 2 && (
              <button
                onClick={() => setShowAllDdi(!showAllDdi)}
                className="w-full text-center py-1 text-[11px] text-blue-400 hover:text-blue-300 flex items-center justify-center gap-1 transition"
              >
                <span>{showAllDdi ? 'Show Fewer Interactions' : `Show All ${ddiData.interactions.length} Checked Pairs`}</span>
                {showAllDdi ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>
            )}
          </div>

          {/* Clinical Scenario Launcher Card */}
          <div className="glass-panel-elevated rounded-2xl p-5 border border-slate-800/80 shadow-md">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 text-xs mb-3">
              <span className="font-bold text-slate-200 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-blue-400" />
                Conversational Voice Test Scenarios
              </span>
              <span className="text-[10px] text-slate-400 font-mono">1-Click Live Test</span>
            </div>

            <p className="text-xs text-slate-400 mb-3.5">
              Launch Cartesia Sonic-2 conversational simulation to test clinical decision guardrails:
            </p>

            <div className="space-y-2.5 text-xs">
              {/* Scenario 1: Refill + Med-Sync */}
              <button
                onClick={onOpenPhoneModal}
                className="w-full text-left p-3 rounded-xl border border-slate-800 bg-slate-900/60 hover:border-blue-500/40 hover:bg-slate-800/60 transition cursor-pointer flex items-center justify-between group shadow-sm"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-blue-400" />
                    <span className="font-semibold text-white group-hover:text-blue-300">
                      1. Standard Refill + Med-Sync Alignment
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 pl-4">
                    Refill Atorvastatin 20mg, synchronize Metformin & Lisinopril, lock $19.90 copay for Friday pickup.
                  </p>
                </div>
                <ArrowUpRight className="h-4 w-4 text-slate-500 group-hover:text-blue-400 shrink-0 ml-2" />
              </button>

              {/* Scenario 2: DEA Schedule II Block */}
              <button
                onClick={onOpenPhoneModal}
                className="w-full text-left p-3 rounded-xl border border-slate-800 bg-slate-900/60 hover:border-amber-500/40 hover:bg-slate-800/60 transition cursor-pointer flex items-center justify-between group shadow-sm"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-amber-400" />
                    <span className="font-semibold text-white group-hover:text-amber-300">
                      2. DEA Schedule II Hard Block (Title 21 § 1306)
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 pl-4">
                    Patient asks for Oxycodone 10mg refill; AI agent strictly blocks automated refill and notifies clinician.
                  </p>
                </div>
                <ArrowUpRight className="h-4 w-4 text-slate-500 group-hover:text-amber-400 shrink-0 ml-2" />
              </button>

              {/* Scenario 3: Emergency Sentinel */}
              <button
                onClick={onOpenPhoneModal}
                className="w-full text-left p-3 rounded-xl border border-slate-800 bg-slate-900/60 hover:border-rose-500/40 hover:bg-slate-800/60 transition cursor-pointer flex items-center justify-between group shadow-sm"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-rose-400" />
                    <span className="font-semibold text-white group-hover:text-rose-300">
                      3. Acute Anaphylaxis Emergency Transfer
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 pl-4">
                    Patient mentions chest tightness & throat swelling; agent triggers immediate emergency protocol.
                  </p>
                </div>
                <ArrowUpRight className="h-4 w-4 text-slate-500 group-hover:text-rose-400 shrink-0 ml-2" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
