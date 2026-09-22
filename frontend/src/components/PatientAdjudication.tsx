'use client';

import React from 'react';
import { Patient, Prescription } from '@/lib/types';
import { User, CheckCircle } from 'lucide-react';
import { ActivePrescriptions } from './ActivePrescriptions';

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

      {/* Active Prescriptions Table & Med-Sync Adjudication */}
      <ActivePrescriptions
        prescriptions={prescriptions}
        totalCopay={totalCopay > 0 ? totalCopay : 19.90}
        pickupSlot={pickupSlot}
      />
    </div>
  );
};

