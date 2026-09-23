'use client';

import React, { useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import { apiJson } from '@/lib/api';
import { Badge, Btn, Card, selectCls, useApi } from './ui';

const TONE: Record<string, string> = { URGENT: 'red', HIGH_RISK: 'amber', KNOWN_PATIENT: 'blue', ROUTINE: 'slate' };

export const CallQueuePanel: React.FC = () => {
  const q = useApi<any>('/api/queue');
  const [phone, setPhone] = useState('+14155550198');
  const [reason, setReason] = useState('');

  useEffect(() => {
    const t = setInterval(q.reload, 5000);
    return () => clearInterval(t);
  }, [q.reload]);

  const call = async (path: string, body?: any) => {
    await apiJson(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }).catch(() => {});
    q.reload();
  };

  const d = q.data;
  return (
    <Card
      title={<span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> Call queue</span>}
      right={<span className="flex gap-1.5">
        <Badge tone={d?.depth ? 'amber' : 'green'}>{d?.depth ?? 0} waiting</Badge>
        <Badge>est. {Math.round((d?.estimated_wait_sec ?? 0) / 60)} min</Badge>
        {d?.after_hours && <Badge tone="violet">After hours · AI only</Badge>}
      </span>}
    >
      <ul className="space-y-1 text-xs mb-2">
        {(d?.waiting || []).map((e: any) => (
          <li key={e.ticket} className="flex justify-between items-center">
            <span className="text-slate-300">#{e.position} {e.caller_phone}{e.patient_id ? ` (${e.patient_id})` : ''}</span>
            <span className="flex gap-1 items-center">
              <Badge tone={TONE[e.priority]}>{e.priority.replace('_', ' ')}</Badge>
              <span className="font-mono text-slate-500">{e.wait_sec}s</span>
              <Btn variant="ghost" className="!px-1.5 !py-0.5" onClick={() => call('/api/queue/callback', { caller_phone: e.caller_phone })}>Callback</Btn>
            </span>
          </li>
        ))}
        {!d?.waiting?.length && <li className="text-slate-500">No callers waiting.</li>}
      </ul>
      <div className="flex flex-wrap gap-1.5">
        <input className={`${selectCls} w-36`} value={phone} onChange={(e) => setPhone(e.target.value)} />
        <input className={`${selectCls} w-36`} placeholder="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} />
        <Btn variant="ghost" onClick={() => call('/api/queue/enqueue', { caller_phone: phone, reason: reason || undefined })}>Add inbound</Btn>
        <Btn onClick={() => call('/api/queue/next')} disabled={!d?.depth}>Answer next</Btn>
      </div>
      {!!d?.callbacks?.length && <p className="text-[11px] text-slate-400 mt-2">Callbacks pending: {d.callbacks.map((c: any) => c.caller_phone).join(', ')}</p>}
    </Card>
  );
};
