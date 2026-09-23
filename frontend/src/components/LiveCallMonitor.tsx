'use client';

import React from 'react';
import { CheckCircle2, ShieldCheck, PhoneCall, Wifi, Radio } from 'lucide-react';
import { TranscriptMessage, TokenItem } from '@/lib/types';
import { AudioWaveform } from './AudioWaveform';
import { TranscriptFeed } from './TranscriptFeed';

interface LiveCallMonitorProps {
  activeSessionId: string | null;
  activeState: string;
  isAgentSpeaking: boolean;
  transcript: TranscriptMessage[];
  recentTokens: TokenItem[];
  retryCount: number;
}

export const LiveCallMonitor: React.FC<LiveCallMonitorProps> = ({
  activeSessionId,
  activeState,
  isAgentSpeaking,
  transcript,
  recentTokens,
  retryCount
}) => {
  const isLive = Boolean(activeSessionId) || activeState !== 'DISCONNECTED';

  return (
    <div className="flex flex-col h-full glass-panel-elevated rounded-2xl overflow-hidden border border-slate-800/70">
      {/* Panel Header */}
      <div className="flex items-center justify-between px-5 py-3.5 shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-3">
          {/* Live indicator */}
          <div className="relative flex items-center justify-center">
            <span
              className={`h-2.5 w-2.5 rounded-full relative z-10 ${isLive ? 'bg-emerald-400' : 'bg-slate-600'}`}
            />
            {isLive && (
              <span className="absolute h-5 w-5 rounded-full bg-emerald-400/25 animate-ping" />
            )}
          </div>

          <div>
            <h2 className="text-[12px] font-bold tracking-tight text-white">
              Live Inbound Monitor
            </h2>
            <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
              SIP Trunk · Twilio Carrier Gateway
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Transport badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10.5px] font-mono"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)' }}>
            <Wifi className="h-3 w-3 text-blue-400" />
            <span>FastAPI WebSocket</span>
          </div>

          {/* Session ID */}
          <span
            className="text-[10.5px] font-mono px-2.5 py-1 rounded-lg font-semibold"
            style={{
              background: isLive ? 'rgba(59,130,246,0.12)' : 'rgba(255,255,255,0.04)',
              border: isLive ? '1px solid rgba(59,130,246,0.25)' : '1px solid rgba(255,255,255,0.07)',
              color: isLive ? '#93C5FD' : 'rgba(255,255,255,0.3)'
            }}
          >
            {activeSessionId ? activeSessionId.slice(0, 16) + '…' : 'SESSION STANDBY'}
          </span>
        </div>
      </div>

      {/* Telemetry Strip — 3 columns */}
      <div className="grid grid-cols-3 gap-2 p-4 shrink-0">
        {[
          {
            label: 'Caller ANI',
            value: '+1 (415) 555-0192',
            icon: <PhoneCall className="h-3 w-3" style={{ color: 'rgba(255,255,255,0.3)' }} />,
            mono: true
          },
          {
            label: 'ANI Match',
            value: 'PAT-1001 · Eleanor Vance',
            icon: <CheckCircle2 className="h-3 w-3 text-blue-400" />,
            mono: false
          },
          {
            label: 'Consent',
            value: 'Two-Party Disclosed',
            icon: <ShieldCheck className="h-3 w-3 text-slate-400" />,
            mono: false
          }
        ].map((item) => (
          <div
            key={item.label}
            className="px-3 py-2.5 rounded-xl flex items-center justify-between gap-2"
            style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            <div className="min-w-0">
              <span className="text-[9.5px] uppercase font-mono font-semibold tracking-[0.08em] block" style={{ color: 'rgba(255,255,255,0.25)' }}>
                {item.label}
              </span>
              <span
                className={`text-[11px] font-semibold truncate block ${item.mono ? 'font-mono' : ''}`}
                style={{ color: 'rgba(255,255,255,0.75)' }}
              >
                {item.value}
              </span>
            </div>
            {item.icon}
          </div>
        ))}
      </div>

      {/* Audio Waveform Visualizer */}
      <div className="px-4 shrink-0">
        <AudioWaveform isAgentSpeaking={isAgentSpeaking} activeState={activeState} />
      </div>

      {/* Live Transcript Feed */}
      <div className="flex-1 min-h-0 flex flex-col px-4 pb-4 pt-2">
        <div className="flex items-center justify-between mb-2 shrink-0">
          <span className="text-[10px] font-semibold uppercase tracking-[0.1em]" style={{ color: 'rgba(255,255,255,0.25)' }}>
            Live Transcript
          </span>
          {retryCount > 0 && (
            <span className="text-[9.5px] font-mono px-2 py-0.5 rounded-md" style={{ background: 'rgba(245,158,11,0.12)', color: '#FCD34D', border: '1px solid rgba(245,158,11,0.25)' }}>
              Retry #{retryCount}
            </span>
          )}
        </div>
        <div className="flex-1 min-h-0">
          <TranscriptFeed
            transcript={transcript}
            recentTokens={recentTokens}
            retryCount={retryCount}
          />
        </div>
      </div>
    </div>
  );
};
