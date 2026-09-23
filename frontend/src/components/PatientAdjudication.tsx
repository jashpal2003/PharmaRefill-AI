'use client';

import { apiFetch } from '@/lib/api';
import React, { useState } from 'react';
import { Patient, Prescription, Consultation, BillingAccount } from '@/lib/types';
import {
  User,
  CheckCircle,
  Pill,
  Clock,
  Calendar,
  CreditCard,
  Phone,
  MapPin,
  ShieldCheck,
  CheckCircle2,
  DollarSign
} from 'lucide-react';
import { ActivePrescriptions } from './ActivePrescriptions';

interface PatientAdjudicationProps {
  patient: Patient | null;
  prescriptions: Prescription[];
  consultations: Consultation[];
  billing: BillingAccount | null;
  totalCopay: number;
  pickupSlot: string | null;
  onRefresh: () => void;
}

export const PatientAdjudication: React.FC<PatientAdjudicationProps> = ({
  patient,
  prescriptions,
  consultations,
  billing,
  totalCopay,
  pickupSlot,
  onRefresh
}) => {
  const [activeTab, setActiveTab] = useState<'PRESCRIPTIONS' | 'MED_SYNC' | 'CONSULTATIONS' | 'BILLING'>('PRESCRIPTIONS');
  const [isPaying, setIsPaying] = useState(false);

  const defaultPatient = patient || {
    patient_id: 'PAT-1001',
    first_name: 'Eleanor',
    last_name: 'Vance',
    dob: '1958-04-12',
    primary_phone: '+1 (415) 555-0192',
    street_address: '742 Evergreen Terrace, San Francisco, CA',
    insurance_carrier: 'BlueCross Medicare Advantage',
    insurance_member_id: 'MED-BC-908124',
    is_med_sync_enrolled: false
  };

  const handlePayBalance = async () => {
    if (!billing || billing.outstanding_balance <= 0) return;
    setIsPaying(true);
    try {
      await apiFetch(`/api/billing/${defaultPatient.patient_id}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: billing.outstanding_balance })
      });
      onRefresh();
    } catch (e) {
      console.error(e);
    } finally {
      setIsPaying(false);
    }
  };

  return (
    <div className="flex flex-col h-full glass-panel rounded-2xl p-5 border border-slate-800 overflow-y-auto">
      {/* Panel Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 mb-3.5">
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-cyan-400" />
          <h2 className="text-sm font-semibold tracking-wide uppercase text-slate-200">
            Patient Record & Adjudication
          </h2>
        </div>
        <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-cyan-950/60 text-cyan-300 border border-cyan-500/30 font-mono">
          PMS / EHR Live
        </span>
      </div>

      {/* Patient Demographic Card */}
      <div className="bg-slate-900/80 rounded-xl p-4 border border-slate-800 mb-3.5 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              {defaultPatient.first_name} {defaultPatient.last_name}
              <span className="text-xs font-mono font-normal px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                {defaultPatient.patient_id}
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-1 flex flex-wrap items-center gap-3">
              <span>DOB: <strong className="text-slate-200 font-mono">{defaultPatient.dob}</strong></span>
              <span className="flex items-center gap-1">
                <Phone className="h-3 w-3 text-slate-500" />
                <strong className="text-slate-200 font-mono">{defaultPatient.primary_phone}</strong>
              </span>
            </p>
            {defaultPatient.street_address && (
              <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                <MapPin className="h-3 w-3 text-slate-500" />
                <span>{defaultPatient.street_address}</span>
              </p>
            )}
          </div>
          <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-950/50 text-emerald-300 border border-emerald-500/40 flex items-center gap-1 font-medium">
            <CheckCircle className="h-3 w-3" />
            Verified Active
          </span>
        </div>

        <div className="mt-3 pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div>
            <span className="text-slate-400">Payer: </span>
            <span className="font-semibold text-slate-200">{defaultPatient.insurance_carrier || 'Medicare Advantage'}</span>
          </div>
          <div>
            <span className="text-slate-400">Member ID: </span>
            <span className="font-mono text-cyan-300">{defaultPatient.insurance_member_id || 'MED-908124'}</span>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-1.5 border-b border-slate-800/80 pb-2.5 mb-3 text-xs">
        <button
          onClick={() => setActiveTab('PRESCRIPTIONS')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
            activeTab === 'PRESCRIPTIONS'
              ? 'bg-slate-800 text-emerald-400 font-bold border border-slate-700'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Pill className="h-3.5 w-3.5" />
          <span>Active Prescriptions ({prescriptions.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('MED_SYNC')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
            activeTab === 'MED_SYNC'
              ? 'bg-slate-800 text-teal-400 font-bold border border-slate-700'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Clock className="h-3.5 w-3.5" />
          <span>Med-Sync</span>
        </button>

        <button
          onClick={() => setActiveTab('CONSULTATIONS')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
            activeTab === 'CONSULTATIONS'
              ? 'bg-slate-800 text-purple-400 font-bold border border-slate-700'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Calendar className="h-3.5 w-3.5" />
          <span>Consultations ({consultations.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('BILLING')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
            activeTab === 'BILLING'
              ? 'bg-slate-800 text-cyan-400 font-bold border border-slate-700'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <CreditCard className="h-3.5 w-3.5" />
          <span>Account Billing</span>
        </button>
      </div>

      {/* Tab Content 1: Active Prescriptions & Med-Sync */}
      {activeTab === 'PRESCRIPTIONS' && (
        <ActivePrescriptions
          prescriptions={prescriptions}
          totalCopay={totalCopay}
          pickupSlot={pickupSlot}
        />
      )}

      {/* Tab Content 2: Proactive Med-Sync */}
      {activeTab === 'MED_SYNC' && (
        <div className="space-y-3 flex-1 overflow-y-auto pr-1">
          <div className="bg-gradient-to-br from-teal-950/40 to-slate-900/80 rounded-xl p-4 border border-teal-500/30">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-teal-400" />
                <span className="text-sm font-bold text-teal-300">Medication Synchronization Engine</span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-teal-900/60 text-teal-200 border border-teal-500/40">
                Rule: 35% RTS Loss Prevention
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed mb-3">
              Consolidates maintenance medications running out within the next 7 days into a single monthly pickup window. Eliminates repetitive trips to the pharmacy and boosts medication adherence.
            </p>

            <div className="grid grid-cols-2 gap-2 text-xs mb-3">
              <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
                <span className="text-slate-400 block text-[10px] uppercase font-mono">Combined Co-Pay</span>
                <span className="font-mono text-base font-bold text-emerald-300 flex items-center gap-0.5 mt-0.5">
                  <DollarSign className="h-4 w-4 text-emerald-400" />
                  {totalCopay.toFixed(2)}
                </span>
              </div>
              <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
                <span className="text-slate-400 block text-[10px] uppercase font-mono">Synchronized Window</span>
                <span className="text-slate-200 font-medium block mt-1 text-[11px] truncate">
                  {pickupSlot || 'Friday 3:00 PM - 6:00 PM'}
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-slate-300 block">Eligible Med-Sync Prescriptions:</span>
              {prescriptions.filter((r) => r.dea_schedule === 0).map((rx) => (
                <div key={rx.rx_number} className="flex items-center justify-between p-2 rounded-lg bg-slate-950/50 border border-slate-800 text-xs">
                  <div>
                    <span className="font-bold text-white">{rx.drug_name}</span>
                    <span className="text-slate-400 text-[11px] ml-1.5 font-mono">{rx.strength}</span>
                  </div>
                  <span className="text-emerald-400 font-mono font-bold">${Number(rx.copay_amount).toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab Content 3: Pharmacist Consultations  */}
      {activeTab === 'CONSULTATIONS' && (
        <div className="space-y-2.5 flex-1 overflow-y-auto pr-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-slate-300">
              Pharmacist Consultations & MTM Sessions
            </span>
          </div>

          {consultations.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl">
              No scheduled consultations. Use the softphone to schedule a clinical consultation.
            </div>
          ) : (
            consultations.map((c) => (
              <div key={c.consultation_id} className="p-3.5 rounded-xl bg-slate-900/70 border border-purple-500/30 text-xs">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-purple-400" />
                    {c.consultation_type}
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-950/60 text-purple-300 border border-purple-500/40">
                    {c.status}
                  </span>
                </div>
                <p className="text-slate-300 text-[11px]">
                  Clinician: <strong className="text-purple-300">{c.pharmacist_name}</strong>
                </p>
                <p className="text-slate-400 text-[11px] mt-0.5">
                  Scheduled: <strong className="text-slate-200 font-mono">{c.scheduled_time}</strong>
                </p>
                {c.notes && (
                  <p className="text-slate-400 text-[11px] mt-1.5 italic bg-slate-950/60 p-2 rounded border border-slate-800/80">
                    "{c.notes}"
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab Content 4: Account Billing & Co-Pay Payment */}
      {activeTab === 'BILLING' && (
        <div className="space-y-3 flex-1 overflow-y-auto pr-1">
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-300">Prescription Account Balance</span>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-cyan-300">
                Pre-Adjudicated
              </span>
            </div>

            <div className="flex items-baseline gap-2 mb-4">
              <span className="text-3xl font-extrabold text-white font-mono">
                ${billing ? Number(billing.outstanding_balance).toFixed(2) : '0.00'}
              </span>
              <span className="text-xs text-slate-400">Total Outstanding Balance</span>
            </div>

            <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 text-xs space-y-1.5 mb-4">
              <div className="flex items-center justify-between text-slate-400">
                <span>Payment Method on File:</span>
                <span className="font-semibold text-white font-mono flex items-center gap-1">
                  <CreditCard className="h-3.5 w-3.5 text-cyan-400" />
                  {billing?.card_brand || 'Visa'} ending in {billing?.card_last_four || '4242'}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>Last Payment Date:</span>
                <span className="text-slate-200 font-mono">{billing?.last_payment_date || '30 days ago'}</span>
              </div>
            </div>

            <button
              onClick={handlePayBalance}
              disabled={isPaying || !billing || billing.outstanding_balance <= 0}
              className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold text-xs transition cursor-pointer shadow-lg shadow-emerald-500/20"
            >
              {isPaying ? 'Processing Payment...' : (billing && billing.outstanding_balance > 0) ? `Pay Total Balance ($${Number(billing.outstanding_balance).toFixed(2)})` : 'Account Paid in Full'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
