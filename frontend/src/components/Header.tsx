'use client';

import React, { useState } from 'react';
import {
  PhoneCall,
  BarChart2,
  Camera,
  Search,
  Command,
  ChevronRight,
  Sun,
  Moon,
  MessageSquare,
  FileText,
  RotateCcw,
  ChevronDown,
  User,
  Wifi,
  WifiOff
} from 'lucide-react';
import { Patient } from '@/lib/types';
import { ActiveNavView } from './Sidebar';
import { useTheme } from '@/hooks/useTheme';

interface HeaderProps {
  isConnected: boolean;
  patients: Patient[];
  selectedPatient: Patient | null;
  onSelectPatient: (patientId: string) => void;
  onOpenPhoneModal: () => void;
  onOpenBenchmarkModal: () => void;
  onOpenSnapModal: () => void;
  onOpenSmsModal?: () => void;
  onOpenSoapModal?: () => void;
  onResetDemo: () => void;
  activeView?: ActiveNavView;
}

const VIEW_META: Record<ActiveNavView, { category: string; title: string; subtitle: string }> = {
  CALL_CENTER:    { category: 'Clinical Operations', title: 'Live Voice Triage', subtitle: 'Cartesia Sonic-2 · AssemblyAI streaming STT · measured latency in Analytics' },
  DISPENSE_QUEUE: { category: 'Pharmacy Fulfillment', title: 'Dispense & Verification Queue', subtitle: 'Pre-flight safety checks, Med-Sync batching' },
  PATIENT_REGISTRY: { category: 'Clinical EHR', title: 'Patient Registry & Med-Sync', subtitle: 'Longitudinal profiles, payer coverage & Rx alignment' },
  CONSULTATIONS:  { category: 'Clinical Pharmacist', title: 'Consultations & CMR', subtitle: 'MTM scheduling and pharmacist follow-up tracking' },
  BILLING:        { category: 'Revenue Cycle', title: 'Billing, Copay & Adjudication', subtitle: 'Real-time Medicare Part D & commercial copay calculations' },
  CLINICAL_AUDITS: { category: 'Quality Assurance', title: 'LLM Call Audits & Safety', subtitle: 'Title 21 CFR § 1306 · HIPAA · Clinical safety sentinel' },
  VOICE_SETTINGS: { category: 'System Config', title: 'Voice AI & Telephony Settings', subtitle: 'Cartesia voice models, AssemblyAI params & prompt tuning' },
  ANALYTICS:      { category: 'Operations', title: 'Analytics', subtitle: 'Containment, handle time, measured latency, Star adherence' },
  INVENTORY:      { category: 'Operations', title: 'Inventory & 340B', subtitle: 'Lot-level stock, expiry horizons, 340B claim routing' },
  IMMUNIZATIONS:  { category: 'Clinical', title: 'Immunizations', subtitle: 'ACIP schedule, pre-screening, HL7 VXU registry messages' },
  OUTREACH:       { category: 'Clinical', title: 'Proactive Outreach', subtitle: 'Refill, adherence, flu and CMR campaigns with opt-out' },
  PRIOR_AUTH:     { category: 'Revenue Cycle', title: 'Prior Authorizations', subtitle: 'PA board with CMS-0057-F decision timers and appeals' },
  COMPLIANCE:     { category: 'Quality Assurance', title: 'HIPAA & Compliance', subtitle: 'Immutable access log, retrospective DUR, SDOH screening' }
};

