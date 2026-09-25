'use client';

import React, { useEffect, useState } from 'react';
import {
  Activity,
  BarChart3,
  Boxes,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  FileCheck,
  FileClock,
  Megaphone,
  Mic,
  Package,
  PhoneCall,
  ShieldCheck,
  Stethoscope,
  Syringe,
  Users,
} from 'lucide-react';
import { useAuth } from './AuthGate';

export type ActiveNavView =
  | 'CALL_CENTER'
  | 'DISPENSE_QUEUE'
  | 'PATIENT_REGISTRY'
  | 'CONSULTATIONS'
  | 'BILLING'
  | 'CLINICAL_AUDITS'
  | 'VOICE_SETTINGS'
  | 'ANALYTICS'
  | 'PRIOR_AUTH'
  | 'IMMUNIZATIONS'
  | 'OUTREACH'
  | 'INVENTORY'
  | 'COMPLIANCE';

interface NavItem {
  id: ActiveNavView;
  label: string;
  icon: React.ElementType;
}

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: 'Operations',
    items: [
      { id: 'CALL_CENTER', label: 'Live voice & triage', icon: PhoneCall },
      { id: 'DISPENSE_QUEUE', label: 'Prescription queue', icon: Package },
      { id: 'ANALYTICS', label: 'Analytics', icon: BarChart3 },
      { id: 'INVENTORY', label: 'Inventory & 340B', icon: Boxes },
    ],
  },
  {
    label: 'Clinical',
    items: [
      { id: 'PATIENT_REGISTRY', label: 'Patients & Med-Sync', icon: Users },
      { id: 'CONSULTATIONS', label: 'Clinical consults', icon: Stethoscope },
      { id: 'IMMUNIZATIONS', label: 'Immunizations', icon: Syringe },
      { id: 'OUTREACH', label: 'Proactive outreach', icon: Megaphone },
    ],
  },
  {
    label: 'Finance & QA',
    items: [
      { id: 'BILLING', label: 'Billing & copays', icon: CreditCard },
      { id: 'PRIOR_AUTH', label: 'Prior authorizations', icon: FileClock },
      { id: 'CLINICAL_AUDITS', label: 'Call audits & safety', icon: FileCheck },
      { id: 'COMPLIANCE', label: 'HIPAA & compliance', icon: ShieldCheck },
    ],
  },
  {
    label: 'System',
    items: [{ id: 'VOICE_SETTINGS', label: 'Voice AI studio', icon: Mic }],
  },
];

export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

