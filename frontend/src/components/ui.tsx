'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { apiJson } from '@/lib/api';

export function useApi<T = any>(path: string | null, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!path) return;
    setLoading(true);
    try {
      setData(await apiJson<T>(path));
      setError(null);
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, ...deps]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, error, loading, reload, setData };
}

export const ViewShell: React.FC<{ icon: React.ElementType; title: string; subtitle: string; actions?: React.ReactNode; children: React.ReactNode }> = ({
  icon: Icon,
  title,
  subtitle,
  actions,
  children,
}) => (
  <div className="flex-1 flex flex-col p-6 gap-4">
    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
      <div>
        <h2 className="text-xl font-bold text-white flex items-center gap-2.5">
          <Icon className="h-6 w-6 text-blue-400" />
          {title}
        </h2>
        <p className="text-xs text-slate-400 mt-1 max-w-3xl">{subtitle}</p>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
    {children}
  </div>
);

export const Card: React.FC<{ title?: React.ReactNode; right?: React.ReactNode; className?: string; children: React.ReactNode }> = ({
  title,
  right,
  className = '',
  children,
}) => (
  <div className={`rounded-xl bg-slate-900/70 border border-slate-800 p-4 ${className}`}>
    {(title || right) && (
      <div className="flex items-center justify-between mb-3 gap-2">
        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-300">{title}</h3>
        {right}
      </div>
    )}
    {children}
  </div>
);

const TONES: Record<string, string> = {
  slate: 'bg-slate-800/70 text-slate-300 border-slate-700',
  blue: 'bg-blue-500/15 text-blue-300 border-blue-500/35',
  green: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35',
  amber: 'bg-amber-500/15 text-amber-300 border-amber-500/35',
  red: 'bg-rose-500/15 text-rose-300 border-rose-500/35',
  violet: 'bg-violet-500/15 text-violet-300 border-violet-500/35',
};

export const Badge: React.FC<{ tone?: keyof typeof TONES | string; children: React.ReactNode; title?: string }> = ({ tone = 'slate', children, title }) => (
  <span title={title} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-bold font-mono uppercase ${TONES[tone] || TONES.slate}`}>
    {children}
  </span>
);

export const Stat: React.FC<{ label: string; value: React.ReactNode; hint?: string; tone?: string }> = ({ label, value, hint, tone = 'slate' }) => (
  <div className={`p-3.5 rounded-xl border ${tone === 'slate' ? 'bg-slate-900/80 border-slate-800' : TONES[tone]}`}>
    <span className="text-[11px] font-mono uppercase block opacity-80">{label}</span>
    <span className="text-2xl font-extrabold font-mono mt-0.5 block text-white">{value ?? '—'}</span>
    {hint && <span className="text-[10px] text-slate-400 block mt-0.5">{hint}</span>}
  </div>
);

export const Btn: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' }> = ({
  variant = 'primary',
  className = '',
  ...props
}) => {
  const styles = {
    primary: 'bg-blue-600 hover:bg-blue-500 text-white',
    ghost: 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700',
    danger: 'bg-rose-600 hover:bg-rose-500 text-white',
  }[variant];
  return (
    <button
      {...props}
      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition disabled:opacity-50 cursor-pointer ${styles} ${className}`}
    />
  );
};

export const ErrorNote: React.FC<{ error: string | null }> = ({ error }) =>
  error ? <div className="text-xs text-rose-300 bg-rose-950/40 border border-rose-500/30 rounded-lg px-3 py-2">{error}</div> : null;

export const severityTone = (s?: string) =>
  s === 'CONTRAINDICATED' ? 'red' : s === 'MAJOR' ? 'amber' : s === 'MODERATE' ? 'blue' : 'slate';

export const riskTone = (band?: string) => (band === 'HIGH' ? 'red' : band === 'MEDIUM' ? 'amber' : 'green');

export const selectCls =
  'bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500';

// Horizontal bar list; values are shown as text too so the chart never carries meaning alone.
export const BarList: React.FC<{ rows: { label: string; value: number; display?: string }[]; empty?: string }> = ({ rows, empty = 'No data yet' }) => {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (!rows.length) return <p className="text-xs text-slate-500">{empty}</p>;
  return (
    <div className="space-y-1.5">
      {rows.map((r) => (
        <div key={r.label} className="grid grid-cols-[minmax(90px,160px)_1fr_auto] items-center gap-2 text-xs">
          <span className="text-slate-300 truncate" title={r.label}>{r.label}</span>
          <div className="h-2.5 rounded bg-slate-800 overflow-hidden">
            <div className="h-full rounded bg-blue-500" style={{ width: `${(r.value / max) * 100}%` }} />
          </div>
          <span className="font-mono text-slate-200 tabular-nums">{r.display ?? r.value}</span>
        </div>
      ))}
    </div>
  );
};
