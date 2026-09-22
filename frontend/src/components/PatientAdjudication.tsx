'use client';

import React from 'react';
import { Patient, Prescription } from '@/lib/types';
import { User, Pill, ShieldAlert, CheckCircle, Clock, Calendar, DollarSign, ShieldCheck, ArrowRight } from 'lucide-react';

interface PatientAdjudicationProps {
  patient: Patient | null;
  prescriptions: Prescription[];
  totalCopay: number;
  pickupSlot: string | null;
}

export const PatientAdjudication: React.FC<PatientAdjudicationProps> = ({
  patient,
  prescriptions,
  totalCopay,
  pickupSlot
}) => {
  const defaultPatient = patient || {
    patient_id: 'PAT-1001',
    first_name: 'Eleanor',
    last_name: 'Vance',
    dob: '1958-04-12',
    primary_phone: '+1 (415) 555-0192',
    insurance_carrier: 'BlueCross Medicare Advantage',
    insurance_member_id: 'MED-BC-908124',
    is_med_sync_enrolled: false
  };

  return (
    <div className="flex flex-col h-full glass-panel rounded-2xl p-5 border border-slate-800 overflow-y-auto">
      {/* Panel Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 mb-4">
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-cyan-400" />
          <h2 className="text-sm font-semibold tracking-wide uppercase text-slate-200">
            Patient Record & Adjudication
          </h2>
        </div>
        <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-950/60 text-cyan-300 border border-cyan-500/30 font-mono">
          EHR Synced
        </span>
      </div>

      {/* Patient Demographic Card */}
      <div className="bg-slate-900/80 rounded-xl p-4 border border-slate-800 mb-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              {defaultPatient.first_name} {defaultPatient.last_name}
              <span className="text-xs font-mono font-normal px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                {defaultPatient.patient_id}
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              DOB: <span className="text-slate-200 font-mono">{defaultPatient.dob} (Age 68)</span> | Phone: <span className="text-slate-200 font-mono">{defaultPatient.primary_phone}</span>
            </p>
          </div>
          <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-950/50 text-emerald-300 border border-emerald-500/40 flex items-center gap-1 font-medium">
            <CheckCircle className="h-3 w-3" />
            Verified Active
          </span>
        </div>

        <div className="mt-3 pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div>
            <span className="text-slate-400">Payer: </span>
            <span className="font-semibold text-slate-200">{defaultPatient.insurance_carrier}</span>
          </div>
          <div>
            <span className="text-slate-400">Member ID: </span>
            <span className="font-mono text-cyan-300">{defaultPatient.insurance_member_id}</span>
          </div>
        </div>
      </div>

      {/* Active Prescriptions Table */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
            <Pill className="h-3.5 w-3.5 text-emerald-400" />
            Active Prescriptions ({prescriptions.length || 4})
          </span>
          <span className="text-[11px] text-slate-400">Adjudication Feed</span>
        </div>

        <div className="space-y-2">
          {prescriptions.map((rx) => {
            const isControlled = rx.is_controlled_substance || rx.dea_schedule >= 2;
            const isAtorvastatin = rx.drug_name.toLowerCase().includes('atorvastatin');
            const isMedSync = rx.drug_name.toLowerCase().includes('metformin') || rx.drug_name.toLowerCase().includes('lisinopril');

            return (
              <div
                key={rx.rx_number}
                className={`p-3 rounded-xl border transition-all ${
                  isControlled
                    ? 'bg-amber-950/20 border-amber-500/40'
                    : isAtorvastatin
                    ? 'bg-emerald-950/25 border-emerald-500/40'
                    : isMedSync
                    ? 'bg-cyan-950/20 border-cyan-500/30'
                    : 'bg-slate-900/60 border-slate-800'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs text-white">
                        {rx.drug_name} {rx.strength}
                      </span>
                      {isControlled && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                          SCHEDULE II C-II
                        </span>
                      )}
                      {isMedSync && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                          MED-SYNC CANDIDATE
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 flex items-center gap-3 mt-1">
                      <span>Rx #: <span className="font-mono text-slate-300">{rx.rx_number}</span></span>
                      <span>Refills: <span className="font-mono text-slate-200">{rx.refills_remaining}</span></span>
                      <span>Due: <span className="font-mono text-slate-300">{rx.next_refill_due_date}</span></span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-xs font-mono font-bold text-white block">
                      ${Number(rx.copay_amount).toFixed(2)}
                    </span>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                      rx.adjudication_status === 'APPROVED'
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : 'bg-rose-500/20 text-rose-300'
                    }`}>
                      {rx.adjudication_status}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Proactive Med-Sync Discovery Card */}
      <div className="bg-gradient-to-r from-teal-950/40 to-cyan-950/40 rounded-xl p-3.5 border border-teal-500/30 mb-4">
        <div className="flex items-center justify-between text-xs text-teal-300 font-semibold mb-1.5">
          <span className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            Proactive Med-Sync Discovery Engine
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded bg-teal-500/20 text-teal-200">
            7-Day Window Analysis
          </span>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed">
          Detected 2 chronic maintenance medications due within 6 days: <span className="font-semibold text-teal-200">Metformin HCl 500mg</span> and <span className="font-semibold text-teal-200">Lisinopril 10mg</span>. Synchronizing into a single Friday pickup eliminates 2 patient trips and eliminates Return-to-Stock waste.
        </p>
      </div>

      {/* Adjudication Copay & Anti-RTS Commitment Summary */}
      <div className="mt-auto bg-slate-900/90 rounded-xl p-4 border border-slate-800">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-xs">
          <span className="text-slate-400">Total Pre-Adjudicated Out-of-Pocket:</span>
          <span className="text-lg font-mono font-bold text-emerald-400">
            ${(totalCopay > 0 ? totalCopay : 19.90).toFixed(2)}
          </span>
        </div>

        <div className="mt-3 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 text-slate-300">
            <Clock className="h-3.5 w-3.5 text-cyan-400" />
            <span>Anti-RTS Commitment Window:</span>
          </div>
          <span className="font-mono text-cyan-300 font-semibold">
            {pickupSlot || 'Friday 3:00 PM - 6:00 PM'}
          </span>
        </div>

        <div className="mt-2 text-[11px] text-slate-400 flex items-center justify-between">
          <span>Return-to-Stock (RTS) Risk:</span>
          <span className="text-emerald-400 font-bold">0% (Committed via Voice & SMS)</span>
        </div>
      </div>
    </div>
  );
};
