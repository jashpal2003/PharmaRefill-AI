'use client';

import React from 'react';
import { Prescription } from '@/lib/types';
import { Pill, ShieldAlert, CheckCircle, Clock, Calendar, DollarSign, ShieldCheck, ArrowRight } from 'lucide-react';

interface ActivePrescriptionsProps {
  prescriptions: Prescription[];
  totalCopay?: number;
  pickupSlot?: string | null;
}

export const ActivePrescriptions: React.FC<ActivePrescriptionsProps> = ({
  prescriptions,
  totalCopay = 19.90,
  pickupSlot = 'Friday 3:00 PM - 6:00 PM'
}) => {
  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
          <Pill className="h-3.5 w-3.5 text-emerald-400" />
          Active Prescriptions ({prescriptions.length || 4})
        </span>
        <span className="text-[11px] text-slate-400">Adjudication Feed</span>
      </div>

      <div className="space-y-2 flex-1 overflow-y-auto pr-1">
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
                  ? 'bg-emerald-950/20 border-emerald-500/40'
                  : isMedSync
                  ? 'bg-teal-950/20 border-teal-500/30'
                  : 'bg-slate-900/60 border-slate-800'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-white">{rx.drug_name}</span>
                    <span className="text-[11px] text-slate-300 font-mono bg-slate-800/80 px-1.5 py-0.5 rounded">
                      {rx.strength}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Rx: <span className="font-mono text-slate-300">{rx.rx_number}</span> | {rx.dosage_form}
                  </p>
                </div>

                {/* Pill Badges */}
                {isControlled ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/50 flex items-center gap-1">
                    <ShieldAlert className="h-3 w-3 text-amber-400" />
                    C-II CONTROLLED
                  </span>
                ) : isAtorvastatin ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 flex items-center gap-1">
                    <CheckCircle className="h-3 w-3 text-emerald-400" />
                    PRIMARY REFILL
                  </span>
                ) : isMedSync ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/50 flex items-center gap-1">
                    <Clock className="h-3 w-3 text-teal-400" />
                    MED-SYNC CANDIDATE
                  </span>
                ) : (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                    MAINTENANCE
                  </span>
                )}
              </div>

              {/* Status and Details Strip */}
              <div className="mt-2.5 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-3 text-slate-400">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3 text-slate-500" />
                    Due: <span className="text-slate-200 font-mono">{rx.next_refill_due_date}</span>
                  </span>
                  <span>
                    Refills: <span className="text-emerald-400 font-semibold">{rx.refills_remaining}</span>
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-slate-400">Co-pay:</span>
                  <span className="font-mono font-bold text-emerald-300 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-500/30">
                    ${Number(rx.copay_amount).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Proactive Med-Sync Adjudication Card */}
      <div className="bg-gradient-to-br from-teal-950/40 to-slate-900/80 rounded-xl p-3.5 border border-teal-500/30 mt-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-teal-400" />
            <span className="text-xs font-bold text-teal-300">Proactive Med-Sync Adjudication</span>
          </div>
          <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-teal-900/50 text-teal-200 border border-teal-500/40">
            Rule 35% RTS Loss Prevention
          </span>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed mb-3">
          Synchronizing <span className="text-teal-300 font-semibold">Atorvastatin</span>, <span className="text-teal-300 font-semibold">Metformin</span>, and <span className="text-teal-300 font-semibold">Lisinopril</span> into a unified monthly fill window.
        </p>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800">
            <span className="text-slate-400 block text-[10px] uppercase font-mono">Total Adjudicated Co-pay</span>
            <span className="font-mono text-base font-bold text-emerald-300 flex items-center gap-0.5 mt-0.5">
              <DollarSign className="h-4 w-4 text-emerald-400" />
              {totalCopay.toFixed(2)}
            </span>
          </div>

          <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800">
            <span className="text-slate-400 block text-[10px] uppercase font-mono">Committed Pickup Slot</span>
            <span className="text-slate-200 font-medium block mt-1 text-[11px] truncate">
              {pickupSlot || 'Pending Caller Confirmation'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
export default ActivePrescriptions;
