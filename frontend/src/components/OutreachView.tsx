'use client';

import React, { useState } from 'react';
import { Megaphone, Send } from 'lucide-react';
import { apiJson } from '@/lib/api';
import { friendlyError, useFeedback } from './feedback';
import { Badge, Btn, Card, ErrorNote, ViewShell, riskTone, selectCls, useApi } from './ui';

const TEMPLATES: Record<string, string> = {
  REFILL_REMINDER: 'Hi {first_name}, a refill at Community Care Pharmacy is due this week. Call or reply REFILL to have it ready.',
  ADHERENCE: 'Hi {first_name}, our pharmacist would like to check in about your medications. Reply CALL for a free 10-minute call.',
  FLU_SEASON: 'Hi {first_name}, flu shots are now available at Community Care Pharmacy. Walk in or reply BOOK.',
  CMR_INVITE: 'Hi {first_name}, you qualify for a free Medicare medication review with our pharmacist. Reply YES to schedule.',
};

export const OutreachView: React.FC = () => {
  const campaigns = useApi<any>('/api/outreach');
  const adherence = useApi<any>('/api/adherence');
  const [type, setType] = useState('REFILL_REMINDER');
  const [name, setName] = useState('');
  const [tpl, setTpl] = useState(TEMPLATES.REFILL_REMINDER);
  const [err, setErr] = useState<string | null>(null);
  const [preview, setPreview] = useState<string[] | null>(null);
  const { toast, confirm } = useFeedback();

  const create = async () => {
    try {
      setErr(null);
      const r = await apiJson('/api/outreach', { method: 'POST', body: JSON.stringify({ name: name || campaigns.data?.types?.[type] || type, campaign_type: type, message_template: tpl }) });
      setPreview(r.targets);
      toast(`Campaign drafted for ${r.target_count} patient${r.target_count === 1 ? '' : 's'}. Review, then send.`, 'info');
      campaigns.reload();
    } catch (e) {
      toast(friendlyError(e), 'error');
    }
  };
  const send = async (id: string, count: number) => {
    if (!(await confirm({ title: 'Send this campaign?', description: `Text messages go to up to ${count} patients now. Patients who opted out are skipped automatically.`, confirmLabel: 'Send messages' }))) return;
    try {
      const r = await apiJson(`/api/outreach/${id}/send`, { method: 'POST' });
      toast(`Sent ${r.sent} message${r.sent === 1 ? '' : 's'}${r.skipped_opt_out ? `; skipped ${r.skipped_opt_out} opted-out` : ''}.`);
      campaigns.reload();
    } catch (e) {
      toast(friendlyError(e), 'error');
    }
  };
  const optOut = async (pid: string, opt: boolean) => {
    try {
      await apiJson('/api/outreach/opt-out', { method: 'POST', body: JSON.stringify({ patient_id: pid, opt_out: opt }) });
      toast(opt ? 'Patient opted out of SMS.' : 'Patient opted back in to SMS.');
      adherence.reload();
    } catch (e) {
      toast(friendlyError(e), 'error');
    }
  };

  return (
    <ViewShell
      icon={Megaphone}
      title="Proactive Outreach"
      subtitle="Build SMS campaigns from live patient data (refills due, adherence risk, flu season, CMR eligibility). Opt-outs are honored on every send (TCPA)."
    >
      <ErrorNote error={err || campaigns.error} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="New campaign">
          <div className="space-y-2.5">
            <div className="flex flex-wrap gap-2">
              <select className={selectCls} value={type} onChange={(e) => { setType(e.target.value); setTpl(TEMPLATES[e.target.value]); }}>
                {Object.entries(campaigns.data?.types || {}).map(([k, v]) => <option key={k} value={k}>{v as string}</option>)}
              </select>
              <input className={`${selectCls} flex-1`} placeholder="Campaign name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <textarea className={`${selectCls} w-full h-20`} value={tpl} onChange={(e) => setTpl(e.target.value)} />
            <p className="text-[10px] text-slate-500">Use {'{first_name}'} for personalization. “Reply STOP to opt out.” is appended automatically.</p>
            <Btn onClick={create}>Build audience</Btn>
            {preview && <p className="text-xs text-slate-300">Audience ({preview.length}): {preview.join(', ') || 'none'}</p>}
          </div>
        </Card>
        <Card title="Adherence risk (PDC-based)">
          <table className="w-full text-xs">
            <thead className="text-slate-400"><tr><th className="text-left py-1">Patient</th><th>Score</th><th>Avg PDC</th><th className="text-left">Drivers</th></tr></thead>
            <tbody>
              {(adherence.data?.patients || []).map((p: any) => (
                <tr key={p.patient_id} className="border-t border-slate-800 align-top">
                  <td className="py-1.5 text-slate-200">{p.patient_name}</td>
                  <td className="text-center"><Badge tone={riskTone(p.risk_band)}>{p.risk_score} {p.risk_band}</Badge></td>
                  <td className="text-center font-mono">{(p.average_pdc * 100).toFixed(0)}%</td>
                  <td className="text-slate-400">{p.factors.join('; ') || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
      <Card title="Campaigns">
        <table className="w-full text-xs">
          <thead className="text-slate-400"><tr><th className="text-left py-1">Name</th><th className="text-left">Type</th><th>Audience</th><th>Sent</th><th>Opt-out skipped</th><th>Status</th><th /></tr></thead>
          <tbody>
            {(campaigns.data?.campaigns || []).map((c: any) => (
              <tr key={c.campaign_id} className="border-t border-slate-800">
                <td className="py-1.5 text-slate-200">{c.name}</td>
                <td className="text-slate-400">{c.campaign_type}</td>
                <td className="text-center font-mono">{c.target_count}</td>
                <td className="text-center font-mono">{c.sent_count}</td>
                <td className="text-center font-mono">{c.skipped_opt_out}</td>
                <td className="text-center"><Badge tone={c.status === 'SENT' ? 'green' : 'slate'}>{c.status}</Badge></td>
                <td className="text-right">{c.status !== 'SENT' && <Btn className="!px-2 !py-1" onClick={() => send(c.campaign_id, c.target_count)}><Send className="h-3 w-3 inline mr-1" />Send</Btn>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!campaigns.data?.campaigns?.length && <p className="text-xs text-slate-500 mt-2">No campaigns yet.</p>}
      </Card>
      <Card title="SMS opt-out management">
        <div className="flex flex-wrap gap-2">
          {(adherence.data?.patients || []).map((p: any) => (
            <span key={p.patient_id} className="flex items-center gap-1.5 text-xs text-slate-300">
              {p.patient_name}
              <Btn variant="ghost" className="!px-2 !py-0.5" onClick={() => optOut(p.patient_id, true)}>Opt out</Btn>
              <Btn variant="ghost" className="!px-2 !py-0.5" onClick={() => optOut(p.patient_id, false)}>Opt in</Btn>
            </span>
          ))}
        </div>
      </Card>
    </ViewShell>
  );
};
