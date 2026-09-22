'use client';

import React from 'react';
import { Activity, PhoneCall, ShieldCheck, Zap, RotateCcw, BarChart2, Camera } from 'lucide-react';

interface HeaderProps {
  isConnected: boolean;
  onOpenPhoneModal: () => void;
  onOpenBenchmarkModal: () => void;
  onOpenSnapModal: () => void;
  onResetDemo: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  isConnected,
  onOpenPhoneModal,
  onOpenBenchmarkModal,
  onOpenSnapModal,
  onResetDemo
}) => {
  return (
    <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md px-6 py-3 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Brand & Station */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Activity className="h-6 w-6 text-slate-950" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-white">
                PharmaRefill <span className="text-emerald-400">AI</span>
              </h1>
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 font-medium">
                RxTriage v2.0
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
                Counter 1
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Zero-Error Clinical Voice Triage & Medication Synchronization Platform
            </p>
          </div>
        </div>

        {/* Live System Badges */}
        <div className="flex items-center flex-wrap gap-2 text-xs">
          {/* Socket Status */}
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${
            isConnected
              ? 'bg-emerald-950/40 border-emerald-600/40 text-emerald-300'
              : 'bg-rose-950/40 border-rose-600/40 text-rose-300'
          }`}>
            <span className={`h-2 w-2 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
            {isConnected ? 'Telemetry Online' : 'Connecting...'}
          </div>

          {/* Speech Engine */}
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-cyan-950/40 border border-cyan-700/40 text-cyan-300 font-mono">
            <Zap className="h-3 w-3" />
            <span>AssemblyAI Universal STT (Keyterms Prompt)</span>
          </div>

          {/* DEA Guardrail */}
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-950/40 border border-amber-600/40 text-amber-300">
            <ShieldCheck className="h-3 w-3" />
            <span>DEA Title 21 CFR § 1306 Enforced</span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenPhoneModal}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs transition shadow-md shadow-emerald-500/20 cursor-pointer"
          >
            <PhoneCall className="h-3.5 w-3.5" />
            <span>Launch Inbound Call Simulator</span>
          </button>

          <button
            onClick={onOpenBenchmarkModal}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs border border-slate-700 transition cursor-pointer"
            title="View AssemblyAI Empirical WER Benchmark"
          >
            <BarChart2 className="h-3.5 w-3.5 text-cyan-400" />
            <span className="hidden sm:inline">WER Benchmark (3.8%)</span>
          </button>

          <button
            onClick={onOpenSnapModal}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs border border-slate-700 transition cursor-pointer"
            title="Snap-to-Verify Camera Link"
          >
            <Camera className="h-3.5 w-3.5 text-teal-400" />
            <span className="hidden lg:inline">Snap-to-Verify</span>
          </button>

          <button
            onClick={onResetDemo}
            className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700/60 transition cursor-pointer"
            title="Reset Database to Clean Demo State"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
};
