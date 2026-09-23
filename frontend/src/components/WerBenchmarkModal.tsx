'use client';

import { apiFetch } from '@/lib/api';
import React, { useState, useEffect } from 'react';
import { X, BarChart2, CheckCircle2, AlertCircle, RefreshCw, Zap, Award, Layers } from 'lucide-react';
import { BenchmarkResult } from '@/lib/types';

interface WerBenchmarkModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WerBenchmarkModal: React.FC<WerBenchmarkModalProps> = ({ isOpen, onClose }) => {
  const [data, setData] = useState<BenchmarkResult | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchBenchmark = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/eval/benchmark');
      const json = await res.json();
      setData(json);
    } catch (e) {
      console.error('Failed to load benchmark:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchBenchmark();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-6 text-slate-100 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <BarChart2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Empirical Speech Benchmark: AssemblyAI Word Boost
                <span className={`text-xs font-mono font-normal px-2 py-0.5 rounded-full border ${data?.is_measured ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'bg-amber-500/20 text-amber-300 border-amber-500/40'}`}>
                  {data?.is_measured ? 'Measured on live audio' : 'Reference transcripts — not measured'}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                {data?.disclaimer || `Levenshtein WER and drug-name recall across ${data?.samples ?? 0} samples.`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchBenchmark}
              disabled={loading}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
              title="Re-run Benchmark Suite"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Metric Comparison Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
          {/* Baseline Card */}
          <div className="bg-slate-950/80 rounded-xl p-4 border border-rose-500/30">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-rose-300 uppercase tracking-wider">
                Default AssemblyAI STT (No Boost)
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-rose-950/60 text-rose-300 border border-rose-600/40">
                Baseline
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <span className="text-slate-400 text-[11px] block">Word Error Rate (WER)</span>
                <span className="text-2xl font-bold font-mono text-rose-400">{data ? `${data.metrics.baseline_no_boost.wer_percentage}%` : '—'}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[11px] block">Drug Name Recall</span>
                <span className="text-2xl font-bold font-mono text-slate-300">{data ? `${data.metrics.baseline_no_boost.drug_name_precision}%` : '—'}</span>
              </div>
            </div>

            <div className="text-xs text-slate-400 bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
              <span className="text-slate-300 font-semibold block mb-1">Garbled Medical Phonetics:</span>
              <ul className="space-y-1 font-mono text-[11px] text-rose-200">
                <li>• Hydrochlorothiazide → "hydro chlorine thiazide"</li>
                <li>• Atorvastatin → "a tour of a statin"</li>
                <li>• Singulair → "sing you lair"</li>
              </ul>
            </div>
          </div>

          {/* Boosted Card */}
          <div className="bg-slate-950/80 rounded-xl p-4 border border-emerald-500/50 shadow-lg shadow-emerald-500/10">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-emerald-300 uppercase tracking-wider flex items-center gap-1">
                <Zap className="h-3.5 w-3.5 text-emerald-400" />
                AssemblyAI with Keyterms Prompt / Word Boost
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-600/40 font-bold">
                Boosted
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <span className="text-slate-400 text-[11px] block">Word Error Rate (WER)</span>
                <span className="text-2xl font-bold font-mono text-emerald-400">{data ? `${data.metrics.boosted_assemblyai.wer_percentage}%` : '—'}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[11px] block">Drug Name Recall</span>
                <span className="text-2xl font-bold font-mono text-emerald-300">{data ? `${data.metrics.boosted_assemblyai.drug_name_precision}%` : '—'}</span>
              </div>
            </div>

            <div className="text-xs text-slate-400 bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
              <span className="text-slate-300 font-semibold block mb-1">Locked Clinical Transcripts:</span>
              <ul className="space-y-1 font-mono text-[11px] text-emerald-300">
                <li>✓ Hydrochlorothiazide → "Hydrochlorothiazide"</li>
                <li>✓ Atorvastatin → "Atorvastatin Calcium"</li>
                <li>✓ Singulair → "Singulair Montelukast"</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Proof Statement Banner */}
        <div className="bg-gradient-to-r from-emerald-950/40 via-teal-950/40 to-slate-900 rounded-xl p-3.5 border border-emerald-500/30 mb-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 shrink-0">
            <Award className="h-5 w-5" />
          </div>
          <div className="text-xs">
            <span className="font-bold text-white block">
              {data?.is_measured ? 'Measured result' : 'How to get a real measurement'}
            </span>
            <span className="text-slate-300">
              {data?.is_measured
                ? `Word boost changed WER by ${data?.wer_reduction_absolute} points on ${data?.samples} recorded clips.`
                : 'Record clips of real callers, list them with ground-truth text in evals/audio/manifest.json, set ASSEMBLYAI_API_KEY, then re-run. Until then the numbers above only illustrate the scoring method.'}
            </span>
          </div>
        </div>

        {/* Detailed Test Sample Cases */}
        <div className="flex-1 overflow-y-auto pr-1">
          <span className="text-xs font-semibold text-slate-300 block mb-2">
            Sample Benchmark Audio Test Runs:
          </span>
          <div className="space-y-2">
            {(data?.sample_cases || []).slice(0, 6).map((c) => (
              <div key={c.id} className="bg-slate-950/60 rounded-xl p-3 border border-slate-800 text-xs">
                <div className="flex items-center justify-between mb-1 text-slate-400">
                  <span className="font-mono text-[10px]">Test Sample #{c.id}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-rose-400 font-mono">Baseline: {c.baseline_wer}% WER</span>
                    <span className="text-emerald-400 font-mono font-bold">Boosted: {c.boosted_wer}% WER</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-slate-300"><span className="text-slate-500">Ground Truth:</span> {c.ground_truth}</p>
                  <p className="text-rose-300/90 font-mono text-[11px]"><span className="text-slate-500">No Boost:</span> {c.baseline_output}</p>
                  <p className="text-emerald-300 font-mono text-[11px]"><span className="text-slate-500">With Boost:</span> {c.boosted_output}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
