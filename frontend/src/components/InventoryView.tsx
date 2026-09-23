'use client';

import React, { useState } from 'react';
import { Boxes } from 'lucide-react';
import { Badge, Card, ErrorNote, Stat, ViewShell, useApi } from './ui';

export const InventoryView: React.FC = () => {
  const inv = useApi<any>('/api/inventory');
  const b340 = useApi<any>('/api/340b');
  const [tab, setTab] = useState<'STOCK' | '340B'>('STOCK');
  const alerts = inv.data?.alerts || [];

  return (
    <ViewShell
      icon={Boxes}
      title="Inventory, Expiry & 340B"
      subtitle="Lot-level on-hand stock with expiry horizons and reorder suggestions from 90-day dispensing velocity. 340B view routes each order to 340B or commercial stock and flags Medicaid duplicate-discount risk."
      actions={
        <div className="flex gap-1 p-1 rounded-xl bg-slate-900 border border-slate-800 text-xs">
          {(['STOCK', '340B'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`px-3 py-1.5 rounded-lg font-semibold cursor-pointer ${tab === t ? 'bg-slate-800 text-white' : 'text-slate-400'}`}>{t === 'STOCK' ? 'Stock' : '340B'}</button>
          ))}
        </div>
      }
    >
      <ErrorNote error={inv.error || b340.error} />
      {tab === 'STOCK' ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat label="Lots on hand" value={inv.data?.items?.length ?? '—'} />
            <Stat label="Reorder alerts" value={alerts.filter((a: any) => a.type === 'REORDER').length} tone="amber" />
            <Stat label="Expiring ≤ 60 days" value={alerts.filter((a: any) => a.type === 'EXPIRY').length} tone="red" />
            <Stat label="340B lots" value={inv.data?.items?.filter((i: any) => i.is_340b_stock).length ?? '—'} tone="violet" />
          </div>
          <Card title="Alerts">
            <ul className="space-y-1 text-xs">
              {alerts.map((a: any, i: number) => (
                <li key={i} className="flex items-center gap-2">
                  <Badge tone={a.type === 'EXPIRY' ? 'red' : 'amber'}>{a.type}</Badge>
                  <span className="text-slate-200">{a.drug}</span>
                  <span className="text-slate-400">{a.detail}{a.suggested_order_qty ? ` — suggest ordering ${a.suggested_order_qty} units` : ''}{a.lot ? ` (lot ${a.lot})` : ''}</span>
                </li>
              ))}
              {!alerts.length && <li className="text-slate-500">No alerts.</li>}
            </ul>
          </Card>
          <Card title="Stock by NDC / lot">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-slate-400"><tr><th className="text-left py-1">Drug</th><th className="text-left">NDC</th><th className="text-left">Lot</th><th>On hand</th><th>Reorder pt</th><th>Days on hand</th><th>Expiry</th><th>Pool</th></tr></thead>
                <tbody>
                  {(inv.data?.items || []).map((i: any) => (
                    <tr key={i.ndc + i.lot_number} className="border-t border-slate-800">
                      <td className="py-1.5 text-slate-200">{i.drug_name} {i.strength}</td>
                      <td className="font-mono text-slate-400">{i.ndc}</td>
                      <td className="font-mono text-slate-400">{i.lot_number}</td>
                      <td className="text-center font-mono">{i.on_hand}</td>
                      <td className="text-center font-mono">{i.reorder_point}</td>
                      <td className="text-center font-mono">{i.days_on_hand ?? '—'}</td>
                      <td className="text-center"><Badge tone={i.expiry_band === 'OK' ? 'green' : i.expiry_band === '90' ? 'blue' : i.expiry_band === '60' ? 'amber' : 'red'}>{i.expiry_band === 'OK' ? i.expiration_date : `${i.days_to_expiry}d`}</Badge></td>
                      <td className="text-center">{i.is_340b_stock ? <Badge tone="violet">340B</Badge> : <Badge>WAC</Badge>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[10px] text-slate-500 mt-2">{inv.data?.note}</p>
          </Card>
        </>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Stat label="340B-eligible patients" value={b340.data?.summary?.eligible_patients ?? '—'} tone="violet" />
            <Stat label="Orders → 340B" value={b340.data?.summary?.orders_340b ?? '—'} />
            <Stat label="Orders → commercial" value={b340.data?.summary?.orders_commercial ?? '—'} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card title="Patient eligibility">
              <ul className="space-y-1 text-xs">
                {(b340.data?.patients || []).map((p: any) => (
                  <li key={p.patient_id} className="flex justify-between">
                    <span className="text-slate-200">{p.first_name} {p.last_name}</span>
                    {p.is_340b_eligible ? <Badge tone="violet">{p.covered_entity}</Badge> : <Badge>Not eligible</Badge>}
                  </li>
                ))}
              </ul>
            </Card>
            <Card title="Claim routing (split billing)">
              <ul className="space-y-1 text-xs">
                {(b340.data?.claim_routing || []).map((o: any) => (
                  <li key={o.order_id} className="flex justify-between gap-2">
                    <span className="text-slate-300">{o.order_id} · {o.drug_name}</span>
                    <span className="flex gap-1">
                      <Badge tone={o.route === '340B' ? 'violet' : 'slate'}>{o.route}</Badge>
                      {o.duplicate_discount_risk && <Badge tone="red">Dup-discount risk</Badge>}
                    </span>
                  </li>
                ))}
                {!b340.data?.claim_routing?.length && <li className="text-slate-500">No orders yet.</li>}
              </ul>
            </Card>
          </div>
        </>
      )}
    </ViewShell>
  );
};
