'use client';

import React, { useState } from 'react';
import {
  Calendar,
  ChevronRight,
  CreditCard,
  FileText,
  Heart,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Pill,
  Search,
  Shield,
  User,
  Users,
} from 'lucide-react';
import { Patient, Prescription, Consultation, BillingAccount } from '@/lib/types';

interface PatientViewProps {
  patients: Patient[];
  selectedPatient: Patient | null;
  onSelectPatient: (patientId: string) => void;
  prescriptions: Prescription[];
  consultations: Consultation[];
  billing: BillingAccount | null;
  totalCopay: number;
  pickupSlot: string | null;
}

export const PatientView: React.FC<PatientViewProps> = ({
  patients,
  selectedPatient,
  onSelectPatient,
  prescriptions,
  consultations,
  billing,
  totalCopay,
  pickupSlot,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const patient = selectedPatient || patients[0] || null;

  const filtered = patients.filter((p) =>
    !searchTerm.trim() ||
    `${p.first_name} ${p.last_name} ${p.patient_id} ${p.primary_phone}`
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
  );

  const patientRx = prescriptions.filter((rx) => rx.patient_id === patient?.patient_id);
  const controlledRx = patientRx.filter((rx) => rx.is_controlled_substance);
  const patientConsults = consultations.filter((c) => c.patient_id === patient?.patient_id);

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header */}
      <div className="px-6 pt-6 pb-4">
        <h1 className="text-2xl font-extrabold tracking-tight">
          <span className="gradient-text">Patient Intelligence</span>
        </h1>
        <p className="text-[13px] text-[var(--text-dim)] mt-1">
          Comprehensive patient profiles, medications, and clinical history
        </p>
      </div>

      <div className="px-6 pb-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

          {/* LEFT: Patient List (4 cols) */}
          <div className="lg:col-span-4 bento-card flex flex-col max-h-[calc(100vh-160px)]">
            {/* Search */}
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-dim)]" />
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search patients…"
                className="field w-full !pl-9 !py-2 !text-xs"
              />
            </div>

            {/* Patient List */}
            <div className="flex-1 overflow-y-auto space-y-1.5 transcript-scroll">
              {filtered.map((p) => {
                const isActive = p.patient_id === patient?.patient_id;
                return (
                  <button
                    key={p.patient_id}
                    onClick={() => onSelectPatient(p.patient_id)}
                    className={`w-full text-left p-3 rounded-xl flex items-center gap-3 transition-all cursor-pointer ${
                      isActive
                        ? 'border-indigo-500/30'
                        : 'border-transparent hover:border-[var(--border-default)]'
                    }`}
                    style={{
                      background: isActive ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
                      border: `1px solid ${isActive ? 'rgba(99, 102, 241, 0.25)' : 'transparent'}`,
                    }}
                  >
                    {/* Avatar */}
                    <div
                      className="h-9 w-9 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
                      style={{
                        background: isActive ? 'rgba(99, 102, 241, 0.15)' : 'var(--surface-2)',
                        color: isActive ? '#A5B4FC' : 'var(--text-dim)',
                        border: `1px solid ${isActive ? 'rgba(99, 102, 241, 0.3)' : 'var(--border-default)'}`,
                      }}
                    >
                      {p.first_name[0]}{p.last_name[0]}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-[var(--text-strong)] truncate">
                        {p.first_name} {p.last_name}
                      </div>
                      <div className="text-[10px] text-[var(--text-dim)] flex items-center gap-2">
                        <span className="font-mono">{p.patient_id}</span>
                        {p.is_med_sync_enrolled && (
                          <span className="tag-success text-[8px] px-1.5 py-0 rounded-full font-bold">Med-Sync</span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className={`h-3.5 w-3.5 shrink-0 ${isActive ? 'text-indigo-400' : 'text-[var(--text-dim)]'}`} />
                  </button>
                );
              })}
            </div>
          </div>

          {/* RIGHT: Patient Detail (8 cols) */}
          <div className="lg:col-span-8 flex flex-col gap-4">
            {!patient ? (
              <div className="bento-card flex flex-col items-center justify-center py-20">
                <Users className="h-10 w-10 text-[var(--text-dim)] opacity-30 mb-3" />
                <p className="text-sm text-[var(--text-dim)]">Select a patient to view details</p>
              </div>
            ) : (
              <>
                {/* Patient Header Card */}
                <div className="bento-card !p-5">
                  <div className="flex items-start gap-4">
                    <div
                      className="h-14 w-14 rounded-2xl flex items-center justify-center text-lg font-bold shrink-0"
                      style={{
                        background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(139, 92, 246, 0.1))',
                        border: '1px solid rgba(99, 102, 241, 0.25)',
                        color: '#A5B4FC',
                      }}
                    >
                      {patient.first_name[0]}{patient.last_name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h2 className="text-lg font-bold text-[var(--text-strong)]">
                        {patient.first_name} {patient.last_name}
                      </h2>
                      <div className="flex items-center gap-4 mt-1 flex-wrap">
                        <span className="text-xs text-[var(--text-dim)] flex items-center gap-1">
                          <User className="h-3 w-3" /> {patient.patient_id}
                        </span>
                        <span className="text-xs text-[var(--text-dim)] flex items-center gap-1">
                          <Calendar className="h-3 w-3" /> DOB: {patient.dob}
                        </span>
                        <span className="text-xs text-[var(--text-dim)] flex items-center gap-1">
                          <Phone className="h-3 w-3" /> {patient.primary_phone}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-2 flex-wrap">
                        {patient.insurance_carrier && (
                          <span className="tag-info text-[10px] px-2 py-0.5 rounded-full font-semibold">
                            {patient.insurance_carrier}
                          </span>
                        )}
                        {patient.is_med_sync_enrolled && (
                          <span className="tag-success text-[10px] px-2 py-0.5 rounded-full font-semibold">
                            ✓ Med-Sync Enrolled
                          </span>
                        )}
                        {pickupSlot && (
                          <span className="tag-accent text-[10px] px-2 py-0.5 rounded-full font-semibold">
                            Pickup: {pickupSlot}
                          </span>
                        )}
                      </div>
                    </div>
                    {totalCopay > 0 && (
                      <div className="text-right shrink-0">
                        <div className="text-lg font-extrabold text-emerald-400">${Number(totalCopay || 0).toFixed(2)}</div>
                        <div className="text-[10px] text-[var(--text-dim)]">Total Copay</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Prescriptions */}
                <div className="bento-card">
                  <div className="flex items-center gap-2 mb-4">
                    <Pill className="h-4 w-4 text-cyan-400" />
                    <span className="text-sm font-bold text-[var(--text-strong)]">Active Prescriptions</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full tag-accent">{patientRx.length}</span>
                  </div>

                  {patientRx.length === 0 ? (
                    <p className="text-xs text-[var(--text-dim)] text-center py-6">No prescriptions on file.</p>
                  ) : (
                    <div className="space-y-2">
                      {patientRx.map((rx) => (
                        <div
                          key={rx.rx_number}
                          className="flex items-center justify-between p-3 rounded-xl"
                          style={{
                            background: rx.is_controlled_substance ? 'rgba(245, 158, 11, 0.04)' : 'var(--surface-1)',
                            border: `1px solid ${rx.is_controlled_substance ? 'rgba(245, 158, 11, 0.15)' : 'var(--border-default)'}`,
                          }}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
                              style={{
                                background: rx.is_controlled_substance ? 'rgba(245, 158, 11, 0.1)' : 'rgba(6, 182, 212, 0.08)',
                                border: `1px solid ${rx.is_controlled_substance ? 'rgba(245, 158, 11, 0.2)' : 'rgba(6, 182, 212, 0.15)'}`,
                              }}
                            >
                              {rx.is_controlled_substance ? (
                                <Shield className="h-3.5 w-3.5 text-amber-400" />
                              ) : (
                                <Pill className="h-3.5 w-3.5 text-cyan-400" />
                              )}
                            </div>
                            <div>
                              <div className="text-xs font-semibold text-[var(--text-strong)]">
                                {rx.drug_name} {rx.strength}
                              </div>
                              <div className="text-[10px] text-[var(--text-dim)]">
                                {rx.dosage_form} · {rx.refills_remaining} refills · Rx# {rx.rx_number}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs font-mono font-bold text-[var(--text-body)]">
                              {rx.copay_amount != null ? `$${Number(rx.copay_amount).toFixed(2)}` : '—'}
                            </div>
                            <div className="text-[9px] text-[var(--text-dim)]">
                              Due {rx.next_refill_due_date}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Bottom Row: Billing + Consultations */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Billing */}
                  <div className="bento-card">
                    <div className="flex items-center gap-2 mb-3">
                      <CreditCard className="h-4 w-4 text-violet-400" />
                      <span className="text-sm font-bold text-[var(--text-strong)]">Billing</span>
                    </div>
                    {billing ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between p-2 rounded-lg" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-default)' }}>
                          <span className="text-[11px] text-[var(--text-dim)]">Outstanding</span>
                          <span className="text-sm font-bold text-[var(--text-strong)]">${Number(billing.outstanding_balance || 0).toFixed(2)}</span>
                        </div>
                        {billing.insurance_provider && (
                          <div className="flex items-center justify-between p-2 rounded-lg" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-default)' }}>
                            <span className="text-[11px] text-[var(--text-dim)]">Insurance</span>
                            <span className="text-xs font-semibold text-[var(--text-body)]">{billing.insurance_provider}</span>
                          </div>
                        )}
                        {(billing.card_brand || billing.card_last_four || billing.card_last4) && (
                          <div className="flex items-center justify-between p-2 rounded-lg" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-default)' }}>
                            <span className="text-[11px] text-[var(--text-dim)]">Card</span>
                            <span className="text-xs font-mono text-[var(--text-body)]">
                              {billing.card_brand || '•••'} ****{billing.card_last_four || billing.card_last4 || ''}
                            </span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-[var(--text-dim)] text-center py-4">No billing data.</p>
                    )}
                  </div>

                  {/* Consultations */}
                  <div className="bento-card">
                    <div className="flex items-center gap-2 mb-3">
                      <FileText className="h-4 w-4 text-emerald-400" />
                      <span className="text-sm font-bold text-[var(--text-strong)]">Consultations</span>
                      {patientConsults.length > 0 && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full tag-success">{patientConsults.length}</span>
                      )}
                    </div>
                    {patientConsults.length === 0 ? (
                      <p className="text-xs text-[var(--text-dim)] text-center py-4">No consultations scheduled.</p>
                    ) : (
                      <div className="space-y-2 max-h-[160px] overflow-y-auto transcript-scroll">
                        {patientConsults.slice(0, 4).map((c) => (
                          <div
                            key={c.consultation_id}
                            className="p-2.5 rounded-lg"
                            style={{ background: 'var(--surface-1)', border: '1px solid var(--border-default)' }}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-semibold text-[var(--text-body)]">{c.consultation_type}</span>
                              <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${
                                c.status === 'completed' ? 'tag-success' : c.status === 'scheduled' ? 'tag-info' : 'tag-warning'
                              }`}>{c.status}</span>
                            </div>
                            <div className="text-[10px] text-[var(--text-dim)] mt-0.5">
                              {c.pharmacist_name} · {c.scheduled_time}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
