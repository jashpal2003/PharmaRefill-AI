'use client';

import React, { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { apiJson } from '@/lib/api';
import { Patient } from '@/lib/types';
import { Badge, Btn, Card, ErrorNote, ViewShell, selectCls, useApi } from './ui';
import { useAuth } from './AuthGate';

export const ComplianceView: React.FC<{ patients: Patient[] }> = ({ patients }) => {
  const { me } = useAuth();
  const isAdmin = me?.role === 'admin';
  const [tab, setTab] = useState<'AUDIT' | 'DUR' | 'SDOH'>(isAdmin ? 'AUDIT' : 'DUR');
  const log = useApi<any>(tab === 'AUDIT' ? '/api/audit-log?limit=300' : null, [tab]);
  const retro = useApi<any>(tab === 'DUR' ? '/api/dur/retrospective' : null, [tab]);
  const sdohQ = useApi<any>(tab === 'SDOH' ? '/api/sdoh/questions' : null, [tab]);
  const [pid, setPid] = useState(patients[0]?.patient_id || 'PAT-1001');
  const history = useApi<any>(tab === 'SDOH' ? `/api/sdoh/${pid}` : null, [tab, pid]);
  const [answers, setAnswers] = useState<Record<string, boolean>>({});
  const [result, setResult] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState('');

  const submitSdoh = async () => {
    try {
      setErr(null);
      setResult(await apiJson('/api/sdoh', { method: 'POST', body: JSON.stringify({ patient_id: pid, answers }) }));
      setAnswers({});
      history.reload();
    } catch (e: any) {
      setErr(e.message);
    }
  };

  const entries = (log.data?.entries || []).filter((e: any) => !filter || `${e.path} ${e.role} ${e.patient_id}`.toLowerCase().includes(filter.toLowerCase()));

  return (
    <ViewShell
      icon={ShieldCheck}
      title="Compliance & Safety"
      subtitle="HIPAA access log (append-only, enforced by database triggers) with breach heuristics, retrospective DUR across all patients, and AHC-HRSN social-needs screening exported as a FHIR Observation."
      actions={
        <div className="flex gap-1 p-1 rounded-xl bg-slate-900 border border-slate-800 text-xs">
          {([['AUDIT', 'Access log'], ['DUR', 'Retrospective DUR'], ['SDOH', 'SDOH screening']] as const).filter(([k]) => isAdmin || k !== 'AUDIT').map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} className={`px-3 py-1.5 rounded-lg font-semibold cursor-pointer ${tab === k ? 'bg-slate-800 text-white' : 'text-slate-400'}`}>{l}</button>
          ))}
        </div>
      }
    >
      <ErrorNote error={err || log.error || retro.error || sdohQ.error} />

      {tab === 'AUDIT' && (
        <>
          {(log.data?.anomalies || []).map((a: any, i: number) => (
            <div key={i} className="text-xs rounded-lg border border-rose-500/40 bg-rose-950/40 text-rose-200 px-3 py-2">
              {a.type.replace(/_/g, ' ')}: role {a.role} from {a.client_ip} — {a.n} events in the last hour
            </div>
          ))}
          <Card title={`Access log (${entries.length})`} right={<input className={selectCls} placeholder="Filter path / role / patient" value={filter} onChange={(e) => setFilter(e.target.value)} />}>
            <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="text-slate-400 sticky top-0 bg-slate-900"><tr><th className="text-left py-1">Time (UTC)</th><th className="text-left">Role</th><th className="text-left">Method</th><th className="text-left">Path</th><th className="text-left">Patient</th><th>Status</th><th className="text-left">IP</th></tr></thead>
                <tbody>
                  {entries.map((e: any) => (
                    <tr key={e.log_id} className="border-t border-slate-800">
                      <td className="py-1 font-mono text-slate-400">{e.ts}</td>
                      <td><Badge tone={e.role === 'anonymous' ? 'red' : 'slate'}>{e.role}</Badge></td>
                      <td className="font-mono">{e.method}</td>
                      <td className="font-mono text-slate-300">{e.path}</td>
                      <td className="font-mono text-slate-300">{e.patient_id || ''}</td>
                      <td className="text-center"><Badge tone={e.status_code >= 400 ? 'red' : 'green'}>{e.status_code}</Badge></td>
                      <td className="font-mono text-slate-500">{e.client_ip}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {tab === 'DUR' && (
        <Card title={`Retrospective DUR — ${retro.data?.total_alerts ?? 0} alerts`}>
          <table className="w-full text-xs">
            <thead className="text-slate-400"><tr><th className="text-left py-1">Patient</th><th className="text-left">Overall</th><th>Alerts</th><th className="text-left">By category</th></tr></thead>
            <tbody>
              {(retro.data?.patients || []).map((r: any) => (
                <tr key={r.patient_id} className="border-t border-slate-800">
                  <td className="py-1.5 text-slate-200">{r.patient_name}</td>
                  <td><Badge tone={r.overall_risk === 'NO_ISSUES_FOUND' ? 'green' : r.overall_risk === 'CONTRAINDICATED' ? 'red' : 'amber'}>{r.overall_risk.replace(/_/g, ' ')}</Badge></td>
                  <td className="text-center font-mono">{r.alerts}</td>
                  <td className="text-slate-400">{Object.entries(r.by_category).map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`).join(' · ') || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {tab === 'SDOH' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card title={sdohQ.data?.instrument || 'Screening'}>
            <select className={`${selectCls} mb-3`} value={pid} onChange={(e) => { setPid(e.target.value); setResult(null); }}>
              {patients.map((p) => <option key={p.patient_id} value={p.patient_id}>{p.first_name} {p.last_name}</option>)}
            </select>
            <div className="space-y-2">
              {(sdohQ.data?.questions || []).map((q: any) => (
                <label key={q.id} className="flex items-start gap-2 text-xs text-slate-300">
                  <input type="checkbox" className="mt-0.5" checked={!!answers[q.id]} onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.checked })} />
                  <span><span className="text-slate-500">{q.domain}:</span> {q.question}</span>
                </label>
              ))}
            </div>
            <Btn className="mt-3" onClick={submitSdoh}>Save screening</Btn>
            {result && (
              <div className="mt-3 space-y-1 text-xs">
                {result.risk_flags.length ? result.risk_flags.map((f: any) => (
                  <div key={f.id}><Badge tone="amber">{f.domain}</Badge> <span className="text-slate-300">→ {f.resource}</span></div>
                )) : <span className="text-emerald-300">No social needs identified.</span>}
              </div>
            )}
          </Card>
          <Card title="Screening history">
            <ul className="space-y-2 text-xs">
              {(history.data?.screenings || []).map((s: any) => (
                <li key={s.screening_id} className="border-b border-slate-800 pb-1.5">
                  <span className="font-mono text-slate-500">{s.created_at}</span>{' '}
                  {s.risk_flags.length ? s.risk_flags.map((f: any) => <Badge key={f.id} tone="amber">{f.domain}</Badge>) : <Badge tone="green">No needs</Badge>}
                </li>
              ))}
              {!history.data?.screenings?.length && <li className="text-slate-500">No screenings recorded.</li>}
            </ul>
          </Card>
        </div>
      )}
    </ViewShell>
  );
};
