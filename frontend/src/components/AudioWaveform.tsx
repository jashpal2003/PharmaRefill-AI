'use client';

import React from 'react';

interface AudioWaveformProps {
  isAgentSpeaking: boolean;
  activeState?: string;
}

export const AudioWaveform: React.FC<AudioWaveformProps> = ({
  isAgentSpeaking,
  activeState = 'STANDBY'
}) => {
  const barHeights = [12, 24, 38, 18, 28, 42, 30, 16, 34, 46, 22, 14, 28, 40, 20, 32, 44, 26, 18, 36];

  return (
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
        {barHeights.map((height, i) => (
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
  );
};
export default AudioWaveform;
