'use client';

import React from 'react';
import { PhoneForwarded, X } from 'lucide-react';
import { Badge, Btn, riskTone, severityTone } from './ui';

export const WarmTransferModal: React.FC<{ packet: any | null; onClose: () => void; onOpenSoap: () => void }> = ({ packet, onClose, onOpenSoap }) => {
  if (!packet) return null;
  const p = packet.patient;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label="Warm transfer context">
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl bg-slate-950 border border-amber-500/40 shadow-2xl">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800 bg-amber-950/30">
          <div className="flex items-center gap-2 text-amber-200 font-bold text-sm">
            <PhoneForwarded className="h-4 w-4" /> Incoming warm transfer — {packet.escalation_reason?.replace(/_/g, ' ')}
          </div>
          <button onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-white cursor-pointer"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1.5">
              <Badge tone={packet.verified ? 'green' : 'red'}>{packet.verified ? 'Identity verified' : 'NOT verified'}</Badge>
              <Badge>{packet.auth_method}</Badge>
              <Badge tone="blue">Lang: {packet.language}</Badge>
              {packet.adherence && <Badge tone={riskTone(packet.adherence.risk_band)}>Adherence {packet.adherence.risk_score}</Badge>}
            </div>
            {p ? (
              <div className="text-slate-200">
                <div className="text-base font-bold">{p.first_name} {p.last_name}</div>
                <div className="text-slate-400">DOB {p.dob} · {p.primary_phone} · {p.insurance_carrier}</div>
              </div>
            ) : <div className="text-slate-400">Caller {packet.caller_phone} (no verified patient record)</div>}
            {packet.requested_medication && <div><span className="text-slate-400">Requested:</span> <span className="text-slate-100">{packet.requested_medication.drug_name} {packet.requested_medication.strength}</span></div>}
            {packet.allergies && <div><span className="text-slate-400">Allergies:</span> {packet.allergies.map((a: any) => a.allergen).join(', ') || 'NKDA'}</div>}
            {packet.active_prescriptions && (
              <div>
                <div className="text-slate-400 mb-1">Active Rx</div>
                <ul className="space-y-0.5">{packet.active_prescriptions.map((r: any) => <li key={r.rx_number} className="text-slate-300">{r.drug_name} {r.strength}{r.dea_schedule >= 2 ? ` · C-${r.dea_schedule}` : ''}</li>)}</ul>
              </div>
            )}
            {!!packet.dur_top_alerts?.length && (
              <div>
                <div className="text-slate-400 mb-1">Top DUR alerts</div>
                {packet.dur_top_alerts.map((a: any) => <div key={a.alert_key} className="mb-1"><Badge tone={severityTone(a.severity)}>{a.severity}</Badge> <span className="text-slate-300">{a.drugs.join(' + ')}</span></div>)}
              </div>
            )}
          </div>
          <div>
            <div className="text-slate-400 mb-1">Live transcript</div>
            <div className="rounded-lg bg-slate-900 border border-slate-800 p-3 space-y-1.5 max-h-80 overflow-y-auto">
              {packet.transcript.map((line: string, i: number) => (
                <p key={i} className={line.startsWith('Caller:') ? 'text-blue-200' : 'text-slate-300'}>{line}</p>
              ))}
            </div>
          </div>
        </div>
        <div className="px-5 py-3 border-t border-slate-800 flex justify-end gap-2">
          {p && <Btn variant="ghost" onClick={onOpenSoap}>Draft SOAP note</Btn>}
          <Btn onClick={onClose}>Accept call</Btn>
        </div>
      </div>
    </div>
  );
};
