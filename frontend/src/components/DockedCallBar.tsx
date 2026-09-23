'use client';

import React from 'react';
import { PhoneCall, Maximize2, Volume2, Mic } from 'lucide-react';
import { Patient } from '@/lib/types';

interface DockedCallBarProps {
  isCallActive: boolean;
  activeSessionId: string | null;
  activeState: string;
  isAgentSpeaking: boolean;
  patient: Patient | null;
  onOpenPhoneModal: () => void;
  onHangup?: () => void;
}

export const DockedCallBar: React.FC<DockedCallBarProps> = ({
  isCallActive,
  activeSessionId,
  activeState,
  isAgentSpeaking,
  patient,
  onOpenPhoneModal
}) => {
  if (!isCallActive && !activeSessionId) return null;

  return (
    <div
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-11/12 max-w-2xl flex items-center justify-between gap-4 px-4 py-3 rounded-2xl"
      style={{
        background: 'rgba(7, 14, 30, 0.92)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: '1px solid rgba(59, 130, 246, 0.28)',
        boxShadow: '0 0 0 1px rgba(255,255,255,0.04) inset, 0 16px 40px -8px rgba(0,0,0,0.7), 0 0 28px rgba(59,130,246,0.12)'
      }}
    >
      {/* Left: Call info */}
      <div className="flex items-center gap-3 min-w-0">
        {/* Live phone icon */}
        <div className="relative shrink-0">
          <div className="h-9 w-9 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)' }}>
            <PhoneCall className="h-4 w-4 text-blue-400" />
          </div>
          <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-70" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
          </span>
        </div>

        {/* Metadata */}
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[12px] font-semibold text-white truncate">
              {patient ? `${patient.first_name} ${patient.last_name}` : 'Inbound Caller'}
            </span>
            <span className="text-[9.5px] font-mono px-1.5 py-0.5 rounded-md"
              style={{ background: 'rgba(59,130,246,0.12)', color: '#93C5FD', border: '1px solid rgba(59,130,246,0.22)' }}>
              {activeSessionId ? activeSessionId.slice(0, 12) + '…' : 'LIVE'}
            </span>
            {isAgentSpeaking && (
              <span className="text-[9.5px] font-semibold flex items-center gap-1 px-1.5 py-0.5 rounded-md"
                style={{ background: 'rgba(59,130,246,0.15)', color: '#93C5FD', border: '1px solid rgba(59,130,246,0.25)' }}>
                <Mic className="h-2.5 w-2.5" />
                Speaking
              </span>
            )}
          </div>
          <div className="text-[10.5px] flex items-center gap-1.5 mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
            <span className="font-mono">{activeState}</span>
            <span>·</span>
            <span className="truncate">{patient?.primary_phone || '+1 (415) 555-0192'}</span>
          </div>
        </div>
      </div>

      {/* Center: mini waveform */}
      <div className="hidden sm:flex items-center gap-0.5 h-6 px-3 rounded-lg"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
        {[35, 65, 50, 85, 55, 75, 40, 90, 30, 70, 45].map((h, i) => (
          <div
            key={i}
            className="w-[3px] rounded-full transition-all duration-150"
            style={{
              background: isAgentSpeaking ? '#3B82F6' : 'rgba(255,255,255,0.15)',
              height: isAgentSpeaking ? `${h}%` : '18%',
              opacity: isAgentSpeaking ? 1 : 0.5,
              animationDelay: `${i * 80}ms`
            }}
          />
        ))}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={onOpenPhoneModal}
          className="flex items-center gap-1.5 px-3.5 py-2 text-[11.5px] font-semibold text-white rounded-xl transition-all cursor-pointer active:scale-95"
          style={{
            background: 'linear-gradient(135deg, #3B82F6, #2563EB)',
            border: '1px solid rgba(59,130,246,0.5)',
            boxShadow: '0 4px 12px -2px rgba(59,130,246,0.4)'
          }}
        >
          <Maximize2 className="h-3.5 w-3.5" />
          <span>Open</span>
        </button>
      </div>
    </div>
  );
};
