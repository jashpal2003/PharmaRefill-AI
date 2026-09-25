'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart2,
  Camera,
  ChevronDown,
  FileText,
  LogOut,
  MessageSquare,
  Moon,
  PhoneCall,
  RotateCcw,
  Menu,
  Search,
  Sun,
  Wrench,
} from 'lucide-react';
import { Patient } from '@/lib/types';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from './AuthGate';
import { useFeedback } from './feedback';
import { ActiveNavView, NAV_ITEMS } from './Sidebar';

interface HeaderProps {
  isConnected: boolean;
  patients: Patient[];
  selectedPatient: Patient | null;
  onSelectPatient: (patientId: string) => void;
  onNavigate: (view: ActiveNavView) => void;
  onOpenPhoneModal: () => void;
  onOpenBenchmarkModal: () => void;
  onOpenSnapModal: () => void;
  onOpenSmsModal: () => void;
  onOpenSoapModal: () => void;
  onResetDemo: () => void;
  onOpenMobileNav: () => void;
  activeView: ActiveNavView;
}

export const VIEW_META: Record<ActiveNavView, { section: string; title: string }> = {
  CALL_CENTER: { section: 'Operations', title: 'Live voice & triage' },
  DISPENSE_QUEUE: { section: 'Operations', title: 'Prescription queue' },
  ANALYTICS: { section: 'Operations', title: 'Analytics' },
  INVENTORY: { section: 'Operations', title: 'Inventory & 340B' },
  PATIENT_REGISTRY: { section: 'Clinical', title: 'Patients & Med-Sync' },
  CONSULTATIONS: { section: 'Clinical', title: 'Clinical consults' },
  IMMUNIZATIONS: { section: 'Clinical', title: 'Immunizations' },
  OUTREACH: { section: 'Clinical', title: 'Proactive outreach' },
  BILLING: { section: 'Finance & QA', title: 'Billing & copays' },
  PRIOR_AUTH: { section: 'Finance & QA', title: 'Prior authorizations' },
  CLINICAL_AUDITS: { section: 'Finance & QA', title: 'Call audits & safety' },
  COMPLIANCE: { section: 'Finance & QA', title: 'HIPAA & compliance' },
  VOICE_SETTINGS: { section: 'System', title: 'Voice AI studio' },
};

/** Closes a popover on outside click / Escape. */
function usePopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return { open, setOpen, ref };
}

export const Header: React.FC<HeaderProps> = (props) => {
  const { activeView, isConnected } = props;
  const meta = VIEW_META[activeView];
  return (
    <header className="header-root h-14 px-4 lg:px-5 flex items-center gap-3 sticky top-0 z-30 shrink-0 border-b border-subtle">
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <div className="md:hidden shrink-0">
          <button onClick={props.onOpenMobileNav} className="icon-btn" aria-label="Open menu">
            <Menu className="h-4 w-4" />
          </button>
        </div>
        <span
          className={`h-2 w-2 rounded-full shrink-0 ${isConnected ? 'bg-emerald-400' : 'bg-rose-400 animate-pulse'}`}
          title={isConnected ? 'Live updates connected' : 'Live updates disconnected: reconnecting'}
          aria-label={isConnected ? 'Live updates connected' : 'Live updates disconnected'}
        />
        <div className="min-w-0">
          <div className="text-[11px] text-muted leading-none">{meta.section}</div>
          <h1 className="text-sm font-semibold text-strong truncate leading-tight mt-0.5">{meta.title}</h1>
        </div>
      </div>

      <GlobalSearch {...props} />

      <div className="flex items-center gap-1.5 shrink-0">
        <PatientPicker {...props} />
        <ToolsMenu {...props} />
        <button onClick={props.onOpenPhoneModal} className="btn btn-primary !py-1.5">
          <PhoneCall className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Softphone</span>
        </button>
        <UserMenu onResetDemo={props.onResetDemo} />
      </div>
    </header>
  );
};

const GlobalSearch: React.FC<HeaderProps> = ({ patients, onSelectPatient, onNavigate }) => {
  const { open, setOpen, ref } = usePopover();
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setOpen]);

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    const pts = patients
      .filter((p) => !term || `${p.first_name} ${p.last_name} ${p.primary_phone} ${p.patient_id}`.toLowerCase().includes(term))
      .slice(0, 6)
      .map((p) => ({ key: p.patient_id, kind: 'Patient', label: `${p.first_name} ${p.last_name}`, hint: p.patient_id,
        run: () => { onSelectPatient(p.patient_id); onNavigate('PATIENT_REGISTRY'); } }));
    const views = NAV_ITEMS
      .filter((v) => term && v.label.toLowerCase().includes(term))
      .map((v) => ({ key: v.id, kind: 'Go to', label: v.label, hint: '', run: () => onNavigate(v.id) }));
    return [...pts, ...views];
  }, [q, patients, onSelectPatient, onNavigate]);

  const choose = (i: number) => {
    results[i]?.run();
    setQ('');
    setOpen(false);
    inputRef.current?.blur();
  };

  return (
    <div ref={ref} className="relative hidden md:block w-[260px] lg:w-[320px]">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted pointer-events-none" />
      <input
        ref={inputRef}
        value={q}
        onChange={(e) => { setQ(e.target.value); setActive(0); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
          if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
          if (e.key === 'Enter') { e.preventDefault(); choose(active); }
        }}
        placeholder="Search patients or screens"
        aria-label="Search patients or screens"
        role="combobox"
        aria-expanded={open}
        aria-controls="global-search-results"
        className="field w-full !py-1.5 !pl-8 !pr-12 !text-xs"
      />
      <kbd className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted border border-subtle rounded px-1.5 py-0.5 pointer-events-none">Ctrl K</kbd>
      {open && (
        <div id="global-search-results" role="listbox" className="menu left-0 right-0 mt-1.5">
          {results.length ? results.map((r, i) => (
            <button key={`${r.kind}-${r.key}`} role="option" aria-selected={i === active} data-active={i === active}
              onMouseEnter={() => setActive(i)} onClick={() => choose(i)} className="menu-item">
              <span className="text-[10px] uppercase tracking-wide text-muted w-12 shrink-0">{r.kind}</span>
              <span className="truncate">{r.label}</span>
              {r.hint && <span className="hint font-mono">{r.hint}</span>}
            </button>
          )) : <div className="px-3 py-2.5 text-xs text-muted">No matches for “{q}”</div>}
        </div>
      )}
    </div>
  );
};

