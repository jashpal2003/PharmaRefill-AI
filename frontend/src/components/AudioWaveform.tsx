'use client';

import React from 'react';
import { Mic, Volume2, Activity } from 'lucide-react';

interface AudioWaveformProps {
  isAgentSpeaking: boolean;
  activeState?: string;
}

export const AudioWaveform: React.FC<AudioWaveformProps> = ({
  isAgentSpeaking,
  activeState = 'STANDBY'
}) => {
  const waveHeights = [
    14, 22, 38, 48, 30, 20, 36, 52, 44, 28, 40, 56, 32, 24, 46, 58,
    50, 34, 42, 54, 28, 22, 38, 48, 32, 18, 36, 50, 42, 26, 18, 12
  ];

  return (
    <div
      className="relative overflow-hidden rounded-xl mb-3"
      style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.07)',
        padding: '12px 14px'
      }}
    >
      {/* Subtle glow when active */}
      {isAgentSpeaking && (
        <div
          className="absolute -top-8 left-1/2 -translate-x-1/2 w-64 h-24 rounded-full blur-3xl pointer-events-none"
          style={{ background: 'rgba(59,130,246,0.12)' }}
        />
      )}

      {/* Top bar: state info */}
      <div className="relative flex items-center justify-between mb-3 z-10">
        <div className="flex items-center gap-2.5">
          {/* Orb indicator */}
          <div className="relative flex items-center justify-center h-5 w-5">
            {isAgentSpeaking && (
              <span className="absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-40 animate-ping" />
            )}
            <span
              className="relative inline-flex rounded-full h-2.5 w-2.5"
              style={{
                background: isAgentSpeaking
                  ? 'linear-gradient(135deg, #3B82F6, #06B6D4)'
                  : '#475569',
                boxShadow: isAgentSpeaking ? '0 0 8px rgba(59,130,246,0.6)' : 'none'
              }}
            />
          </div>

          <div>
            <span className="text-[11.5px] font-semibold flex items-center gap-1.5" style={{ color: isAgentSpeaking ? '#93C5FD' : 'rgba(255,255,255,0.5)' }}>
              {isAgentSpeaking ? (
                <><span style={{ color: '#60A5FA' }}>Cartesia Sonic-2</span><span style={{ color: 'rgba(255,255,255,0.4)' }}>· Synthesizing</span></>
              ) : (
                <><span style={{ color: 'rgba(255,255,255,0.6)' }}>AssemblyAI Universal-2</span><span style={{ color: 'rgba(255,255,255,0.3)' }}>· Listening</span></>
              )}
            </span>
            <span className="text-[9.5px] font-mono block" style={{ color: 'rgba(255,255,255,0.25)' }}>
              PCM16 · Cartesia Sonic-2 · latency in Analytics
            </span>
          </div>
        </div>

        {/* FSM State pill */}
        <span
          className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-lg"
          style={{
            background: isAgentSpeaking ? 'rgba(59,130,246,0.12)' : 'rgba(255,255,255,0.04)',
            border: isAgentSpeaking ? '1px solid rgba(59,130,246,0.28)' : '1px solid rgba(255,255,255,0.07)',
            color: isAgentSpeaking ? '#93C5FD' : 'rgba(255,255,255,0.35)'
          }}
        >
          {activeState}
        </span>
      </div>

      {/* Waveform visualizer */}
      <div
        className="relative flex items-center gap-0.5 rounded-xl overflow-hidden"
        style={{
          height: '52px',
          background: 'rgba(0,0,0,0.25)',
          border: '1px solid rgba(255,255,255,0.05)',
          padding: '0 12px'
        }}
      >
        {/* Left icon */}
        <div
          className="absolute left-2.5 h-7 w-7 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          {isAgentSpeaking ? (
            <Volume2 className="h-3.5 w-3.5 text-blue-400" />
          ) : (
            <Mic className="h-3.5 w-3.5" style={{ color: 'rgba(255,255,255,0.3)' }} />
          )}
        </div>

        {/* Wave bars */}
        <div className="flex-1 flex items-center justify-center gap-[2px] h-full px-10">
          {waveHeights.map((h, i) => (
            <div
              key={i}
              className="rounded-full transition-all duration-150"
              style={{
                width: '3px',
                height: isAgentSpeaking
                  ? `${Math.max(4, Math.min(40, h * (0.5 + 0.5 * Math.abs(Math.sin((i * 0.4) + Date.now() / 300)))))}px`
                  : '3px',
                background: isAgentSpeaking
                  ? `linear-gradient(180deg, #06B6D4, #3B82F6)`
                  : 'rgba(255,255,255,0.12)',
                opacity: isAgentSpeaking ? 0.9 : 0.5,
              }}
            />
          ))}
        </div>

        {/* Right: VAD indicator */}
        <div
          className="absolute right-2.5 flex items-center gap-1 px-2 py-0.5 rounded-md text-[9.5px] font-mono"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.3)' }}
        >
          <Activity className="h-2.5 w-2.5 text-blue-400" />
          <span>99.4%</span>
        </div>
      </div>
    </div>
  );
};

export default AudioWaveform;