interface SidebarProps {
  activeView: ActiveNavView;
  onSelectView: (view: ActiveNavView) => void;
  isCallActive: boolean;
  isConnected: boolean;
  queuedOrdersCount: number;
  consultationsCount: number;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

const COLLAPSE_KEY = 'rxtriage_sidebar_collapsed';

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  onSelectView,
  isCallActive,
  isConnected,
  queuedOrdersCount,
  consultationsCount,
  mobileOpen = false,
  onCloseMobile,
}) => {
  const { me } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    let saved: string | null = null;
    try { saved = localStorage.getItem(COLLAPSE_KEY); } catch {}
    setCollapsed(saved != null ? saved === '1' : window.innerWidth < 1024);
  }, []);

  const toggle = () => {
    setCollapsed((c) => {
      try { localStorage.setItem(COLLAPSE_KEY, c ? '0' : '1'); } catch {}
      return !c;
    });
  };

  const badgeFor = (id: ActiveNavView): { text: string; live?: boolean } | null => {
    if (id === 'CALL_CENTER' && isCallActive) return { text: 'Live', live: true };
    if (id === 'DISPENSE_QUEUE' && queuedOrdersCount > 0) return { text: String(queuedOrdersCount) };
    if (id === 'CONSULTATIONS' && consultationsCount > 0) return { text: String(consultationsCount) };
    return null;
  };

  const initials = (me?.email || 'SA').slice(0, 2).toUpperCase();

  // Phones: off-canvas drawer (always expanded). Desktop: inline, collapsible.
  const isCollapsed = collapsed && !mobileOpen;
  const select = (id: ActiveNavView) => {
    onSelectView(id);
    onCloseMobile?.();
  };

  return (
    <>
    {mobileOpen && <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={onCloseMobile} aria-hidden="true" />}
    <aside className={`sidebar-root h-screen flex-col shrink-0 border-r border-subtle transition-[width] duration-200 ${isCollapsed ? 'w-[64px]' : 'w-[228px]'}
      ${mobileOpen ? 'flex fixed inset-y-0 left-0 z-50 shadow-2xl' : 'hidden md:flex'}`}
      style={{ background: 'var(--bg-surface)' }}
      aria-label="Main navigation">
      <div className="h-14 flex items-center justify-between px-3 shrink-0 border-b border-subtle">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="h-8 w-8 rounded-xl flex items-center justify-center shrink-0 bg-gradient-to-br from-blue-500 to-indigo-500">
            <Activity className="h-4 w-4 text-white" strokeWidth={2.5} />
          </div>
          {!isCollapsed && (
            <div className="min-w-0">
              <div className="text-sm font-bold text-strong leading-none">RxTriage AI</div>
              <div className="text-[11px] text-muted truncate mt-1">Community Care · SF</div>
            </div>
          )}
        </div>
        <button onClick={mobileOpen ? onCloseMobile : toggle} className="icon-btn !h-7 !w-7 shrink-0" aria-label={mobileOpen ? 'Close menu' : collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
        </button>
      </div>

      {!isCollapsed && (
        <div className="px-3 pt-3 shrink-0">
          <div className={`rounded-lg px-2.5 py-2 flex items-center gap-2 text-xs border ${isCallActive ? 'border-emerald-500/30 bg-emerald-500/10' : 'surface-1'}`}>
            <span className={`h-2 w-2 rounded-full shrink-0 ${isCallActive ? 'bg-emerald-400 animate-pulse' : isConnected ? 'bg-slate-400' : 'bg-rose-400'}`} />
            <span className={isCallActive ? 'text-emerald-300 font-medium' : 'text-muted'}>
              {isCallActive ? 'Call in progress' : isConnected ? 'Line idle' : 'Reconnecting…'}
            </span>
          </div>
        </div>
      )}

      <nav className="flex-1 py-3 px-2 overflow-y-auto">
        {NAV_GROUPS.map((group, gi) => (
          <div key={group.label} className={gi > 0 ? 'mt-4' : ''}>
            {!isCollapsed ? (
              <div className="px-2.5 pb-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-muted">{group.label}</div>
            ) : gi > 0 && <div className="mx-2 mb-3 h-px bg-[var(--border-default)]" />}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = activeView === item.id;
                const badge = badgeFor(item.id);
                return (
                  <li key={item.id}>
                    <button
                      onClick={() => select(item.id)}
                      aria-current={isActive ? 'page' : undefined}
                      title={isCollapsed ? item.label : undefined}
                      className="nav-item relative w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left text-[13px] border border-transparent cursor-pointer transition-colors"
                    >
                      {isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-[3px] rounded-r bg-blue-400" />}
                      <item.icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-blue-400' : ''}`} />
                      {!isCollapsed && <span className="flex-1 truncate">{item.label}</span>}
                      {!isCollapsed && badge && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${badge.live ? 'bg-emerald-500/20 text-emerald-300' : 'bg-[var(--surface-2)] text-body'}`}>
                          {badge.text}
                        </span>
                      )}
                      {isCollapsed && badge && <span className={`absolute top-1 right-1 h-2 w-2 rounded-full ${badge.live ? 'bg-emerald-400' : 'bg-blue-400'}`} />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="p-2.5 shrink-0 border-t border-subtle">
        <div className={`flex items-center gap-2.5 ${isCollapsed ? 'justify-center' : 'px-1'}`} title={isCollapsed ? me?.email || '' : undefined}>
          <div className="h-8 w-8 rounded-full bg-indigo-500/20 text-indigo-200 text-[11px] font-bold flex items-center justify-center shrink-0 border border-indigo-400/30">
            {initials}
          </div>
          {!isCollapsed && (
            <div className="min-w-0">
              <div className="text-xs text-strong truncate">{me?.email || 'Service account'}</div>
              <div className="text-[11px] text-muted capitalize">{me?.role || '—'}</div>
            </div>
          )}
        </div>
      </div>
    </aside>
    </>
  );
};
