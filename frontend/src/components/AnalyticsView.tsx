'use client';

import React from 'react';
import { BarChart3, RefreshCw } from 'lucide-react';
import { BarList, Btn, Card, ErrorNote, Stat, ViewShell, useApi } from './ui';

const pct = (v: number | null | undefined) => (v == null ? '—' : `${(v * 100).toFixed(1)}%`);

export const AnalyticsView: React.FC = () => {
  const { data, error, reload, loading } = useApi<any>('/api/analytics');
  const adh = useApi<any>('/api/adherence');
  const mtm = useApi<any>('/api/mtm');

  const calls = data?.calls || {};
  const lat = data?.latency_ms || {};
  const star = data?.star_adherence || {};

  return (
    <ViewShell
      icon={BarChart3}
      title="Operations Analytics"
      subtitle="Every figure is computed from recorded call sessions, turn telemetry, dispense orders and fill history. Values stay empty until calls are made — nothing here is a marketing number."
      actions={<Btn variant="ghost" onClick={() => { reload(); adh.reload(); mtm.reload(); }} disabled={loading}><RefreshCw className="h-3.5 w-3.5 inline mr-1" />Refresh</Btn>}
    >
      <ErrorNote error={error} />
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <Stat label="Calls" value={calls.total ?? 0} />
        <Stat label="AI containment" value={pct(calls.containment_rate)} hint="Completed, no escalation" tone="green" />
        <Stat label="Avg handle time" value={calls.avg_handle_time_sec ? `${Math.round(calls.avg_handle_time_sec)}s` : '—'} />
        <Stat label="Turn latency p95" value={lat.turn_p95 != null ? `${lat.turn_p95}ms` : '—'} hint={`${lat.turns_measured ?? 0} turns measured`} tone="blue" />
        <Stat label="Copay revenue" value={`$${(data?.fulfillment?.copay_revenue ?? 0).toFixed(2)}`} />
        <Stat label="High adherence risk" value={adh.data?.high_risk_outreach_needed ?? '—'} tone="red" hint="Patients needing outreach" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Measured latency by stage (avg)">
          <BarList
            rows={[
              { label: 'Speech-to-text', value: lat.stt_avg || 0, display: lat.stt_avg != null ? `${lat.stt_avg} ms` : '—' },
              { label: 'Agent engine', value: lat.engine_avg || 0, display: lat.engine_avg != null ? `${lat.engine_avg} ms` : '—' },
              { label: 'Text-to-speech', value: lat.tts_avg || 0, display: lat.tts_avg != null ? `${lat.tts_avg} ms` : '—' },
            ]}
          />
          <p className="text-[10px] text-slate-500 mt-2">STT is only measured on microphone turns; TTS only when Cartesia is configured.</p>
        </Card>
        <Card title="Caller intents (turns)">
          <BarList rows={Object.entries(data?.intents || {}).map(([k, v]) => ({ label: k, value: v as number })).sort((a, b) => b.value - a.value)} />
        </Card>
        <Card title="Escalations by reason">
          <BarList rows={Object.entries(calls.escalations || {}).map(([k, v]) => ({ label: k.replace(/_/g, ' '), value: v as number }))} empty="No escalations recorded" />
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Star-rating adherence proxies (PDC ≥ 80%)">
          <table className="w-full text-xs">
            <thead className="text-slate-400"><tr><th className="text-left py-1">Measure</th><th className="text-right">Adherent</th><th className="text-right">Rate</th></tr></thead>
            <tbody>
              {Object.entries(star).map(([k, v]: any) => (
                <tr key={k} className="border-t border-slate-800"><td className="py-1.5 text-slate-200">{k}</td><td className="text-right font-mono">{v.adherent_patients}/{v.eligible_patients}</td><td className="text-right font-mono">{pct(v.rate)}</td></tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card title="Calls by hour of day">
          <BarList rows={Object.entries(calls.by_hour || {}).map(([h, v]) => ({ label: `${h}:00`, value: v as number }))} />
        </Card>
        <Card title="MTM revenue (CMR)">
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Projected" value={`$${(mtm.data?.projected_revenue ?? 0).toFixed(0)}`} hint="Eligible × CPT 99605+99607" />
            <Stat label="Captured" value={`$${(mtm.data?.captured_revenue ?? 0).toFixed(0)}`} hint={`${mtm.data?.completed_sessions ?? 0} completed`} />
          </div>
          <ul className="mt-3 space-y-1 text-xs">
            {(mtm.data?.patients || []).map((p: any) => (
              <li key={p.patient_id} className="flex justify-between"><span className="text-slate-300">{p.patient_name}</span><span className={p.eligible ? 'text-emerald-300' : 'text-slate-500'}>{p.eligible ? 'CMR eligible' : `${p.chronic_conditions.length} chronic dx`}</span></li>
            ))}
          </ul>
        </Card>
      </div>

      <Card title="Fills per day (last 14 active days)">
        <BarList rows={(data?.fulfillment?.daily || []).map((d: any) => ({ label: d.date, value: d.fills }))} empty="No fills yet — complete a refill call to populate" />
      </Card>
    </ViewShell>
  );
};
