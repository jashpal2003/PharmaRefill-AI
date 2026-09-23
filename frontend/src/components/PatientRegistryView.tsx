'use client';

import React, { useState } from 'react';
import { Patient, Prescription, Consultation, BillingAccount } from '@/lib/types';
import {
  Users,
  Search,
  Phone,
  Calendar,
  MapPin,
  Pill,
  Clock,
  ShieldCheck,
  CheckCircle,
  CreditCard,
  PhoneCall,
  DollarSign,
  Plus
} from 'lucide-react';
import { ActivePrescriptions } from './ActivePrescriptions';
import { PatientInsightsPanel } from './PatientInsightsPanel';

interface PatientRegistryViewProps {
  patients: Patient[];
  selectedPatient: Patient | null;
  onSelectPatient: (patientId: string) => void;
  prescriptions: Prescription[];
  consultations: Consultation[];
  billing: BillingAccount | null;
  totalCopay: number;
  pickupSlot: string | null;
  onOpenPhoneModal: () => void;
  onRefresh: () => void;
}

export const PatientRegistryView: React.FC<PatientRegistryViewProps> = ({
  patients,
  selectedPatient,
  onSelectPatient,
  prescriptions,
  consultations,
  billing,
  totalCopay,
  pickupSlot,
  onOpenPhoneModal,
  onRefresh
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'MEDICATIONS' | 'MED_SYNC' | 'CONSULTATIONS' | 'BILLING'>('MEDICATIONS');

  const filteredPatients = patients.filter((p) => {
    const q = searchQuery.toLowerCase();
    const name = `${p.first_name} ${p.last_name}`.toLowerCase();
    const phone = p.primary_phone.toLowerCase();
    const id = p.patient_id.toLowerCase();
    return name.includes(q) || phone.includes(q) || id.includes(q);
  });

  const currentPatient = selectedPatient || patients[0] || {
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

  return (
    <div className="flex-1 flex flex-col p-6 overflow-hidden">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-5 border-b border-slate-800/80">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2.5">
            <Users className="h-6 w-6 text-blue-400" />
            Patient Registry & Medication Synchronization
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Complete electronic medical profile, active medication regimens, 7-day synchronization scheduler, and insurance adjudication.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={onOpenPhoneModal}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition shadow-md shadow-blue-600/20 cursor-pointer"
          >
            <PhoneCall className="h-4 w-4" />
            <span>Launch Inbound Call with {currentPatient.first_name}</span>
          </button>
        </div>
      </div>

      {/* 2-Column Registry Grid */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-5 mt-5 min-h-0">
        {/* Left Column (4 cols): Searchable Patient List */}
        <div className="lg:col-span-4 flex flex-col bg-slate-950/80 rounded-2xl border border-slate-800 p-4 overflow-hidden">
          <div className="relative mb-3">
            <Search className="h-4 w-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search patients by name or phone..."
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {filteredPatients.map((p) => {
              const isSelected = currentPatient.patient_id === p.patient_id;
              return (
                <div
                  key={p.patient_id}
                  onClick={() => onSelectPatient(p.patient_id)}
                  className={`p-3 rounded-xl border transition cursor-pointer text-xs ${
                    isSelected
                      ? 'bg-slate-900 border-emerald-500/70 shadow-md shadow-emerald-500/10'
                      : 'bg-slate-900/50 border-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-white text-sm">
                      {p.first_name} {p.last_name}
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
                      {p.patient_id}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 font-mono flex items-center gap-1">
                    <Phone className="h-3 w-3 text-slate-500" />
                    {p.primary_phone}
                  </p>
                  <div className="mt-2 flex items-center justify-between text-[11px]">
                    <span className="text-slate-500 truncate max-w-[140px]">{p.insurance_carrier}</span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      p.is_med_sync_enrolled
                        ? 'bg-teal-500/20 text-teal-300'
                        : 'bg-slate-800 text-slate-400'
                    }`}>
                      {p.is_med_sync_enrolled ? 'Med-Sync' : 'Standard'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column (8 cols): Comprehensive Patient Profile & Tabs */}
        <div className="lg:col-span-8 flex flex-col bg-slate-950/80 rounded-2xl border border-slate-800 p-5 overflow-hidden">
          {/* Patient Overview Header Card */}
          <div className="bg-slate-900/90 rounded-xl p-4 border border-slate-800 mb-4 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2.5">
                  {currentPatient.first_name} {currentPatient.last_name}
                  <span className="text-xs font-mono font-normal px-2.5 py-0.5 rounded-md bg-slate-800 text-emerald-400">
                    {currentPatient.patient_id}
                  </span>
                </h3>
                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 mt-1.5">
                  <span>DOB: <strong className="text-slate-200 font-mono">{currentPatient.dob}</strong></span>
                  <span className="flex items-center gap-1">
                    <Phone className="h-3 w-3 text-slate-500" />
                    <strong className="text-slate-200 font-mono">{currentPatient.primary_phone}</strong>
                  </span>
                  {currentPatient.street_address && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-slate-500" />
                      <span className="text-slate-300">{currentPatient.street_address}</span>
                    </span>
                  )}
                </div>
              </div>

              <span className="self-start text-xs px-2.5 py-1 rounded-full bg-emerald-950/60 text-emerald-300 border border-emerald-500/40 flex items-center gap-1 font-medium">
                <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
                Active Medical File
              </span>
            </div>

            <div className="mt-3 pt-3 border-t border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="p-2 bg-slate-950/60 rounded-lg border border-slate-800">
                <span className="text-slate-500 text-[10px] uppercase block">Insurance Payer</span>
                <span className="font-semibold text-slate-200 truncate block mt-0.5">{currentPatient.insurance_carrier}</span>
              </div>
              <div className="p-2 bg-slate-950/60 rounded-lg border border-slate-800">
                <span className="text-slate-500 text-[10px] uppercase block">Member Policy ID</span>
                <span className="font-mono text-cyan-300 font-semibold truncate block mt-0.5">{currentPatient.insurance_member_id}</span>
              </div>
              <div className="p-2 bg-slate-950/60 rounded-lg border border-slate-800">
                <span className="text-slate-500 text-[10px] uppercase block">Active Medications</span>
                <span className="font-mono text-emerald-400 font-bold block mt-0.5">{prescriptions.length} Active Rx</span>
              </div>
              <div className="p-2 bg-slate-950/60 rounded-lg border border-slate-800">
                <span className="text-slate-500 text-[10px] uppercase block">Adherence Sync</span>
                <span className="font-semibold text-teal-300 block mt-0.5">
                  {currentPatient.is_med_sync_enrolled ? 'Enrolled (Monthly)' : '7-Day Eligible'}
                </span>
              </div>
            </div>
          </div>

          {/* Patient Tabs */}
          <div className="flex items-center gap-1.5 border-b border-slate-800/80 pb-2.5 mb-3 text-xs">
            <button
              onClick={() => setActiveTab('MEDICATIONS')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                activeTab === 'MEDICATIONS'
                  ? 'bg-slate-800 text-emerald-400 font-bold border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Pill className="h-3.5 w-3.5" />
              <span>Prescriptions ({prescriptions.length})</span>
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
              <span>Med-Sync Adjudication</span>
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
              <span>Billing Account</span>
            </button>
          </div>

          {/* Active Tab Views */}
          {activeTab === 'MEDICATIONS' && (
            <>
              <ActivePrescriptions
                prescriptions={prescriptions}
                totalCopay={totalCopay}
                pickupSlot={pickupSlot}
              />
              {currentPatient?.patient_id && <PatientInsightsPanel patientId={currentPatient.patient_id} onChanged={onRefresh} />}
            </>
          )}

          {activeTab === 'MED_SYNC' && (
            <div className="space-y-3 flex-1 overflow-y-auto pr-1">
              <div className="bg-gradient-to-br from-teal-950/40 to-slate-900/80 rounded-xl p-4 border border-teal-500/30">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-teal-400" />
                    <span className="text-sm font-bold text-teal-300">Medication Synchronization Adjudication</span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-teal-900/60 text-teal-200 border border-teal-500/40">
                    Rule 35% RTS Loss Prevention
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed mb-3">
                  Synchronizes maintenance regimens into a single monthly fill date to prevent adherence loss and return-to-stock waste.
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
                    <span className="text-slate-400 block text-[10px] uppercase font-mono">Drive-Thru Window</span>
                    <span className="text-slate-200 font-medium block mt-1 text-[11px] truncate">
                      {pickupSlot || 'Friday 3:00 PM - 6:00 PM'}
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <span className="text-[11px] font-semibold text-slate-300 block">Synchronized Regimens:</span>
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

          {activeTab === 'CONSULTATIONS' && (
            <div className="space-y-2.5 flex-1 overflow-y-auto pr-1">
              <span className="text-xs font-semibold text-slate-300 block">
                Scheduled MTM Reviews & Clinical Sessions:
              </span>
              {consultations.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl">
                  No scheduled consultations for {currentPatient.first_name}. Use the softphone or consultation module to book.
                </div>
              ) : (
                consultations.map((c) => (
                  <div key={c.consultation_id} className="p-3.5 rounded-xl bg-slate-900/70 border border-purple-500/30 text-xs">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold text-white">{c.consultation_type}</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-950/60 text-purple-300 border border-purple-500/40">
                        {c.status}
                      </span>
                    </div>
                    <p className="text-slate-300 text-[11px]">
                      Clinician: <strong className="text-purple-300">{c.pharmacist_name}</strong> • Time: <strong className="text-slate-200 font-mono">{c.scheduled_time}</strong>
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

          {activeTab === 'BILLING' && (
            <div className="space-y-3 flex-1 overflow-y-auto pr-1">
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
                <span className="text-xs font-semibold text-slate-300 block mb-2">Prescription Financial Ledger</span>
                <div className="flex items-baseline gap-2 mb-4">
                  <span className="text-3xl font-extrabold text-white font-mono">
                    ${billing ? Number(billing.outstanding_balance).toFixed(2) : '0.00'}
                  </span>
                  <span className="text-xs text-slate-400">Current Outstanding Copay</span>
                </div>
                <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 text-xs space-y-1.5">
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Payment Method on File:</span>
                    <span className="font-semibold text-white font-mono flex items-center gap-1">
                      <CreditCard className="h-3.5 w-3.5 text-cyan-400" />
                      {billing?.card_brand || 'Visa'} ending in {billing?.card_last_four || '4242'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