export const Header: React.FC<HeaderProps> = ({
  isConnected,
  patients,
  selectedPatient,
  onSelectPatient,
  onOpenPhoneModal,
  onOpenBenchmarkModal,
  onOpenSnapModal,
  onOpenSmsModal,
  onOpenSoapModal,
  onResetDemo,
  activeView = 'CALL_CENTER'
}) => {
  const meta = VIEW_META[activeView] || VIEW_META.CALL_CENTER;
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="h-14 px-5 flex items-center justify-between gap-4 sticky top-0 z-30 shrink-0 header-root">

      {/* Left: Breadcrumb + View Title */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {/* Connection status */}
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="relative">
            {isConnected ? (
              <Wifi className="h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <WifiOff className="h-3.5 w-3.5 text-rose-400" />
            )}
          </div>
        </div>

        <div className="h-5 w-px shrink-0" style={{ background: 'rgba(255,255,255,0.08)' }} />

        {/* Breadcrumb */}
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1.5 text-[10.5px] font-medium" style={{ color: 'rgba(255,255,255,0.35)' }}>
            <span>{meta.category}</span>
            <ChevronRight className="h-3 w-3" style={{ color: 'rgba(255,255,255,0.2)' }} />
            <span className="font-semibold truncate" style={{ color: 'rgba(255,255,255,0.7)' }}>{meta.title}</span>
          </div>
          <p className="text-[10px] truncate hidden xl:block" style={{ color: 'rgba(255,255,255,0.25)' }}>
            {meta.subtitle}
          </p>
        </div>
      </div>

      {/* Center: Universal Search */}
      <div className="hidden md:flex items-center flex-shrink-0 w-[280px] lg:w-[340px]">
        <div className="w-full relative flex items-center">
          <Search className="absolute left-3 h-3.5 w-3.5 pointer-events-none" style={{ color: 'rgba(255,255,255,0.25)' }} />
          <input
            type="text"
            readOnly
            placeholder="Search patient, NDC, Rx# or guideline..."
            onClick={onOpenPhoneModal}
            className="w-full h-8 pl-8.5 pr-14 rounded-xl text-[11.5px] placeholder:font-normal cursor-pointer outline-none transition-all"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: 'rgba(255,255,255,0.6)',
              paddingLeft: '34px'
            }}
          />
          <div className="absolute right-2.5 flex items-center gap-0.5 px-1.5 py-0.5 rounded-md"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <Command className="h-2.5 w-2.5" style={{ color: 'rgba(255,255,255,0.3)' }} />
            <span className="text-[9px] font-mono" style={{ color: 'rgba(255,255,255,0.3)' }}>K</span>
          </div>
        </div>
      </div>

      {/* Right: Controls + Actions */}
      <div className="flex items-center gap-1.5 shrink-0">

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-medium transition-all duration-200 cursor-pointer"
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: 'rgba(255,255,255,0.55)'
          }}
          title={theme === 'dark' ? 'Switch to Clinical Light Mode' : 'Switch to Executive Dark Mode'}
        >
          {theme === 'dark' ? (
            <>
              <Sun className="h-3.5 w-3.5 text-amber-400" />
              <span className="hidden lg:inline">Clinical</span>
            </>
          ) : (
            <>
              <Moon className="h-3.5 w-3.5 text-indigo-400" />
              <span className="hidden lg:inline text-slate-600">Executive</span>
            </>
          )}
        </button>

        {/* SMS & Lockers */}
        {onOpenSmsModal && (
          <button
            onClick={onOpenSmsModal}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-medium transition-all duration-200 cursor-pointer"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: 'rgba(255,255,255,0.55)'
            }}
            title="Outbound SMS & Drive-Thru Locker"
          >
            <MessageSquare className="h-3.5 w-3.5 text-blue-400" />
            <span className="hidden xl:inline">SMS</span>
          </button>
        )}

        {/* SOAP Notes */}
        {onOpenSoapModal && (
          <button
            onClick={onOpenSoapModal}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-medium transition-all duration-200 cursor-pointer"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: 'rgba(255,255,255,0.55)'
            }}
            title="Generate SOAP Note"
          >
            <FileText className="h-3.5 w-3.5 text-purple-400" />
            <span className="hidden xl:inline">SOAP</span>
          </button>
        )}

        {/* WER Benchmark */}
        <button
          onClick={onOpenBenchmarkModal}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-mono font-medium transition-all duration-200 cursor-pointer"
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: 'rgba(255,255,255,0.55)'
          }}
          title="AssemblyAI WER Benchmarks"
        >
          <BarChart2 className="h-3.5 w-3.5" style={{ color: 'rgba(255,255,255,0.4)' }} />
          <span className="hidden sm:inline">WER Benchmark</span>
        </button>

        {/* Snap Verify */}
        <button
          onClick={onOpenSnapModal}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-medium transition-all duration-200 cursor-pointer"
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: 'rgba(255,255,255,0.55)'
          }}
          title="Snap-to-Verify Rx Label"
        >
          <Camera className="h-3.5 w-3.5" style={{ color: 'rgba(255,255,255,0.4)' }} />
          <span className="hidden xl:inline">Snap</span>
        </button>

        {/* Divider */}
        <div className="h-5 w-px" style={{ background: 'rgba(255,255,255,0.08)' }} />

        {/* Patient Selector */}
        {patients.length > 0 && (
          <div
            className="flex items-center gap-2 rounded-xl px-2.5 py-1.5 cursor-pointer transition-all duration-150"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.09)'
            }}
          >
            <div className="h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0"
              style={{ background: 'rgba(59,130,246,0.2)', color: '#93C5FD', border: '1px solid rgba(59,130,246,0.25)' }}>
              {selectedPatient ? selectedPatient.first_name[0] : 'P'}
            </div>
            <select
              value={selectedPatient?.patient_id || 'PAT-1001'}
              onChange={(e) => onSelectPatient(e.target.value)}
              className="bg-transparent text-[11px] font-medium focus:outline-none cursor-pointer pr-0.5"
              style={{ color: 'rgba(255,255,255,0.65)' }}
              title="Switch Active Patient"
            >
              {patients.map((p) => (
                <option key={p.patient_id} value={p.patient_id} className="bg-slate-900 text-white">
                  {p.first_name} {p.last_name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Primary Softphone CTA */}
        <button
          onClick={onOpenPhoneModal}
          className="flex items-center gap-2 px-4 py-1.5 rounded-xl text-white font-semibold text-[12px] transition-all duration-200 cursor-pointer active:scale-95"
          style={{
            background: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
            border: '1px solid rgba(59,130,246,0.5)',
            boxShadow: '0 4px 14px -2px rgba(59,130,246,0.4), 0 0 0 1px rgba(255,255,255,0.06) inset'
          }}
        >
          <PhoneCall className="h-3.5 w-3.5" />
          <span>Softphone</span>
        </button>

        {/* Reset */}
        <button
          onClick={onResetDemo}
          className="p-2 rounded-xl transition-all duration-150 cursor-pointer"
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: 'rgba(255,255,255,0.3)'
          }}
          title="Reset Demo State"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
      </div>
    </header>
  );
};
