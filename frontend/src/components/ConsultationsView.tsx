'use client';

import { apiFetch } from '@/lib/api';
import React, { useState } from 'react';
import {
  Calendar,
  Clock,
  User,
  Phone,
  Plus,
  CheckCircle2,
  AlertCircle,
  Video,
  FileText,
  Search,
  Filter,
  Stethoscope,
  Sparkles,
  ChevronRight,
  ShieldAlert,
  X
} from 'lucide-react';
import { Patient, Consultation } from '@/lib/types';

interface ConsultationsViewProps {
  patients: Patient[];
  consultations: Consultation[];
  onRefresh: () => void;
  onOpenPhoneModal?: () => void;
}

export const ConsultationsView: React.FC<ConsultationsViewProps> = ({
  patients,
  consultations,
  onRefresh,
  onOpenPhoneModal
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'SCHEDULED' | 'PENDING' | 'COMPLETED'>('ALL');
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState(patients[0]?.patient_id || 'PAT-1001');
  const [scheduledTime, setScheduledTime] = useState('Tomorrow, 10:00 AM');
  const [reason, setReason] = useState('Comprehensive Medication Therapy Management (MTM) Review');
  const [pharmacistName, setPharmacistName] = useState('Dr. Marcus Vance, PharmD');
  const [submitting, setSubmitting] = useState(false);
  const [activeCallRoom, setActiveCallRoom] = useState<Consultation | null>(null);

  // Filter consultations
  const filteredConsultations = consultations.filter((c) => {
    const matchesSearch =
      (c.reason || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.patient_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.patient_name && c.patient_name.toLowerCase().includes(searchTerm.toLowerCase()));
    
    if (statusFilter === 'ALL') return matchesSearch;
    return matchesSearch && c.status.toUpperCase().includes(statusFilter);
  });

  const handleCreateConsultation = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await apiFetch('/api/consultations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id: selectedPatientId,
          scheduled_time: scheduledTime,
          reason,
          pharmacist_name: pharmacistName
        })
      });
      if (res.ok) {
        setIsScheduleModalOpen(false);
        onRefresh();
      }
    } catch (err) {
      console.error('Failed to schedule consultation', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0B1120] p-6 overflow-y-auto space-y-6">
      {/* Top Header & Metrics Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-purple-400 uppercase">
            <Stethoscope className="h-4 w-4" />
            <span>Medication Therapy Management & Clinical Care</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-100 mt-1">Pharmacist Consultation Queue</h1>
          <p className="text-sm text-slate-400">
            Lumistry-grade voice triage escalations, drug-drug interaction consultations, and scheduled MTM appointments.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => onRefresh()}
            className="px-3.5 py-2 text-xs font-medium text-slate-300 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-lg transition-colors"
          >
            Refresh Queue
          </button>
          <button
            onClick={() => setIsScheduleModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-950 bg-gradient-to-r from-purple-400 to-indigo-400 hover:from-purple-300 hover:to-indigo-300 rounded-lg shadow-md shadow-purple-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" />
            <span>Schedule New MTM</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/70 border border-slate-800/80 rounded-xl p-4 flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-slate-400">Total Consultations</div>
            <div className="text-2xl font-bold text-slate-100 mt-1">{consultations.length}</div>
            <div className="text-[11px] text-purple-400 mt-0.5">Across all enrolled patients</div>
          </div>
          <div className="h-10 w-10 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
            <Calendar className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-slate-900/70 border border-slate-800/80 rounded-xl p-4 flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-slate-400">Voice Bot Escalations</div>
            <div className="text-2xl font-bold text-amber-300 mt-1">
              {consultations.filter(c => c.status.toLowerCase().includes('pending') || (c.reason || '').toLowerCase().includes('voice')).length}
            </div>
            <div className="text-[11px] text-amber-400/80 mt-0.5">Auto-triaged by voice agent</div>
          </div>
          <div className="h-10 w-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Phone className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-slate-900/70 border border-slate-800/80 rounded-xl p-4 flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-slate-400">On-Duty Clinician</div>
            <div className="text-sm font-bold text-emerald-400 mt-1">Dr. Marcus Vance</div>
            <div className="text-[11px] text-slate-400 mt-0.5">PharmD, BCPS • Station Alpha</div>
          </div>
          <div className="h-10 w-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Stethoscope className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-slate-900/70 border border-slate-800/80 rounded-xl p-4 flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-slate-400">MTM Adherence Rate</div>
            <div className="text-2xl font-bold text-cyan-300 mt-1">96.8%</div>
            <div className="text-[11px] text-cyan-400/80 mt-0.5">+4.2% post voice reminders</div>
          </div>
          <div className="h-10 w-10 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/50 p-3 rounded-xl border border-slate-800/80">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search patient, topic, or Rx ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
          {(['ALL', 'SCHEDULED', 'PENDING', 'COMPLETED'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setStatusFilter(filter)}
              className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors shrink-0 ${
                statusFilter === filter
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              {filter === 'ALL' ? 'All Records' : filter.charAt(0) + filter.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Consultations List */}
      <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl overflow-hidden shadow-sm">
        {filteredConsultations.length === 0 ? (
          <div className="p-12 text-center">
            <Calendar className="h-12 w-12 text-slate-600 mx-auto mb-3" />
            <div className="text-base font-medium text-slate-300">No consultations found</div>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              There are currently no pharmacist consultations matching your filter criteria. Voice bot escalations will appear here automatically.
            </p>
            <button
              onClick={() => setIsScheduleModalOpen(true)}
              className="mt-4 px-4 py-1.5 text-xs font-semibold text-purple-300 bg-purple-500/10 border border-purple-500/30 rounded-lg hover:bg-purple-500/20 transition-colors"
            >
              Schedule an MTM Appointment
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/60">
            {filteredConsultations.map((c) => {
              const matchedPt = patients.find((p) => p.patient_id === c.patient_id);
              const isVoiceTriaged = (c.reason || '').toLowerCase().includes('voice') || (c.reason || '').toLowerCase().includes('escalat') || c.status.toLowerCase().includes('pending');

              return (
                <div
                  key={c.consultation_id}
                  className="p-4 hover:bg-slate-800/30 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-3.5">
                    <div className="h-10 w-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center shrink-0 text-purple-300 font-bold text-xs mt-0.5">
                      {c.patient_id.replace('PAT-', '#')}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-slate-100 text-sm">
                          {matchedPt ? `${matchedPt.first_name} ${matchedPt.last_name}` : c.patient_name || c.patient_id}
                        </span>
                        <span className="text-xs font-mono text-slate-400 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
                          {c.patient_id}
                        </span>
                        {isVoiceTriaged && (
                          <span className="text-[10px] font-semibold tracking-wider text-amber-300 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Sparkles className="h-3 w-3 text-amber-400" />
                            Voice Bot Request
                          </span>
                        )}
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                            c.status === 'COMPLETED'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                              : 'bg-purple-500/10 text-purple-300 border border-purple-500/30'
                          }`}
                        >
                          {c.status}
                        </span>
                      </div>

                      <div className="text-xs font-medium text-slate-300 mt-1 flex items-center gap-1.5">
                        <FileText className="h-3.5 w-3.5 text-purple-400 shrink-0" />
                        <span>{c.reason}</span>
                      </div>

                      <div className="flex items-center gap-4 text-[11px] text-slate-400 mt-2 flex-wrap">
                        <span className="flex items-center gap-1 text-slate-400">
                          <Clock className="h-3.5 w-3.5 text-slate-500" />
                          {c.scheduled_time}
                        </span>
                        <span className="flex items-center gap-1 text-slate-400">
                          <Stethoscope className="h-3.5 w-3.5 text-slate-500" />
                          {c.pharmacist_name || 'Dr. Marcus Vance, PharmD'}
                        </span>
                        {matchedPt?.primary_phone && (
                          <span className="flex items-center gap-1 text-slate-400 font-mono">
                            <Phone className="h-3.5 w-3.5 text-slate-500" />
                            {matchedPt.primary_phone}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                    <button
                      onClick={() => setActiveCallRoom(c)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-purple-300 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 rounded-lg transition-colors shadow-sm"
                    >
                      <Video className="h-3.5 w-3.5 text-purple-400" />
                      <span>Start Video Bridge</span>
                    </button>
                    {onOpenPhoneModal && (
                      <button
                        onClick={onOpenPhoneModal}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-lg transition-colors"
                      >
                        <Phone className="h-3.5 w-3.5 text-emerald-400" />
                        <span>Call Inbound</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Video Bridge Mock Modal */}
      {activeCallRoom && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-purple-500/40 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setActiveCallRoom(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-100"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2 text-xs font-semibold text-purple-400 uppercase tracking-wider mb-2">
              <Video className="h-4 w-4" />
              <span>HIPAA-Compliant Telehealth Bridge</span>
            </div>
            <h2 className="text-lg font-bold text-slate-100 mb-1">
              MTM Video Room: {activeCallRoom.patient_name || activeCallRoom.patient_id}
            </h2>
            <p className="text-xs text-slate-400 mb-4">
              Reason: {activeCallRoom.reason}
            </p>

            <div className="aspect-video bg-slate-900 rounded-xl border border-slate-800 flex flex-col items-center justify-center p-6 text-center">
              <div className="h-16 w-16 rounded-full bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 mb-3 animate-pulse">
                <Stethoscope className="h-8 w-8" />
              </div>
              <div className="text-sm font-semibold text-slate-200">Consultation Session Active</div>
              <p className="text-xs text-slate-400 mt-1">
                Connected to encrypted audio/video room for {activeCallRoom.patient_id}.
              </p>
              <div className="mt-4 flex items-center gap-2 text-[11px] text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/30">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Transcript synced to post-call LLM audit</span>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setActiveCallRoom(null)}
                className="px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-900 rounded-lg transition-colors border border-slate-800"
              >
                Close Room
              </button>
              <button
                onClick={() => {
                  setActiveCallRoom(null);
                  onRefresh();
                }}
                className="px-4 py-2 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors"
              >
                Complete & Sign Clinical Notes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Modal */}
      {isScheduleModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setIsScheduleModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-100"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2 text-xs font-semibold text-purple-400 uppercase tracking-wider mb-2">
              <Calendar className="h-4 w-4" />
              <span>Schedule MTM Appointment</span>
            </div>
            <h2 className="text-lg font-bold text-slate-100 mb-4">Book Clinical Consultation</h2>

            <form onSubmit={handleCreateConsultation} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-400 block mb-1">Select Patient</label>
                <select
                  value={selectedPatientId}
                  onChange={(e) => setSelectedPatientId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-900 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-purple-500"
                >
                  {patients.map((p) => (
                    <option key={p.patient_id} value={p.patient_id}>
                      {p.first_name} {p.last_name} ({p.patient_id}) - {p.primary_phone}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-400 block mb-1">Scheduled Time / Window</label>
                <input
                  type="text"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  placeholder="e.g. Tomorrow, 10:00 AM"
                  className="w-full px-3 py-2 text-xs bg-slate-900 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-purple-500"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-400 block mb-1">Clinical Topic / Reason</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 text-xs bg-slate-900 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-purple-500"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-400 block mb-1">Attending Pharmacist</label>
                <input
                  type="text"
                  value={pharmacistName}
                  onChange={(e) => setPharmacistName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-900 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsScheduleModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-900 rounded-lg transition-colors border border-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-xs font-semibold text-slate-950 bg-gradient-to-r from-purple-400 to-indigo-400 hover:from-purple-300 hover:to-indigo-300 rounded-lg transition-all"
                >
                  {submitting ? 'Booking...' : 'Confirm Appointment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
