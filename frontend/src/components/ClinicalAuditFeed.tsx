'use client';

import React, { useState } from 'react';
import { LeMURAudit, DispenseOrder } from '@/lib/types';
import {
  FileText,
  CheckSquare,
  Printer,
  CheckCircle,
  Download,
  ShieldCheck,
  MessageSquare,
  Package,
  Sparkles,
  QrCode
} from 'lucide-react';
import { EmergencyBanner } from './EmergencyBanner';

interface ClinicalAuditFeedProps {
  deaAlert: { active: boolean; medication?: any; reason?: string };
  emergencyAlert: { active: boolean; warning?: string };
  latestAudit: LeMURAudit | null;
  orders?: DispenseOrder[];
  onDispenseAll: () => void;
  onExportFhir: () => void;
}

export const ClinicalAuditFeed: React.FC<ClinicalAuditFeedProps> = ({
  deaAlert,
  emergencyAlert,
  latestAudit,
  orders = [],
  onDispenseAll,
  onExportFhir
}) => {
  const [labelsPrinted, setLabelsPrinted] = useState(false);
  const [checkedItems, setCheckedItems] = useState<{ [idx: number]: boolean }>({});
  const [showSmsPreview, setShowSmsPreview] = useState(false);

  const toggleCheck = (idx: number) => {
    setCheckedItems(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  const handlePrintLabels = () => {
    setLabelsPrinted(true);
    setTimeout(() => setLabelsPrinted(false), 3000);
  };

  const defaultAudit: LeMURAudit = latestAudit || {
    patient_full_name: 'No completed call yet',
    patient_dob: '',
    consent_disclosed: false,
    emergency_adverse_reaction_detected: false,
    adverse_reaction_summary: undefined,
    medications_processed: [],
    total_copay_disclosed: '—',
    pickup_window_committed: '—',
    pharmacist_action_items: []
  };

  return (
    <div className="flex flex-col h-full glass-panel rounded-2xl p-5 border border-slate-800 overflow-y-auto">
      {/* Panel Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 mb-3.5">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-emerald-400" />
          <h2 className="text-sm font-semibold tracking-wide uppercase text-slate-200">
            Clinical Compliance & Audit
          </h2>
        </div>
        <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
          AssemblyAI LeMUR
        </span>
      </div>

      {/* Emergency Adverse Reaction Sentinel Alert & DEA Hard Intercept */}
      <EmergencyBanner emergencyAlert={emergencyAlert} deaAlert={deaAlert} />

      {/* LeMUR Post-Call Audit Card */}
      <div className="bg-slate-900/80 rounded-xl p-4 border border-slate-800 mb-3.5 shadow-sm">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-xs mb-3">
          <div className="flex items-center gap-1.5 text-emerald-300 font-semibold">
            <ShieldCheck className="h-4 w-4" />
            <span>Automated Clinical Compliance Audit</span>
          </div>
          {latestAudit ? (
            <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 font-medium animate-pulse">
              <Sparkles className="h-3 w-3" />
              Post-Call LLM Audit
            </span>
          ) : (
            <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
              Standby Template (Awaiting Live Call Close)
            </span>
          )}
        </div>

        {/* Audit Meta Grid */}
        <div className="grid grid-cols-2 gap-2 text-xs mb-3">
          <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800/80">
            <span className="text-slate-400 block text-[10px]">Patient</span>
            <span className="font-semibold text-slate-200">{defaultAudit.patient_full_name}</span>
          </div>
          <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800/80">
            <span className="text-slate-400 block text-[10px]">Consent Disclosed</span>
            <span className="text-emerald-400 font-semibold flex items-center gap-1">
              <CheckCircle className="h-3 w-3" /> Statutory Disclosed
            </span>
          </div>
          <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800/80">
            <span className="text-slate-400 block text-[10px]">Copay Authorized</span>
            <span className="font-mono text-cyan-300 font-bold">{defaultAudit.total_copay_disclosed}</span>
          </div>
          <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800/80">
            <span className="text-slate-400 block text-[10px]">Anti-RTS Window</span>
            <span className="font-mono text-teal-300">{defaultAudit.pickup_window_committed}</span>
          </div>
        </div>

        {/* Processed Medications */}
        <div className="mb-3">
          <span className="text-xs font-semibold text-slate-300 block mb-1.5">
            Prescriptions in Clinical Scope:
          </span>
          <div className="space-y-1.5">
            {defaultAudit.medications_processed.map((m, i) => (
              <div
                key={i}
                className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-950/60 border border-slate-800 text-xs"
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-200">{m.drug_name}</span>
                  <span className="text-[10px] text-slate-400">{m.strength}</span>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                  m.is_controlled
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : m.action_type === 'MED_SYNC'
                    ? 'bg-teal-500/20 text-teal-300'
                    : 'bg-emerald-500/20 text-emerald-300'
                }`}>
                  {m.action_type}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Actionable Pharmacist Checklist */}
        <div>
          <span className="text-xs font-semibold text-slate-300 block mb-1.5">
            Dispensing Pharmacist Action Items:
          </span>
          <div className="space-y-1.5">
            {defaultAudit.pharmacist_action_items.map((item, idx) => {
              const isChecked = !!checkedItems[idx];
              return (
                <div
                  key={idx}
                  onClick={() => toggleCheck(idx)}
                  className={`flex items-start gap-2 p-2 rounded-lg border text-xs cursor-pointer transition ${
                    isChecked
                      ? 'bg-emerald-950/20 border-emerald-500/30 text-slate-400 line-through'
                      : 'bg-slate-950/40 border-slate-800 text-slate-200 hover:border-slate-700'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => {}}
                    className="mt-0.5 accent-emerald-500 cursor-pointer"
                  />
                  <span className="leading-snug">{item}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Customer SMS Dispatch Simulation Card */}
      <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-800 mb-3 text-xs">
        <div className="flex items-center justify-between mb-1.5">
          <span className="font-bold text-slate-200 flex items-center gap-1.5">
            <MessageSquare className="h-3.5 w-3.5 text-cyan-400" />
            Two-Way Patient SMS Confirmation
          </span>
          <button
            onClick={() => setShowSmsPreview(!showSmsPreview)}
            className="text-[10px] text-cyan-400 hover:text-cyan-300 font-mono underline cursor-pointer"
          >
            {showSmsPreview ? 'Hide Preview' : 'View Message'}
          </button>
        </div>
        {showSmsPreview && (
          <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 mt-2 font-mono text-[11px] text-slate-300 space-y-1">
            <p className="text-emerald-400 font-semibold">Community Care Pharmacy:</p>
            <p>{latestAudit ? `Hi ${(latestAudit.patient_full_name || 'there').split(' ')[0]}, your order is confirmed for ${latestAudit.pickup_window_committed || 'pickup'}. Estimated copay: ${latestAudit.total_copay_disclosed || 'n/a'}.` : 'No confirmation message has been sent in this session.'}</p>
          </div>
        )}
      </div>

      {/* Pharmacist Operations Toolbar */}
      <div className="mt-auto space-y-2 pt-2">
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={onDispenseAll}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition cursor-pointer"
          >
            <CheckSquare className="h-4 w-4" />
            <span>Dispense All Queued</span>
          </button>

          <button
            onClick={handlePrintLabels}
            className={`w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition cursor-pointer ${
              labelsPrinted
                ? 'bg-teal-900 border-teal-500 text-teal-200'
                : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-white'
            }`}
          >
            <Printer className="h-4 w-4 text-cyan-400" />
            <span>{labelsPrinted ? 'Thermal Labels Printed!' : 'Print Rx Labels'}</span>
          </button>
        </div>

        <button
          onClick={onExportFhir}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs transition cursor-pointer"
        >
          <Download className="h-3.5 w-3.5 text-slate-400" />
          <span>Export HL7 FHIR v4.0.1 Clinical Bundle</span>
        </button>
      </div>
    </div>
  );
};
