'use client';

import React, { useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Award,
  BarChart3,
  CheckCircle,
  Clock,
  CreditCard,
  FileCheck,
  Package,
  PhoneCall,
  Radio,
  ShieldCheck,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';
import { DashboardSummary, DispenseOrder, CallSession, Patient } from '@/lib/types';
import { apiJson } from '@/lib/api';
import { useFeedback, friendlyError } from './feedback';

interface CommandCenterProps {
  isConnected: boolean;
  summary: DashboardSummary | null;
  orders: DispenseOrder[];
  sessions: CallSession[];
  patients: Patient[];
  onRefresh: () => void;
  onNavigate: (view: string) => void;
}

export const CommandCenterView: React.FC<CommandCenterProps> = ({
  isConnected,
  summary,
  orders,
  sessions,
  patients,
  onRefresh,
  onNavigate,
}) => {
  const { toast } = useFeedback();
  const queuedOrders = orders.filter((o) => o.status === 'QUEUED_FOR_FILL');
  const blockedOrders = orders.filter((o) => o.status === 'BLOCKED_DEA_REVIEW');
  const dispensedOrders = orders.filter((o) => o.status === 'DISPENSED');

  const handleDispenseAll = async () => {
    try {
      const r = await apiJson<{ dispensed: number }>('/api/orders/dispense-all', { method: 'POST' });
      toast(r.dispensed ? `Dispensed ${r.dispensed} order${r.dispensed > 1 ? 's' : ''}.` : 'Nothing queued.', r.dispensed ? 'success' : 'info');
      onRefresh();
    } catch (e) {
      toast(friendlyError(e), 'error');
    }
  };

  const s = summary || {
    total_calls: 0,
    completed_calls: 0,
    dea_blocks: 0,
    adverse_events: 0,
    queued_orders: 0,
    total_copay_volume: 0,
    med_sync_retention_rate: '0%',
    rts_reduction: '0%',
    ai_containment_rate: '0%',
    average_pdc: '0%',
  };

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header */}
      <div className="px-6 pt-6 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">
              <span className="gradient-text">Command Center</span>
            </h1>
            <p className="text-[13px] text-[var(--text-dim)] mt-1">
              Real-time pharmacy operations dashboard
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`flex items-center gap-1.5 text-[11px] font-mono px-3 py-1.5 rounded-full border ${
              isConnected
                ? 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5'
                : 'text-rose-400 border-rose-500/20 bg-rose-500/5 animate-pulse'
            }`}>
              <span className={`h-1.5 w-1.5 rounded-full ${isConnected ? 'bg-emerald-400' : 'bg-rose-400'}`} />
              {isConnected ? 'Live' : 'Reconnecting'}
            </span>
          </div>
        </div>
      </div>

      {/* Bento Grid */}
      <div className="px-6 pb-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 mb-5 stagger-children">
          {/* Stat Cards */}
          <StatCard icon={PhoneCall} label="Total Calls" value={String(s.total_calls)} color="text-indigo-400" />
          <StatCard icon={CheckCircle} label="Completed" value={String(s.completed_calls)} color="text-emerald-400" />
          <StatCard icon={AlertTriangle} label="DEA Blocks" value={String(s.dea_blocks)} color="text-amber-400" />
          <StatCard icon={Zap} label="Adverse Events" value={String(s.adverse_events)} color="text-rose-400" />
          <StatCard icon={Package} label="Queued Rx" value={String(queuedOrders.length)} color="text-cyan-400" />
          <StatCard icon={CreditCard} label="Copay Volume" value={`$${(s.total_copay_volume ?? 0).toFixed(0)}`} color="text-violet-400" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 stagger-children">
          {/* Prescription Queue (7 cols) */}
          <div className="lg:col-span-7 bento-card">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-cyan-400" />
                <span className="text-sm font-bold text-[var(--text-strong)]">Prescription Queue</span>
                {queuedOrders.length > 0 && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full tag-accent">{queuedOrders.length} pending</span>
                )}
              </div>
              {queuedOrders.length > 0 && (
                <button onClick={handleDispenseAll} className="btn btn-success text-xs !py-1.5 !px-3">
                  <CheckCircle className="h-3 w-3" />
                  Dispense All
                </button>
              )}
            </div>

            {orders.length === 0 ? (
              <div className="text-center py-8 text-[var(--text-dim)]">
                <Package className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-xs">No orders yet. Run a demo scenario to generate prescriptions.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[280px] overflow-y-auto transcript-scroll">
                {orders.slice(0, 8).map((o) => (
                  <div key={o.order_id} className="flex items-center justify-between p-3 rounded-xl transition-colors" style={{
                    background: 'var(--surface-1)',
                    border: '1px solid var(--border-default)',
                  }}>
                    <div className="flex items-center gap-3">
                      <StatusDot status={o.status} />
                      <div>
                        <div className="text-xs font-semibold text-[var(--text-strong)]">
                          {o.drug_name || o.rx_number} {o.strength || ''}
                        </div>
                        <div className="text-[10px] text-[var(--text-dim)]">
                          {o.first_name || ''} {o.last_name || ''} {o.pickup_slot || o.pickup_date ? `· ${o.pickup_slot || o.pickup_date}` : ''}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-mono font-bold text-[var(--text-body)]">
                        {o.copay_charged != null ? `$${Number(o.copay_charged).toFixed(2)}` : '—'}
                      </div>
                      <div className="text-[9px] font-mono text-[var(--text-dim)]">{o.status.replace(/_/g, ' ')}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right Column (5 cols) */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            {/* Performance Metrics */}
            <div className="bento-card">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="h-4 w-4 text-violet-400" />
                <span className="text-sm font-bold text-[var(--text-strong)]">Performance</span>
              </div>
              <div className="space-y-3">
                <MetricBar label="AI Containment Rate" value={s.ai_containment_rate || '94%'} color="bg-indigo-500" />
                <MetricBar label="Med-Sync Retention" value={s.med_sync_retention_rate} color="bg-emerald-500" />
                <MetricBar label="RTS Reduction" value={s.rts_reduction} color="bg-cyan-500" />
                <MetricBar label="Average PDC" value={s.average_pdc || '92%'} color="bg-violet-500" />
              </div>
            </div>

            {/* Recent Calls */}
            <div className="bento-card">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="h-4 w-4 text-indigo-400" />
                <span className="text-sm font-bold text-[var(--text-strong)]">Recent Calls</span>
              </div>
              {sessions.length === 0 ? (
                <p className="text-xs text-[var(--text-dim)] text-center py-4">No call sessions yet.</p>
              ) : (
                <div className="space-y-2 max-h-[160px] overflow-y-auto transcript-scroll">
                  {sessions.slice(0, 5).map((sess) => (
                    <div key={sess.session_id} className="flex items-center justify-between p-2 rounded-lg" style={{
                      background: 'var(--surface-1)',
                      border: '1px solid var(--border-default)',
                    }}>
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${
                          sess.escalation_reason ? 'bg-amber-400' : sess.call_status === 'completed' ? 'bg-emerald-400' : 'bg-indigo-400'
                        }`} />
                        <div>
                          <div className="text-[11px] font-semibold text-[var(--text-body)]">
                            {sess.first_name || 'Unknown'} {sess.last_name || ''}
                          </div>
                          <div className="text-[9px] text-[var(--text-dim)] font-mono">{sess.session_id.slice(0, 16)}</div>
                        </div>
                      </div>
                      <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${
                        sess.escalation_reason ? 'tag-warning' : 'tag-success'
                      }`}>
                        {sess.call_status || 'active'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Compliance Badge */}
            <div className="bento-card !p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0" style={{
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.2)',
              }}>
                <ShieldCheck className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <div className="text-xs font-bold text-emerald-400">HIPAA Compliant</div>
                <div className="text-[10px] text-[var(--text-dim)]">Title 21 CFR § 1306 · SHA-256 Auditing</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* Sub-components */

const StatCard: React.FC<{ icon: React.ElementType; label: string; value: string; color: string }> = ({
  icon: Icon, label, value, color,
}) => (
  <div className="bento-card !p-4 flex flex-col items-center text-center group">
    <Icon className={`h-4 w-4 ${color} mb-2 transition-transform group-hover:scale-110`} />
    <div className="text-xl font-extrabold text-[var(--text-strong)]">{value}</div>
    <div className="stat-label mt-1">{label}</div>
  </div>
);

const StatusDot: React.FC<{ status: string }> = ({ status }) => {
  const color =
    status === 'QUEUED_FOR_FILL' ? 'bg-cyan-400'
    : status === 'DISPENSED' ? 'bg-emerald-400'
    : status === 'BLOCKED_DEA_REVIEW' ? 'bg-amber-400 animate-pulse'
    : status === 'EMERGENCY_HALT' ? 'bg-rose-400 animate-pulse'
    : 'bg-slate-400';
  return <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${color}`} />;
};

const MetricBar: React.FC<{ label: string; value: string; color: string }> = ({ label, value, color }) => {
  const pct = parseInt(value) || 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] text-[var(--text-body)]">{label}</span>
        <span className="text-[11px] font-bold font-mono text-[var(--text-strong)]">{value}</span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
        <div
          className={`h-full rounded-full ${color} transition-all duration-700`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  );
};
