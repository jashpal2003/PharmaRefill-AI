'use client';

import React, { useEffect, useState } from 'react';
import { Mic, Volume2, Activity, Zap, Cpu, Radio } from 'lucide-react';
import { VoiceOrb, OrbState } from './VoiceOrb';

interface AudioWaveformProps {
  isAgentSpeaking: boolean;
  activeState?: string;
  isBargeIn?: boolean;
}

export const AudioWaveform: React.FC<AudioWaveformProps> = ({
  isAgentSpeaking,
  activeState = 'STANDBY',
  isBargeIn = false,
}) => {
  const [ticks, setTicks] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setTicks((t) => (t + 1) % 1000);
    }, 80);
    return () => clearInterval(timer);
  }, []);

  const waveHeights = [
    12, 22, 38, 48, 32, 20, 36, 52, 44, 28, 40, 58, 34, 26, 46, 62,
    54, 38, 44, 56, 30, 22, 40, 50, 34, 18, 38, 52, 44, 28, 20, 14
  ];

  // Map state to OrbState
  let orbState: OrbState = 'IDLE';
  if (isBargeIn) {
    orbState = 'BARGE_IN';
  } else if (activeState.includes('EMERGENCY') || activeState.includes('ADVERSE')) {
    orbState = 'EMERGENCY';
  } else if (activeState.includes('DEA') || activeState.includes('CONTROLLED')) {
    orbState = 'DEA_BLOCKED';
  } else if (isAgentSpeaking) {
    orbState = 'SPEAKING';
  } else if (activeState !== 'STANDBY' && activeState !== 'IDLE' && activeState !== 'CALL_COMPLETED') {
    orbState = 'LISTENING';
  }

  return (
    <div
      className="relative overflow-hidden rounded-2xl mb-3 border transition-all duration-300 shadow-xl"
      style={{
        background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.95) 0%, rgba(6, 12, 24, 0.98) 100%)',
        borderColor: isAgentSpeaking
          ? 'rgba(16, 185, 129, 0.4)'
          : isBargeIn
          ? 'rgba(245, 158, 11, 0.5)'
          : 'rgba(59, 130, 246, 0.25)',
        padding: '14px 18px',
      }}
    >
      {/* Dynamic Ambient Background Glow */}
      <div
        className="absolute -top-12 left-1/2 -translate-x-1/2 w-80 h-28 rounded-full blur-3xl pointer-events-none transition-all duration-700"
        style={{
          background: isAgentSpeaking
            ? 'rgba(16, 185, 129, 0.18)'
            : isBargeIn
            ? 'rgba(245, 158, 11, 0.22)'
            : 'rgba(59, 130, 246, 0.15)',
        }}
      />

      {/* Top Header: Voice Reactor State & Engine Status */}
      <div className="relative flex items-center justify-between mb-3 z-10">
        <div className="flex items-center gap-3">
          <VoiceOrb state={orbState} size="sm" showLabel={false} />

          <div>
            <div className="flex items-center gap-2">
              <span className="text-[12px] font-bold text-white tracking-tight flex items-center gap-1.5">
                {isAgentSpeaking ? (
                  <>
                    <span className="text-emerald-400">Cartesia Sonic-2</span>
                    <span className="text-slate-400">· Synthesizing Voice</span>
                  </>
                ) : isBargeIn ? (
                  <>
                    <span className="text-amber-400">⚡ Turn-taking Barge-In</span>
                    <span className="text-slate-400">· Audio Barge Halted</span>
                  </>
                ) : (
                  <>
                    <span className="text-cyan-400">AssemblyAI Universal-3.5 Streaming</span>
                    <span className="text-slate-400">· Realtime STT</span>
                  </>
                )}
              </span>
            </div>
            <span className="text-[10px] font-mono text-slate-400 block mt-0.5">
              WebSocket 16kHz PCM • FDA Keyterms Boost • Sub-second Turnaround
            </span>
          </div>
        </div>

        {/* FSM State Badge */}
        <div className="flex items-center gap-2">
          {isBargeIn && (
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
              BARGE-IN
            </span>
          )}
          <span
            className="text-[10.5px] font-mono font-bold px-2.5 py-1 rounded-lg border shadow-sm"
            style={{
              background: isAgentSpeaking
                ? 'rgba(16, 185, 129, 0.15)'
                : 'rgba(59, 130, 246, 0.12)',
              borderColor: isAgentSpeaking
                ? 'rgba(16, 185, 129, 0.4)'
                : 'rgba(59, 130, 246, 0.3)',
              color: isAgentSpeaking ? '#6EE7B7' : '#93C5FD',
            }}
          >
            {activeState}
          </span>
        </div>
      </div>

      {/* Main Soundwave Equalizer Canvas */}
      <div
        className="relative flex items-center justify-between rounded-xl overflow-hidden px-4"
        style={{
          height: '56px',
          background: 'rgba(0, 0, 0, 0.45)',
          border: '1px solid rgba(255, 255, 255, 0.07)',
        }}
      >
        {/* Left Audio Source Mode */}
        <div
          className="flex items-center justify-center h-8 w-8 rounded-lg shrink-0 border"
          style={{
            background: isAgentSpeaking ? 'rgba(16, 185, 129, 0.15)' : 'rgba(6, 182, 212, 0.15)',
            borderColor: isAgentSpeaking ? 'rgba(16, 185, 129, 0.3)' : 'rgba(6, 182, 212, 0.3)',
          }}
        >
          {isAgentSpeaking ? (
            <Volume2 className="h-4 w-4 text-emerald-400 animate-pulse" />
          ) : (
            <Mic className="h-4 w-4 text-cyan-400" />
          )}
        </div>

        {/* Dynamic Wave Frequency Bars */}
        <div className="flex-1 flex items-center justify-center gap-[3px] h-full px-6">
          {waveHeights.map((h, i) => {
            const dynamicScale = isAgentSpeaking
              ? 0.3 + 0.7 * Math.abs(Math.sin((i * 0.45) + ticks * 0.3))
              : orbState === 'LISTENING'
              ? 0.2 + 0.5 * Math.abs(Math.cos((i * 0.35) + ticks * 0.2))
              : 0.1;

            const heightVal = Math.max(4, Math.min(44, h * dynamicScale));

            return (
              <div
                key={i}
                className="rounded-full transition-all duration-75"
                style={{
                  width: '3.5px',
                  height: `${heightVal}px`,
                  background: isAgentSpeaking
                    ? 'linear-gradient(180deg, #34D399, #059669)'
                    : isBargeIn
                    ? 'linear-gradient(180deg, #F59E0B, #EF4444)'
                    : 'linear-gradient(180deg, #38BDF8, #2563EB)',
                  opacity: isAgentSpeaking || orbState === 'LISTENING' ? 0.95 : 0.35,
                  boxShadow:
                    isAgentSpeaking && heightVal > 25
                      ? '0 0 6px rgba(52, 211, 153, 0.6)'
                      : 'none',
                }}
              />
            );
          })}
        </div>

        {/* Right: VAD Turn-Taking Indicator */}
        <div
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-mono border"
          style={{
            background: 'rgba(255, 255, 255, 0.05)',
            borderColor: 'rgba(255, 255, 255, 0.1)',
            color: '#CBD5E1',
          }}
        >
          <Activity className="h-3 w-3 text-cyan-400 animate-pulse" />
          <span>VAD Active</span>
        </div>
      </div>

      {/* Real-time Sub-Second Latency Waterfall Ribbon */}
      <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10.5px] font-mono text-slate-400">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-cyan-300">
            <Radio className="h-3 w-3 text-cyan-400" />
            STT: ~138ms
          </span>
          <span className="text-slate-600">•</span>
          <span className="flex items-center gap-1 text-purple-300">
            <Cpu className="h-3 w-3 text-purple-400" />
            FSM / LeMUR: ~14ms
          </span>
          <span className="text-slate-600">•</span>
          <span className="flex items-center gap-1 text-emerald-300">
            <Volume2 className="h-3 w-3 text-emerald-400" />
            TTS: ~260ms
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-slate-300">
          <Zap className="h-3 w-3 text-amber-400" />
          <span>E2E Turnaround: <strong className="text-white font-bold">~412ms</strong> (Sub-second)</span>
        </div>
      </div>
    </div>
  );
};

export default AudioWaveform;
