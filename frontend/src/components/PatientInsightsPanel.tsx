'use client';

import React, { useState } from 'react';
import { apiJson } from '@/lib/api';
import { friendlyError, useFeedback } from './feedback';
import { Badge, Btn, Card, ErrorNote, riskTone, severityTone, useApi } from './ui';

export const PatientInsightsPanel: React.FC<{ patientId: string; onChanged?: () => void }> = ({ patientId, onChanged }) => {
  const adh = useApi<any>(`/api/adherence/${patientId}`, [patientId]);
  const dur = useApi<any>(`/api/clinical/dur/${patientId}`, [patientId]);
  const rtbc = useApi<any>(`/api/rtbc/${patientId}`, [patientId]);
  const [err, setErr] = useState<string | null>(null);
  const { prompt, toast } = useFeedback();

  const override = async (alertKey: string) => {
    const rationale = await prompt({
      title: 'Override DUR alert',
      description: 'Record why it is clinically appropriate to proceed. This is saved to the audit trail with your name and role.',
      label: 'Clinical rationale',
      placeholder: 'e.g. Discussed with prescriber; benefit outweighs risk, patient counseled on sedation.',
      multiline: true,
      minLength: 15,
      confirmLabel: 'Record override',
    });
    if (!rationale) return;
    try {
      await apiJson('/api/dur/override', { method: 'POST', body: JSON.stringify({ patient_id: patientId, alert_key: alertKey, rationale }) });
      toast('Override recorded in the audit trail.');
      dur.reload();
    } catch (e) {
      toast(friendlyError(e), 'error');
    }
  };

  const swap = async (rxNumber: string) => {
    const daw = await prompt({
      title: 'Substitute generic',
      description: 'Check the DAW (dispense as written) code on the prescription before substituting.',
      label: 'DAW code',
      choices: [
        { value: '0', label: 'DAW 0: substitution allowed', hint: 'Most prescriptions' },
        { value: '2', label: 'DAW 2: patient requested brand', hint: 'Patient may choose to switch' },
        { value: '1', label: 'DAW 1: prescriber requires brand', hint: 'Substitution is not permitted' },
      ],
      confirmLabel: 'Substitute',
    });
    if (daw == null) return;
    try {
      const r = await apiJson('/api/generic-substitution', { method: 'POST', body: JSON.stringify({ rx_number: rxNumber, daw_code: Number(daw) }) });
      toast(`Switched to ${r.new_drug}. Patient saves $${r.savings.toFixed(2)}; prescriber notification queued.`);
      rtbc.reload();
      dur.reload();
      onChanged?.();
    } catch (e) {
      toast(friendlyError(e), 'error');
    }
  };

  const a = adh.data;
  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-3 mt-4">
      <ErrorNote error={err} />

      <Card title="Adherence risk" right={a && <Badge tone={riskTone(a.risk_band)}>{a.risk_score}/100 · {a.risk_band}</Badge>}>
        {a ? (
          <>
            <p className="text-xs text-slate-400 mb-2">Average PDC {(a.average_pdc * 100).toFixed(0)}% (180-day window, PQA method)</p>
            <ul className="space-y-1 text-xs">
              {a.medications.map((m: any) => (
                <li key={m.rx_number} className="flex justify-between gap-2">
                  <span className="text-slate-300 truncate">{m.drug_name}</span>
                  <span className="flex gap-1">
                    <Badge tone={m.pdc == null ? 'slate' : m.adherent ? 'green' : 'red'}>PDC {m.pdc == null ? 'n/a' : `${Math.round(m.pdc * 100)}%`}</Badge>
                    {m.days_until_due <= 7 && <Badge tone={m.days_until_due < 0 ? 'red' : 'amber'}>{m.days_until_due < 0 ? `${-m.days_until_due}d late` : `due ${m.days_until_due}d`}</Badge>}
                  </span>
                </li>
              ))}
            </ul>
            {a.factors.length > 0 && <p className="text-[11px] text-slate-400 mt-2">Drivers: {a.factors.join('; ')}</p>}
          </>
        ) : <p className="text-xs text-slate-500">Loading…</p>}
      </Card>

      <Card title="Drug utilization review" right={dur.data && <Badge tone={dur.data.overall_risk === 'NO_ISSUES_FOUND' ? 'green' : dur.data.overall_risk === 'CONTRAINDICATED' ? 'red' : 'amber'}>{dur.data.overall_risk.replace(/_/g, ' ')}</Badge>}>
        <p className="text-[11px] text-slate-400 mb-2">
          Allergies: {dur.data?.allergies?.map((x: any) => x.allergen).join(', ') || 'NKDA'} · Age {dur.data?.age ?? '—'}
        </p>
        <ul className="space-y-2 text-xs max-h-64 overflow-y-auto">
          {(dur.data?.alerts || []).map((al: any) => (
            <li key={al.alert_key} className="border-l-2 border-slate-700 pl-2">
              <div className="flex flex-wrap items-center gap-1">
                <Badge tone={severityTone(al.severity)}>{al.severity}</Badge>
                <Badge>{al.category.replace(/_/g, ' ')}</Badge>
                {al.override && <Badge tone="green" title={al.override.rationale}>Overridden by {al.override.overridden_by}</Badge>}
              </div>
              <div className="text-slate-200 mt-1">{al.drugs.join(' + ')}</div>
              <div className="text-slate-400">{al.clinical_effect}</div>
              <div className="text-slate-300">→ {al.recommendation}</div>
              {!al.override && <Btn variant="ghost" className="!px-2 !py-0.5 mt-1" onClick={() => override(al.alert_key)}>Override with rationale</Btn>}
            </li>
          ))}
          {dur.data && !dur.data.alerts.length && <li className="text-emerald-300">No DUR alerts on the active profile.</li>}
        </ul>
      </Card>

      <Card title={`Benefit check · ${rtbc.data?.payer || ''}`}>
        <ul className="space-y-2 text-xs">
          {(rtbc.data?.results || []).map((r: any) => (
            <li key={r.rx_number}>
              <div className="flex justify-between gap-2">
                <span className="text-slate-200 truncate">{r.drug_name}</span>
                <span className="flex gap-1">
                  <Badge tone={r.formulary_tier <= 1 ? 'green' : r.formulary_tier === 2 ? 'blue' : 'amber'}>Tier {r.formulary_tier}</Badge>
                  <Badge>{r.estimated_copay != null ? `$${r.estimated_copay.toFixed(2)}` : 'cash'}</Badge>
                  {r.pa_required && <Badge tone="red">PA req</Badge>}
                </span>
              </div>
              {r.alternatives.map((alt: any) => (
                <div key={alt.drug_name} className="flex items-center justify-between text-[11px] text-slate-400 mt-0.5 pl-2">
                  <span>{alt.type === 'GENERIC' ? 'Generic' : 'Therapeutic alt'}: {alt.drug_name} — saves ${alt.savings.toFixed(2)}</span>
                  {alt.type === 'GENERIC' && <Btn className="!px-2 !py-0.5" onClick={() => swap(r.rx_number)}>Substitute</Btn>}
                </div>
              ))}
            </li>
          ))}
        </ul>
        <p className="text-[10px] text-slate-500 mt-2">{rtbc.data?.results?.[0]?.source}</p>
      </Card>
    </div>
  );
};
