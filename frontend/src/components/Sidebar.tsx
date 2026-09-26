'use client';

import React from 'react';
import {
  Activity,
  LayoutDashboard,
  LogOut,
  Mic,
  Users,
} from 'lucide-react';
import { useAuth } from './AuthGate';

export type ActiveNavView = 'VOICE_ARENA' | 'COMMAND_CENTER' | 'PATIENTS';

const NAV_ITEMS: { id: ActiveNavView; label: string; icon: React.ElementType; gradient: string }[] = [
  { id: 'VOICE_ARENA', label: 'Voice Arena', icon: Mic, gradient: 'from-indigo-500 to-violet-500' },
  { id: 'COMMAND_CENTER', label: 'Command Center', icon: LayoutDashboard, gradient: 'from-cyan-500 to-blue-500' },
  { id: 'PATIENTS', label: 'Patients', icon: Users, gradient: 'from-emerald-500 to-teal-500' },
];

interface SidebarProps {
  activeView: ActiveNavView;
  onSelectView: (view: ActiveNavView) => void;
  isCallActive: boolean;
  isConnected: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  onSelectView,
  isCallActive,
  isConnected,
}) => {
  const { me, signOut } = useAuth();
  const initials = (me?.email || 'SA').slice(0, 2).toUpperCase();

  return (
    <aside
      className="w-[72px] h-screen flex flex-col items-center py-4 shrink-0 border-r"
      style={{
        background: 'rgba(6, 12, 24, 0.95)',
        backdropFilter: 'blur(24px)',
        borderColor: 'var(--glass-border)',
      }}
    >
      {/* Logo */}
      <div className="mb-6 relative group">
        <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/20 transition-transform group-hover:scale-105">
          <Activity className="h-5 w-5 text-white" strokeWidth={2.5} />
        </div>
        {/* Connection dot */}
        <span
          className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#060c18] ${
            isCallActive ? 'bg-emerald-400 animate-pulse' : isConnected ? 'bg-indigo-400' : 'bg-rose-400 animate-pulse'
          }`}
        />
      </div>

      {/* Nav Items */}
      <nav className="flex-1 flex flex-col items-center gap-1.5 w-full px-2">
        {NAV_ITEMS.map((item) => {
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectView(item.id)}
              aria-current={isActive ? 'page' : undefined}
              title={item.label}
              className="group relative w-full flex flex-col items-center gap-1 py-2.5 rounded-xl transition-all duration-200 cursor-pointer"
              style={{
                background: isActive ? 'var(--surface-2)' : 'transparent',
                border: isActive ? '1px solid var(--border-default)' : '1px solid transparent',
              }}
            >
              {/* Active indicator bar */}
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-gradient-to-b from-indigo-400 to-violet-400" />
              )}

              <div
                className={`h-8 w-8 rounded-lg flex items-center justify-center transition-all duration-200 ${
                  isActive
                    ? `bg-gradient-to-br ${item.gradient} shadow-lg`
                    : 'bg-transparent group-hover:bg-[var(--surface-1)]'
                }`}
              >
                <item.icon
                  className={`h-4 w-4 transition-colors ${
                    isActive ? 'text-white' : 'text-[var(--text-dim)] group-hover:text-[var(--text-body)]'
                  }`}
                />
              </div>

              <span
                className={`text-[9px] font-semibold tracking-wide transition-colors ${
                  isActive ? 'text-[var(--text-strong)]' : 'text-[var(--text-dim)] group-hover:text-[var(--text-body)]'
                }`}
              >
                {item.label.split(' ')[0]}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Bottom: User Avatar + Sign Out */}
      <div className="flex flex-col items-center gap-2 mt-auto pt-3">
        {me && (
          <>
            <div
              className="h-9 w-9 rounded-full flex items-center justify-center text-[10px] font-bold border transition-all cursor-default"
              title={me.email || 'Service account'}
              style={{
                background: 'rgba(99, 102, 241, 0.12)',
                borderColor: 'rgba(99, 102, 241, 0.25)',
                color: '#A5B4FC',
              }}
            >
              {initials}
            </div>
            <button
              onClick={signOut}
              className="icon-btn !h-7 !w-7"
              title="Sign out"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </>
        )}
      </div>
    </aside>
  );
};
