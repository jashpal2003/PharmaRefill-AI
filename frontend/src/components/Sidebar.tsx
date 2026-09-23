'use client';

import React from 'react';
import {
  PhoneCall,
  Package,
  Users,
  Calendar,
  CreditCard,
  FileCheck,
  Settings,
  Activity,
  ChevronLeft,
  ChevronRight,
  Radio,
  Stethoscope,
  LayoutDashboard,
  Mic,
  BarChart3,
  FileClock,
  Syringe,
  Megaphone,
  Boxes,
  ShieldCheck
} from 'lucide-react';

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

interface SidebarProps {
  activeView: ActiveNavView;
  onSelectView: (view: ActiveNavView) => void;
  isCallActive: boolean;
  queuedOrdersCount: number;
  consultationsCount: number;
}

const NAV_GROUPS = [
  {
    label: 'Operations',
    items: [
      {
        id: 'CALL_CENTER' as ActiveNavView,
        label: 'Live Voice & Triage',
        shortLabel: 'Voice',
        icon: PhoneCall,
        color: 'text-blue-400',
        activeGlow: 'rgba(59, 130, 246, 0.15)'
      },
      {
        id: 'DISPENSE_QUEUE' as ActiveNavView,
        label: 'Prescription Queue',
        shortLabel: 'Queue',
        icon: Package,
        color: 'text-violet-400',
        activeGlow: 'rgba(139, 92, 246, 0.15)'
      },
      {
        id: 'ANALYTICS' as ActiveNavView,
        label: 'Analytics',
        shortLabel: 'Analytics',
        icon: BarChart3,
        color: 'text-sky-400',
        activeGlow: 'rgba(56, 189, 248, 0.15)'
      },
      {
        id: 'INVENTORY' as ActiveNavView,
        label: 'Inventory & 340B',
        shortLabel: 'Stock',
        icon: Boxes,
        color: 'text-lime-400',
        activeGlow: 'rgba(163, 230, 53, 0.12)'
      },
    ]
  },
  {
    label: 'Clinical',
    items: [
      {
        id: 'PATIENT_REGISTRY' as ActiveNavView,
        label: 'Patients & Med-Sync',
        shortLabel: 'Patients',
        icon: Users,
        color: 'text-emerald-400',
        activeGlow: 'rgba(16, 185, 129, 0.15)'
      },
      {
        id: 'CONSULTATIONS' as ActiveNavView,
        label: 'Clinical Consults',
        shortLabel: 'Consults',
        icon: Stethoscope,
        color: 'text-cyan-400',
        activeGlow: 'rgba(6, 182, 212, 0.15)'
      },
      {
        id: 'IMMUNIZATIONS' as ActiveNavView,
        label: 'Immunizations',
        shortLabel: 'Vaccines',
        icon: Syringe,
        color: 'text-teal-400',
        activeGlow: 'rgba(45, 212, 191, 0.15)'
      },
      {
        id: 'OUTREACH' as ActiveNavView,
        label: 'Proactive Outreach',
        shortLabel: 'Outreach',
        icon: Megaphone,
        color: 'text-pink-400',
        activeGlow: 'rgba(244, 114, 182, 0.15)'
      },
    ]
  },
  {
    label: 'Finance & QA',
    items: [
      {
        id: 'BILLING' as ActiveNavView,
        label: 'Billing & Copays',
        shortLabel: 'Billing',
        icon: CreditCard,
        color: 'text-amber-400',
        activeGlow: 'rgba(245, 158, 11, 0.15)'
      },
      {
        id: 'PRIOR_AUTH' as ActiveNavView,
        label: 'Prior Authorizations',
        shortLabel: 'PA',
        icon: FileClock,
        color: 'text-orange-400',
        activeGlow: 'rgba(251, 146, 60, 0.15)'
      },
      {
        id: 'CLINICAL_AUDITS' as ActiveNavView,
        label: 'Audits & Safety',
        shortLabel: 'Audits',
        icon: FileCheck,
        color: 'text-rose-400',
        activeGlow: 'rgba(244, 63, 94, 0.15)'
      },
      {
        id: 'COMPLIANCE' as ActiveNavView,
        label: 'HIPAA & Compliance',
        shortLabel: 'HIPAA',
        icon: ShieldCheck,
        color: 'text-red-300',
        activeGlow: 'rgba(252, 165, 165, 0.12)'
      },
    ]
  },
  {
    label: 'System',
    items: [
      {
        id: 'VOICE_SETTINGS' as ActiveNavView,
        label: 'Voice AI Studio',
        shortLabel: 'Settings',
        icon: Mic,
        color: 'text-slate-400',
        activeGlow: 'rgba(148, 163, 184, 0.1)'
      },
    ]
  }
];

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  onSelectView,
  isCallActive,
  queuedOrdersCount,
  consultationsCount
}) => {
  const [collapsed, setCollapsed] = React.useState(false);

  const getBadge = (id: ActiveNavView) => {
    if (id === 'CALL_CENTER' && isCallActive) return { label: 'LIVE', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/35' };
    if (id === 'DISPENSE_QUEUE' && queuedOrdersCount > 0) return { label: String(queuedOrdersCount), color: 'bg-slate-700/60 text-slate-300 border-slate-600/40' };
    if (id === 'CONSULTATIONS' && consultationsCount > 0) return { label: String(consultationsCount), color: 'bg-slate-700/60 text-slate-300 border-slate-600/40' };
    return null;
  };

  return (
    <aside
      className={`h-screen flex flex-col transition-all duration-300 z-30 select-none shrink-0 sidebar-root ${
        collapsed ? 'w-[68px]' : 'w-[220px]'
      }`}
    >
      {/* Brand Header */}
      <div className="h-16 flex items-center justify-between px-3.5 shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-3 overflow-hidden min-w-0">
          {/* Logo Mark */}
          <div className="h-8 w-8 rounded-xl flex items-center justify-center shrink-0 relative"
            style={{
              background: 'linear-gradient(135deg, #3B82F6 0%, #6366F1 100%)',
              boxShadow: '0 0 0 1px rgba(255,255,255,0.12) inset, 0 4px 14px rgba(59,130,246,0.4)'
            }}>
            <Activity className="h-4 w-4 text-white stroke-[2.5]" />
          </div>

          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[13px] font-bold tracking-tight text-white leading-none">
                  RxTriage
                </span>
                <span className="text-[13px] font-black" style={{ background: 'linear-gradient(135deg, #60A5FA, #818CF8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  AI
                </span>
                <span className="text-[9px] px-1 py-0.5 rounded-md font-mono font-semibold" style={{ background: 'rgba(59,130,246,0.12)', color: '#93C5FD', border: '1px solid rgba(59,130,246,0.2)' }}>
                  v2.5
                </span>
              </div>
              <span className="text-[10px] font-medium truncate" style={{ color: 'rgba(255,255,255,0.35)' }}>
                Community Care · SF
              </span>
            </div>
          )}
        </div>

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="h-6 w-6 rounded-lg flex items-center justify-center transition-all duration-150 cursor-pointer shrink-0 hover:bg-white/10"
          style={{ color: 'rgba(255,255,255,0.3)' }}
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* Live Call Status Banner */}
      {!collapsed && (
        <div className="px-3 pt-2.5 pb-1 shrink-0">
          <div
            className="rounded-xl p-2.5 flex items-center justify-between gap-2 transition-all duration-300"
            style={{
              background: isCallActive ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.03)',
              border: isCallActive ? '1px solid rgba(16,185,129,0.22)' : '1px solid rgba(255,255,255,0.06)'
            }}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="relative flex h-2 w-2 shrink-0">
                {isCallActive && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                )}
                <span className={`relative inline-flex rounded-full h-2 w-2 ${isCallActive ? 'bg-emerald-400' : 'bg-slate-600'}`} />
              </span>
              <span className="text-[11px] font-semibold truncate" style={{ color: isCallActive ? '#34D399' : 'rgba(255,255,255,0.3)' }}>
                {isCallActive ? 'Active Live Call' : 'Line Standby'}
              </span>
            </div>
            <span className="text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded shrink-0" style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.3)', border: '1px solid rgba(255,255,255,0.08)' }}>
              WebSocket
            </span>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 py-2 px-2 space-y-0.5 overflow-y-auto">
        {NAV_GROUPS.map((group, gi) => (
          <div key={gi} className={gi > 0 ? 'pt-3' : ''}>
            {!collapsed && (
              <div className="px-2 pb-1.5">
                <span className="text-[9.5px] font-semibold uppercase tracking-[0.1em]" style={{ color: 'rgba(255,255,255,0.22)' }}>
                  {group.label}
                </span>
              </div>
            )}
            {collapsed && gi > 0 && (
              <div className="mx-2 mb-2 h-px" style={{ background: 'rgba(255,255,255,0.07)' }} />
            )}

            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = activeView === item.id;
                const badge = getBadge(item.id);

                return (
                  <button
                    key={item.id}
                    onClick={() => onSelectView(item.id)}
                    title={collapsed ? item.label : undefined}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left transition-all duration-150 cursor-pointer group relative overflow-hidden"
                    style={{
                      background: isActive ? item.activeGlow : 'transparent',
                      border: isActive ? '1px solid rgba(255,255,255,0.09)' : '1px solid transparent',
                    }}
                  >
                    {/* Active indicator line */}
                    {isActive && (
                      <span
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 rounded-r-full"
                        style={{ height: '16px', background: 'linear-gradient(180deg, #60A5FA, #818CF8)', boxShadow: '0 0 6px rgba(59,130,246,0.6)' }}
                      />
                    )}

                    <item.icon
                      className={`h-4 w-4 shrink-0 transition-all duration-150 ${
                        isActive ? item.color : 'group-hover:text-white'
                      }`}
                      style={{ color: isActive ? undefined : 'rgba(255,255,255,0.35)' }}
                    />

                    {!collapsed && (
                      <>
                        <span
                          className="flex-1 text-[12px] font-medium truncate transition-colors"
                          style={{ color: isActive ? '#fff' : 'rgba(255,255,255,0.45)' }}
                        >
                          {item.label}
                        </span>
                        {badge && (
                          <span className={`text-[9.5px] px-1.5 py-0.5 rounded-full shrink-0 font-semibold border tracking-wide ${badge.color}`}>
                            {badge.label}
                          </span>
                        )}
                      </>
                    )}

                    {collapsed && badge && (
                      <span className="absolute top-0.5 right-0.5 h-2 w-2 rounded-full bg-emerald-400" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Pharmacist Profile Footer */}
      <div className="px-2 pb-3 pt-2 shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        {!collapsed ? (
          <div className="p-2.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex items-center gap-2.5">
              <div className="relative shrink-0">
                <div className="h-7 w-7 rounded-lg flex items-center justify-center text-blue-300 font-bold text-[10px]"
                  style={{ background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.25)' }}>
                  MV
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-400" style={{ outline: '2px solid #060c18' }} />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[11px] font-semibold truncate" style={{ color: 'rgba(255,255,255,0.75)' }}>
                  Dr. Marcus Vance
                </span>
                <span className="text-[9.5px] font-mono truncate" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  PharmD · Outpatient 1
                </span>
              </div>
            </div>

            <div className="mt-2 flex items-center justify-between text-[9px] font-mono" style={{ color: 'rgba(255,255,255,0.25)' }}>
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
                Cartesia Sonic-2
              </span>
              <span>AssemblyAI VAD</span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1.5">
            <div className="h-7 w-7 rounded-lg flex items-center justify-center text-blue-300 font-bold text-[10px]"
              style={{ background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.25)' }}>
              MV
            </div>
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          </div>
        )}
      </div>
    </aside>
  );
};
