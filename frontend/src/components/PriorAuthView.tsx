'use client';

import React, { useState } from 'react';
import { FileClock, Plus, RefreshCw } from 'lucide-react';
import { apiJson } from '@/lib/api';
import { Patient } from '@/lib/types';
import { Badge, Btn, Card, ErrorNote, ViewShell, selectCls, useApi } from './ui';

const COLUMNS = ['PENDING', 'SUBMITTED', 'APPEALED', 'APPROVED', 'DENIED', 'DISPENSED'];
const NEXT: Record<string, string[]> = {
  PENDING: ['SUBMITTED'],
  SUBMITTED: ['APPROVED', 'DENIED'],
  APPEALED: ['APPROVED', 'DENIED'],
  APPROVED: ['DISPENSED'],
  DENIED: [],
  DISPENSED: [],
};

export const PriorAuthView: React.FC<{ patients: Patient[] }> = ({ patients }) => {
  const board = useApi<any>('/api/pa');
  const [pid, setPid] = useState(patients[0]?.patient_id || 'PAT-1001');
  const rx = useApi<any[]>(`/api/prescriptions?patient_id=${pid}`, [pid]);
  const [rxNum, setRxNum] = useState('');
  const [urgency, setUrgency] = useState('STANDARD');
  const [err, setErr] = useState<string | null>(null);
  const [letter, setLetter] = useState<string | null>(null);

  const act = async (fn: () => Promise<any>) => {
    try {
      setErr(null);
      const r = await fn();
      board.reload();
      return r;
    } catch (e: any) {
      setErr(e.message);
    }
  };

  const create = () =>
    act(() => apiJson('/api/pa', { method: 'POST', body: JSON.stringify({ patient_id: pid, rx_number: rxNum || rx.data?.[0]?.rx_number, urgency }) }));
  const move = (id: string, status: string) => {
    const denial_reason = status === 'DENIED' ? window.prompt('Payer denial reason?') || undefined : undefined;
    return act(() => apiJson(`/api/pa/${id}/status`, { method: 'POST', body: JSON.stringify({ status, denial_reason }) }));
  };
  const appeal = async (id: string) => {
    const r = await act(() => apiJson(`/api/pa/${id}/appeal`, { method: 'POST' }));
    if (r?.appeal_letter) setLetter(r.appeal_letter);
  };

  return (
    <ViewShell
      icon={FileClock}
      title="Prior Authorization Board"
      subtitle="Track PAs from request to dispense. Decision timers follow CMS-0057-F (72 hours expedited, 7 days standard). Justifications are drafted from the patient's diagnoses and therapy; appeals are drafted by the LLM when configured."
      actions={<Btn variant="ghost" onClick={board.reload}><RefreshCw className="h-3.5 w-3.5 inline mr-1" />Refresh</Btn>}
    >
      <ErrorNote error={err || board.error} />
      <Card title="New PA request">
        <div className="flex flex-wrap items-center gap-2">
          <select className={selectCls} value={pid} onChange={(e) => { setPid(e.target.value); setRxNum(''); }}>
            {patients.map((p) => <option key={p.patient_id} value={p.patient_id}>{p.first_name} {p.last_name}</option>)}
          </select>
          <select className={selectCls} value={rxNum} onChange={(e) => setRxNum(e.target.value)}>
            {(rx.data || []).map((r: any) => <option key={r.rx_number} value={r.rx_number}>{r.drug_name} {r.strength} ({r.rx_number})</option>)}
          </select>
          <select className={selectCls} value={urgency} onChange={(e) => setUrgency(e.target.value)}>
            <option value="STANDARD">Standard (7 days)</option>
            <option value="URGENT">Expedited (72 h)</option>
          </select>
          <Btn onClick={create}><Plus className="h-3.5 w-3.5 inline mr-1" />Create PA</Btn>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {COLUMNS.map((col) => {
          const items = board.data?.columns?.[col] || [];
          return (
            <div key={col} className="rounded-xl bg-slate-950/60 border border-slate-800 p-2.5 min-h-[180px]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-slate-300">{col}</span>
                <Badge>{items.length}</Badge>
              </div>
              <div className="space-y-2">
                {items.map((pa: any) => (
                  <div key={pa.pa_id} className="rounded-lg bg-slate-900 border border-slate-800 p-2.5 text-xs space-y-1.5">
                    <div className="flex justify-between gap-1">
                      <span className="font-mono text-slate-400">{pa.pa_id}</span>
                      {pa.urgency === 'URGENT' && <Badge tone="red">Expedited</Badge>}
                    </div>
                    <div className="text-slate-100 font-semibold">{pa.drug_name}</div>
                    <div className="text-slate-400">{pa.first_name} {pa.last_name} · {pa.payer}</div>
                    {pa.hours_remaining != null && (
                      <Badge tone={pa.overdue ? 'red' : pa.hours_remaining < 24 ? 'amber' : 'blue'}>
                        {pa.overdue ? `Overdue ${Math.abs(pa.hours_remaining)}h` : `${pa.hours_remaining}h left`}
                      </Badge>
                    )}
                    {pa.denial_reason && <div className="text-rose-300">Denied: {pa.denial_reason}</div>}
                    <div className="flex flex-wrap gap-1 pt-1">
                      {NEXT[col].map((s) => <Btn key={s} variant="ghost" className="!px-2 !py-1" onClick={() => move(pa.pa_id, s)}>→ {s}</Btn>)}
                      {col === 'DENIED' && <Btn variant="danger" className="!px-2 !py-1" onClick={() => appeal(pa.pa_id)}>Appeal</Btn>}
                      {pa.appeal_letter && <Btn variant="ghost" className="!px-2 !py-1" onClick={() => setLetter(pa.appeal_letter)}>Letter</Btn>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {letter && (
        <Card title="Appeal letter (draft — prescriber must sign)" right={<Btn variant="ghost" onClick={() => setLetter(null)}>Close</Btn>}>
          <pre className="whitespace-pre-wrap text-xs text-slate-200 font-sans">{letter}</pre>
        </Card>
      )}
    </ViewShell>
  );
};
