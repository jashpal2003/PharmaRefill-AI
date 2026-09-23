'use client';

import React, { useState } from 'react';
import { Syringe } from 'lucide-react';
import { apiJson } from '@/lib/api';
import { Patient } from '@/lib/types';
import { Badge, Btn, Card, ErrorNote, ViewShell, selectCls, useApi } from './ui';

export const ImmunizationsView: React.FC<{ patients: Patient[] }> = ({ patients }) => {
  const [pid, setPid] = useState(patients[0]?.patient_id || 'PAT-1001');
  const recs = useApi<any>(`/api/immunizations/recommend/${pid}`, [pid]);
  const list = useApi<any>('/api/immunizations');
  const [vaccine, setVaccine] = useState('');
  const [when, setWhen] = useState('');
  const [answers, setAnswers] = useState<Record<string, boolean>>({});
  const [hl7, setHl7] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const questions: string[] = list.data?.screening_questions || [];

  const schedule = async () => {
    try {
      setErr(null);
      await apiJson('/api/immunizations', {
        method: 'POST',
        body: JSON.stringify({ patient_id: pid, vaccine: vaccine || recs.data?.recommended?.[0]?.code, scheduled_for: when || 'Walk-in today', screening: answers }),
      });
      setAnswers({});
      list.reload();
      recs.reload();
    } catch (e: any) {
      setErr(e.message);
    }
  };

  const administer = async (id: string) => {
    const lot = window.prompt('Vaccine lot number?');
    if (!lot) return;
    try {
      const r = await apiJson(`/api/immunizations/${id}/administer`, { method: 'POST', body: JSON.stringify({ lot_number: lot }) });
      setHl7(r.hl7_vxu);
      list.reload();
      recs.reload();
    } catch (e: any) {
      setErr(e.message);
    }
  };

  return (
    <ViewShell
      icon={Syringe}
      title="Immunizations"
      subtitle="Recommendations follow the CDC ACIP adult schedule (abridged) using age, conditions and administration history. Administering a dose generates an HL7 v2.5.1 VXU message for the state immunization registry."
    >
      <ErrorNote error={err || recs.error || list.error} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Schedule a dose">
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <select className={selectCls} value={pid} onChange={(e) => { setPid(e.target.value); setVaccine(''); }}>
                {patients.map((p) => <option key={p.patient_id} value={p.patient_id}>{p.first_name} {p.last_name}</option>)}
              </select>
              <span className="text-xs text-slate-400 self-center">Age {recs.data?.age ?? '—'}</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(recs.data?.recommended || []).map((v: any) => (
                <button key={v.code} onClick={() => setVaccine(v.code)} className={`px-2.5 py-1 rounded-lg border text-xs cursor-pointer ${(vaccine || recs.data?.recommended?.[0]?.code) === v.code ? 'border-blue-500 bg-blue-500/15 text-blue-200' : 'border-slate-700 text-slate-300'}`}>
                  {v.name}
                </button>
              ))}
              {recs.data && !recs.data.recommended.length && <span className="text-xs text-emerald-300">Up to date on all recommended vaccines.</span>}
            </div>
            <input className={`${selectCls} w-full`} placeholder="When (e.g. Friday 2:00 PM)" value={when} onChange={(e) => setWhen(e.target.value)} />
            <fieldset className="space-y-1.5">
              <legend className="text-[11px] font-bold uppercase text-slate-400 mb-1">Pre-screening (check any YES)</legend>
              {questions.map((q) => (
                <label key={q} className="flex items-start gap-2 text-xs text-slate-300">
                  <input type="checkbox" checked={!!answers[q]} onChange={(e) => setAnswers({ ...answers, [q]: e.target.checked })} className="mt-0.5" />
                  {q}
                </label>
              ))}
            </fieldset>
            <Btn onClick={schedule} disabled={!recs.data?.recommended?.length}>Schedule</Btn>
          </div>
        </Card>

        <Card title="Appointments & history">
          <table className="w-full text-xs">
            <thead className="text-slate-400"><tr><th className="text-left py-1">Patient</th><th className="text-left">Vaccine</th><th className="text-left">When</th><th className="text-left">Status</th><th /></tr></thead>
            <tbody>
              {(list.data?.immunizations || []).map((i: any) => (
                <tr key={i.immunization_id} className="border-t border-slate-800">
                  <td className="py-1.5 text-slate-200">{i.first_name} {i.last_name}</td>
                  <td>{i.vaccine}</td>
                  <td className="text-slate-400">{i.administered_at || i.scheduled_for}</td>
                  <td><Badge tone={i.status === 'ADMINISTERED' ? 'green' : i.status === 'SCHEDULED' ? 'blue' : 'amber'}>{i.status.replace(/_/g, ' ')}</Badge></td>
                  <td className="text-right">
                    {i.status !== 'ADMINISTERED' && <Btn variant="ghost" className="!px-2 !py-1" onClick={() => administer(i.immunization_id)}>Administer</Btn>}
                    {i.iis_message && <Btn variant="ghost" className="!px-2 !py-1" onClick={() => setHl7(i.iis_message)}>HL7</Btn>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!list.data?.immunizations?.length && <p className="text-xs text-slate-500 mt-2">No immunizations recorded.</p>}
        </Card>
      </div>
      {hl7 && (
        <Card title="HL7 v2.5.1 VXU^V04 (registry message)" right={<Btn variant="ghost" onClick={() => setHl7(null)}>Close</Btn>}>
          <pre className="text-[11px] font-mono text-emerald-200 whitespace-pre-wrap break-all">{hl7.split('\r').join('\n')}</pre>
        </Card>
      )}
    </ViewShell>
  );
};