const PatientPicker: React.FC<HeaderProps> = ({ patients, selectedPatient, onSelectPatient }) => {
  const { open, setOpen, ref } = usePopover();
  if (!patients.length) return null;
  const current = selectedPatient || patients[0];
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)} className="btn btn-ghost !py-1.5 !px-2.5 max-w-[190px]" aria-haspopup="listbox" aria-expanded={open}
        title="Active patient: context for SOAP, SMS and clinical checks">
        <span className="h-5 w-5 rounded-full bg-blue-500/20 text-blue-300 text-[10px] font-bold flex items-center justify-center shrink-0">
          {current.first_name[0]}{current.last_name[0]}
        </span>
        <span className="truncate hidden lg:inline">{current.first_name} {current.last_name}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted" />
      </button>
      {open && (
        <div role="listbox" aria-label="Choose active patient" className="menu right-0 mt-1.5">
          <div className="px-2.5 pt-1 pb-1.5 text-[10px] uppercase tracking-wide text-muted">Active patient</div>
          {patients.map((p) => (
            <button key={p.patient_id} role="option" aria-selected={p.patient_id === current.patient_id} data-active={p.patient_id === current.patient_id}
              onClick={() => { onSelectPatient(p.patient_id); setOpen(false); }} className="menu-item">
              <span>{p.first_name} {p.last_name}</span>
              <span className="hint font-mono">{p.patient_id}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const ToolsMenu: React.FC<HeaderProps> = ({ onOpenSmsModal, onOpenSoapModal, onOpenSnapModal, onOpenBenchmarkModal }) => {
  const { open, setOpen, ref } = usePopover();
  const tools = [
    { icon: FileText, label: 'Draft SOAP note', hint: 'Active patient', run: onOpenSoapModal },
    { icon: MessageSquare, label: 'SMS & pickup locker', hint: 'Outbox', run: onOpenSmsModal },
    { icon: Camera, label: 'Snap-to-Verify', hint: 'NDC barcode', run: onOpenSnapModal },
    { icon: BarChart2, label: 'Speech accuracy (WER)', hint: 'Benchmark', run: onOpenBenchmarkModal },
  ];
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)} className="btn btn-ghost !py-1.5 !px-2.5" aria-haspopup="menu" aria-expanded={open}>
        <Wrench className="h-3.5 w-3.5" />
        <span className="hidden xl:inline">Tools</span>
        <ChevronDown className="h-3.5 w-3.5 text-muted" />
      </button>
      {open && (
        <div role="menu" className="menu right-0 mt-1.5">
          {tools.map((t) => (
            <button key={t.label} role="menuitem" onClick={() => { setOpen(false); t.run(); }} className="menu-item">
              <t.icon className="h-4 w-4 text-muted" />
              <span>{t.label}</span>
              <span className="hint">{t.hint}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const UserMenu: React.FC<{ onResetDemo: () => void }> = ({ onResetDemo }) => {
  const { me, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { confirm } = useFeedback();
  const { open, setOpen, ref } = usePopover();
  if (!me) return null;
  const initials = (me.email || 'SA').slice(0, 2).toUpperCase();

  const reset = async () => {
    setOpen(false);
    if (await confirm({
      title: 'Reset demo data?',
      description: 'All patients, prescriptions, orders and calls are replaced with the original demo seed. The HIPAA access log is kept.',
      confirmLabel: 'Reset data', danger: true,
    })) onResetDemo();
  };

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)} className="h-8 w-8 rounded-full bg-indigo-500/20 text-indigo-200 text-[11px] font-bold border border-indigo-400/30 cursor-pointer"
        aria-haspopup="menu" aria-expanded={open} aria-label={`Account menu for ${me.email || 'service account'}`}>
        {initials}
      </button>
      {open && (
        <div role="menu" className="menu right-0 mt-1.5 w-64">
          <div className="px-2.5 py-2 border-b border-subtle mb-1">
            <div className="text-sm text-strong truncate">{me.email || 'Service account'}</div>
            <div className="text-xs text-muted capitalize">{me.role}{me.phi_masked ? ' · patient details masked' : ''}</div>
          </div>
          <button role="menuitem" onClick={toggleTheme} className="menu-item">
            {theme === 'dark' ? <Sun className="h-4 w-4 text-muted" /> : <Moon className="h-4 w-4 text-muted" />}
            {theme === 'dark' ? 'Light theme' : 'Dark theme'}
          </button>
          {me.role === 'admin' && (
            <button role="menuitem" onClick={reset} className="menu-item">
              <RotateCcw className="h-4 w-4 text-muted" /> Reset demo data
            </button>
          )}
          <button role="menuitem" onClick={signOut} className="menu-item">
            <LogOut className="h-4 w-4 text-muted" /> Sign out
          </button>
        </div>
      )}
    </div>
  );
};
