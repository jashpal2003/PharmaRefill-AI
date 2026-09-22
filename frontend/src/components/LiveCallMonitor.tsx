'use client';

import React from 'react';
import { Phone, User, Bot, Sparkles, CheckCircle2, ShieldAlert, Radio } from 'lucide-react';
import { TranscriptMessage, TokenItem } from '@/lib/types';

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
      <div className="bg-slate-950/70 rounded-xl p-3 border border-slate-800/80 mb-4">
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="text-slate-400 font-medium flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${isAgentSpeaking ? 'bg-emerald-400 animate-ping' : 'bg-cyan-400'}`} />
            {isAgentSpeaking ? 'Cartesia Sonic Synthesizing (0.92x)' : 'AssemblyAI Listening / VAD Active'}
          </span>
          <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300">
            FSM: {activeState}
          </span>
        </div>

        {/* Dynamic Waveform Bars */}
        <div className="h-10 flex items-center justify-center gap-1 bg-slate-900/50 rounded-lg px-3 overflow-hidden">
          {[12, 24, 38, 18, 28, 42, 30, 16, 34, 46, 22, 14, 28, 40, 20, 32, 44, 26, 18, 36].map((height, i) => (
            <div
              key={i}
              className={`w-1.5 rounded-full transition-all duration-150 ${
                isAgentSpeaking
                  ? 'bg-gradient-to-t from-emerald-500 to-teal-300 waveform-bar'
                  : 'bg-gradient-to-t from-cyan-600 to-blue-400'
              }`}
              style={{
                height: isAgentSpeaking ? `${height}px` : '6px',
                animationDelay: `${(i % 5) * 0.15}s`
              }}
            />
          ))}
        </div>
      </div>

      {/* Word Boost Streaming Tokens Bubble */}
      {recentTokens.length > 0 && (
        <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-xl p-3 mb-4">
          <div className="flex items-center justify-between text-xs text-emerald-400 font-semibold mb-2">
            <div className="flex items-center gap-1">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Real-Time Streaming Tokens (AssemblyAI Keyterms Boost)</span>
            </div>
            <span className="text-[11px] font-mono text-emerald-300/80">
              Avg Conf: 98.4%
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {recentTokens.map((t, idx) => (
              <span
                key={idx}
                className={`text-xs px-2 py-0.5 rounded-md font-mono flex items-center gap-1 transition-all ${
                  t.is_word_boost_match
                    ? 'word-boost-badge font-bold'
                    : 'bg-slate-800 text-slate-300 border border-slate-700/60'
                }`}
              >
                {t.text}
                <span className="text-[9px] opacity-75">
                  {Math.round(t.confidence * 100)}%
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Dead-End Escape & Retry Sentinel */}
      <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-slate-900/60 border border-slate-800 text-xs mb-3">
        <span className="text-slate-400">Finite-State Retry Counter:</span>
        <div className="flex items-center gap-1.5">
          <span className={`font-mono font-bold px-2 py-0.5 rounded ${
            retryCount === 0
              ? 'bg-slate-800 text-emerald-300'
              : retryCount === 1
              ? 'bg-amber-950/60 text-amber-300 border border-amber-500/40'
              : 'bg-rose-950/60 text-rose-300 border border-rose-500/40'
          }`}>
            {retryCount} / 2 Attempts
          </span>
          <span className="text-[11px] text-slate-400">
            {retryCount >= 2 ? '(Handoff Triggered)' : '(Safe)'}
          </span>
        </div>
      </div>

      {/* Chronological Transcript Feed */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs">
        {transcript.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 py-12 text-center">
            <Phone className="h-8 w-8 mb-2 opacity-40" />
            <p>No active call in session.</p>
            <p className="text-[11px]">Click "Launch Inbound Call Simulator" to trigger a scenario.</p>
          </div>
        ) : (
          transcript.map((msg) => (
            <div
              key={msg.id}
              className={`p-3 rounded-xl border transition-all ${
                msg.speaker === 'CALLER'
                  ? 'bg-slate-900/90 border-slate-700 text-slate-100 ml-4'
                  : msg.speaker === 'AGENT'
                  ? msg.isEscalation
                    ? 'bg-rose-950/30 border-rose-600/50 text-rose-100 mr-4'
                    : 'bg-emerald-950/20 border-emerald-600/40 text-emerald-100 mr-4'
                  : 'bg-slate-950/60 border-slate-800 text-slate-400 text-center font-mono text-[11px]'
              }`}
            >
              <div className="flex items-center justify-between mb-1 opacity-75 text-[10px]">
                <span className="font-semibold flex items-center gap-1">
                  {msg.speaker === 'CALLER' ? (
                    <>
                      <User className="h-3 w-3 text-cyan-400" /> Caller (Eleanor)
                    </>
                  ) : msg.speaker === 'AGENT' ? (
                    <>
                      <Bot className="h-3 w-3 text-emerald-400" /> PharmaRefill Voice Agent
                    </>
                  ) : (
                    'System Event'
                  )}
                </span>
                <span>{msg.timestamp}</span>
              </div>
              <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
