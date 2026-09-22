'use client';

import React from 'react';
import { Radio, CheckCircle2 } from 'lucide-react';
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
  return (
    <div className="flex flex-col h-full glass-panel rounded-2xl p-5 border border-slate-800">
      {/* Panel Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 mb-4">
        <div className="flex items-center gap-2">
          <Radio className={`h-4 w-4 ${activeSessionId ? 'text-emerald-400 animate-pulse' : 'text-slate-500'}`} />
          <h2 className="text-sm font-semibold tracking-wide uppercase text-slate-200">
            Live Inbound Call Monitor
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800/80 text-slate-300">
            {activeSessionId ? activeSessionId : 'IDLE / STANDBY'}
          </span>
        </div>
      </div>

      {/* Telemetry & Compliance Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs mb-4">
        <div className="bg-slate-900/80 p-2 rounded-xl border border-slate-800">
          <span className="text-slate-400 block text-[11px]">Caller ANI</span>
          <span className="font-mono text-emerald-400 font-medium">
            +1 (415) 555-0192
          </span>
        </div>
        <div className="bg-slate-900/80 p-2 rounded-xl border border-slate-800">
          <span className="text-slate-400 block text-[11px]">ANI Telemetry Match</span>
          <span className="text-teal-300 font-medium flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3 text-teal-400" />
            PAT-1001 (Eleanor)
          </span>
        </div>
        <div className="bg-slate-900/80 p-2 rounded-xl border border-slate-800 col-span-2 sm:col-span-1">
          <span className="text-slate-400 block text-[11px]">Statutory Consent</span>
          <span className="text-indigo-300 font-medium flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3 text-indigo-400" />
            Two-Party Disclosed
          </span>
        </div>
      </div>

      {/* Real-Time Audio Waveform & Speech Activity */}
      <AudioWaveform isAgentSpeaking={isAgentSpeaking} activeState={activeState} />

      {/* Chronological Transcript Feed with Real-time Word Boost Badges */}
      <TranscriptFeed
        transcript={transcript}
        recentTokens={recentTokens}
        retryCount={retryCount}
      />
    </div>
  );
};

