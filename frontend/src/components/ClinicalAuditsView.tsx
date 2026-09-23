'use client';

import React, { useState } from 'react';
import {
  FileCheck,
  ShieldAlert,
  AlertTriangle,
  Download,
  Activity,
  CheckCircle2,
  Clock,
  Sparkles,
  BarChart2,
  Search,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  FileText
} from 'lucide-react';
import { CallSession, DispenseOrder } from '@/lib/types';

interface ClinicalAuditsViewProps {
  sessions: CallSession[];
  orders: DispenseOrder[];
  deaAlert: { active: boolean; medication?: any; reason?: string };
  emergencyAlert: { active: boolean; warning?: string };
  latestAudit: any;
  onOpenBenchmarkModal: () => void;
  onExportFhir: () => void;
  onRefresh: () => void;
}

export const ClinicalAuditsView: React.FC<ClinicalAuditsViewProps> = ({
  sessions,
  orders,
  deaAlert,
  emergencyAlert,
  latestAudit,
  onOpenBenchmarkModal,
  onExportFhir,
  onRefresh
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  const blockedDeaOrders = orders.filter(
    (o) => o.status === 'BLOCKED_DEA_REVIEW'
  );

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0B1120] p-6 overflow-y-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-blue-400 uppercase">
            <FileCheck className="h-4 w-4" />
            <span>Regulatory Compliance & LLM Intelligence</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-100 mt-1">Clinical Safety & LLM Call Audits</h1>
          <p className="text-sm text-slate-400">
            Real-time Title 21 CFR § 1306 compliance monitors, AssemblyAI LLM Gateway call audits, and HL7 FHIR exports.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={onOpenBenchmarkModal}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-300 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-lg transition-colors"
          >
            <BarChart2 className="h-4 w-4 text-cyan-400" />
            <span>WER Benchmark</span>
          </button>
          <button
            onClick={onExportFhir}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-950 bg-gradient-to-r from-cyan-400 to-teal-300 hover:from-cyan-300 hover:to-teal-200 rounded-lg shadow-md shadow-cyan-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Download className="h-4 w-4" />
            <span>Export HL7 FHIR Bundle</span>
          </button>
        </div>
      </div>

      {/* Real-Time Safety Banners */}
      {(emergencyAlert?.active || deaAlert?.active) && (
        <div className="space-y-3">
          {emergencyAlert?.active && (
            <div className="p-4 rounded-xl bg-red-950/60 border border-red-500/50 flex items-start gap-3 shadow-lg shadow-red-950/40 animate-pulse">
              <ShieldAlert className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-bold text-red-200">
                  Critical Acute Adverse Reaction Sentinel Triggered
                </div>
                <div className="text-xs text-red-300/90 mt-0.5">
                  {emergencyAlert.warning || 'Severe adverse event reported during conversational triage.'}
                </div>
                <div className="text-[11px] text-red-400 font-mono mt-1">
                  Protocol: Immediate 911 Triage & Warm Transfer to Emergency Clinician
                </div>
              </div>
            </div>
          )}

          {deaAlert?.active && (
            <div className="p-4 rounded-xl bg-amber-950/60 border border-amber-500/50 flex items-start gap-3 shadow-lg shadow-amber-950/40">
              <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-bold text-amber-200">
                  Title 21 CFR § 1306 Controlled Substance Regulatory Stop
                </div>
                <div className="text-xs text-amber-300/90 mt-0.5">
                  {deaAlert.reason || 'Federal regulations strictly prohibit automatic refills for Schedule II narcotics.'}
                </div>
                <div className="text-[11px] text-amber-400 font-mono mt-1">
                  Enforcement: Schedule II narcotic refills blocked from automated IVR dispensing.
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/70 border border-slate-800/80 rounded-xl p-4 flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-slate-400">Clinical Accuracy (WER)</div>
            <div className="text-sm font-bold text-emerald-400 mt-1">See benchmark</div>
            <div className="text-[11px] text-emerald-400/80 mt-0.5">Measured only with real audio clips</div>
          </div>
          <div className="h-10 w-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-slate-900/70 border border-slate-800/80 rounded-xl p-4 flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-slate-400">DEA Schedule II Hard Stops</div>
            <div className="text-2xl font-bold text-amber-400 mt-1">{blockedDeaOrders.length} Lock</div>
            <div className="text-[11px] text-amber-400/80 mt-0.5">Blocked from automated refill</div>
          </div>
          <div className="h-10 w-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <ShieldAlert className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-slate-900/70 border border-slate-800/80 rounded-xl p-4 flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-slate-400">Latest Audit Engine</div>
            <div className="text-sm font-bold text-cyan-300 mt-1">{latestAudit?.audit_engine || 'No audit yet'}</div>
            <div className="text-[11px] text-cyan-400/80 mt-0.5">Falls back to deterministic extraction</div>
          </div>
          <div className="h-10 w-10 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
            <Sparkles className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-slate-900/70 border border-slate-800/80 rounded-xl p-4 flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-slate-400">Total Audited Sessions</div>
            <div className="text-2xl font-bold text-slate-100 mt-1">{sessions.length}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Full transcript & entity logging</div>
          </div>
          <div className="h-10 w-10 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
            <Activity className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Main 2-Column Split: Latest LeMUR Audit & Full Audit Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Latest LeMUR Post-Call Audit Card */}
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-cyan-400" />
              <h2 className="text-sm font-bold text-slate-100">Post-Call LLM Audit Feed</h2>
            </div>
            <span className="text-[10px] font-mono text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/30">
              AssemblyAI LLM Gateway
            </span>
          </div>

          {latestAudit ? (
            <div className="space-y-4">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1 text-xs">
                <div className="font-semibold text-slate-300">{latestAudit.patient_full_name || 'Unverified caller'}{latestAudit.patient_dob ? ` · DOB ${latestAudit.patient_dob}` : ''}</div>
                <div className="text-slate-400">Consent disclosed: {latestAudit.consent_disclosed ? 'yes' : 'no'} · Engine: {latestAudit.audit_engine || 'n/a'}</div>
                {latestAudit.emergency_adverse_reaction_detected && <div className="text-rose-300 font-semibold">Adverse reaction reported: {latestAudit.adverse_reaction_summary}</div>}
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block mb-1 text-[11px]">Medications processed:</span>
                  {(latestAudit.medications_processed || []).map((m: any, i: number) => (
                    <div key={i} className="font-semibold text-emerald-400">{m.drug_name} {m.strength} · {m.action_type}</div>
                  ))}
                  {!latestAudit.medications_processed?.length && <span className="text-slate-500">None</span>}
                </div>
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block mb-1 text-[11px]">Copay / pickup:</span>
                  <span className="font-semibold text-cyan-300">{latestAudit.total_copay_disclosed || '—'} · {latestAudit.pickup_window_committed || 'no pickup committed'}</span>
                </div>
              </div>

              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1.5 text-xs">
                <div className="text-slate-400 font-semibold text-[11px]">Action items extracted:</div>
                <ul className="text-slate-300 text-xs list-disc pl-4">
                  {(latestAudit.pharmacist_action_items || []).map((a: string, i: number) => <li key={i}>{a}</li>)}
                  {!latestAudit.pharmacist_action_items?.length && <li className="list-none -ml-4 text-slate-500">None</li>}
                </ul>
              </div>
            </div>
          ) : (
            <div className="bg-slate-950 p-6 rounded-xl border border-slate-800 text-center space-y-2">
              <Clock className="h-8 w-8 text-slate-600 mx-auto" />
              <div className="text-sm font-medium text-slate-300">Awaiting Inbound Call Completion</div>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                Once a caller hangs up or completes an interaction, the LLM auditor will summarize the clinical dialogue in real-time.
              </p>
            </div>
          )}
        </div>

        {/* DEA Schedule II Compliance & Safety Ledger */}
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-amber-400" />
              <h2 className="text-sm font-bold text-slate-100">DEA Title 21 CFR § 1306 Sentinel Log</h2>
            </div>
            <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
              Title 21 Active
            </span>
          </div>

          <p className="text-xs text-slate-400">
            Federal law strictly prohibits automated voice agent refills of Schedule II controlled substances without written electronic prescriptions from an authorized DEA prescriber.
          </p>

          <div className="space-y-3">
            {blockedDeaOrders.map((o) => (
              <div key={o.order_id} className="p-3.5 bg-slate-950 rounded-xl border border-amber-500/30 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-200">{o.drug_name} {o.strength} (C-{o.dea_schedule})</span>
                  <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                    {o.status}
                  </span>
                </div>
                <div className="text-xs text-slate-400">
                  Patient: {o.first_name} {o.last_name} ({o.patient_id}) • Rx #{o.rx_number} • Session {o.session_id}
                </div>
              </div>
            ))}
            {!blockedDeaOrders.length && (
              <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-500">
                No controlled-substance requests have been blocked yet.
              </div>
            )}

            <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-200">Acute Adverse Reaction Sentinel</span>
                <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  SENTINEL_ARMED
                </span>
              </div>
              <div className="text-xs text-slate-400">
                Monitors keywords: "chest pain", "swelling", "can't breathe", "anaphylaxis", "throat closing"
              </div>
              <div className="text-[11px] text-slate-400 bg-slate-900 p-2 rounded border border-slate-800 font-mono">
                Immediate protocol: Hangs up automated flow, initiates urgent warm transfer or advises 911 triage.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Historical Call Sessions Audit Log */}
      <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <h2 className="text-sm font-bold text-slate-100">Historical Call Telephony & Audit Sessions</h2>
            <p className="text-xs text-slate-400">
              Traceable logs of every phone interaction, ANI matches, and clinical adjudications.
            </p>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search session ID or caller..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="p-3">Session ID</th>
                <th className="p-3">Caller Phone (ANI)</th>
                <th className="p-3">Patient ID</th>
                <th className="p-3">Status</th>
                <th className="p-3">Escalation Reason</th>
                <th className="p-3">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {sessions.map((s) => (
                <tr key={s.session_id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="p-3 font-mono text-cyan-400">{s.session_id}</td>
                  <td className="p-3 font-mono text-slate-300">{s.caller_phone}</td>
                  <td className="p-3 font-mono text-slate-400">{s.patient_id || 'PAT-1001'}</td>
                  <td className="p-3">
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase ${
                        s.call_status === 'COMPLETED'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          : s.call_status === 'ESCALATED'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {s.call_status}
                    </span>
                  </td>
                  <td className="p-3 text-slate-400">
                    {s.escalation_reason ? (
                      <span className="text-amber-400 font-medium">{s.escalation_reason}</span>
                    ) : (
                      'None (Auto-Resolved)'
                    )}
                  </td>
                  <td className="p-3 text-slate-500 font-mono text-[11px]">{s.created_at}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
