'use client';

import React, { useState } from 'react';
import { DispenseOrder } from '@/lib/types';
import {
  Package,
  CheckSquare,
  Printer,
  ShieldAlert,
  CheckCircle,
  Clock,
  Filter,
  Search,
  MessageSquare,
  QrCode,
  DollarSign,
  AlertTriangle,
  FileText
} from 'lucide-react';

interface DispenseQueueViewProps {
  orders: DispenseOrder[];
  onDispenseAll: () => void;
  onRefresh: () => void;
}

export const DispenseQueueView: React.FC<DispenseQueueViewProps> = ({
  orders,
  onDispenseAll,
  onRefresh
}) => {
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrderForLabel, setSelectedOrderForLabel] = useState<DispenseOrder | null>(null);
  const [isDispensing, setIsDispensing] = useState(false);

  const filteredOrders = orders.filter((o) => {
    const matchesStatus =
      filterStatus === 'ALL' ||
      (filterStatus === 'QUEUED' && o.status === 'QUEUED_FOR_FILL') ||
      (filterStatus === 'BLOCKED_DEA' && o.status === 'BLOCKED_DEA_REVIEW') ||
      (filterStatus === 'DISPENSED' && o.status === 'DISPENSED');

    const drug = o.drug_name || '';
    const pt = `${o.first_name || ''} ${o.last_name || ''}`;
    const rx = o.rx_number || '';
    const query = searchQuery.toLowerCase();

    const matchesSearch =
      drug.toLowerCase().includes(query) ||
      pt.toLowerCase().includes(query) ||
      rx.toLowerCase().includes(query);

    return matchesStatus && matchesSearch;
  });

  const queuedCount = orders.filter((o) => o.status === 'QUEUED_FOR_FILL').length;
  const deaCount = orders.filter((o) => o.status === 'BLOCKED_DEA_REVIEW').length;
  const dispensedCount = orders.filter((o) => o.status === 'DISPENSED').length;

  const handleDispenseAllWithLoading = async () => {
    setIsDispensing(true);
    await onDispenseAll();
    setIsDispensing(false);
  };

  return (
    <div className="flex-1 flex flex-col p-6 overflow-hidden">
      {/* Top Header & Metrics Bar */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-5 border-b border-slate-800/80">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2.5">
            <Package className="h-6 w-6 text-blue-400" />
            Prescription Dispense & Order Fulfillment Queue
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Real-time dispensing queue populated by the automated voice triage agent and clinical adjudicator.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleDispenseAllWithLoading}
            disabled={isDispensing || queuedCount === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold text-xs transition shadow-md shadow-blue-600/20 cursor-pointer"
          >
            <CheckSquare className="h-4 w-4" />
            <span>{isDispensing ? 'Dispensing...' : `Dispense All Queued (${queuedCount})`}</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 my-4">
        <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
          <span className="text-[11px] font-mono text-slate-400 uppercase block">Total Orders</span>
          <span className="text-2xl font-extrabold text-white font-mono mt-0.5 block">{orders.length}</span>
        </div>
        <div className="p-3.5 rounded-xl bg-blue-950/30 border border-blue-500/30">
          <span className="text-[11px] font-mono text-blue-400 uppercase block">Queued For Fill</span>
          <span className="text-2xl font-extrabold text-blue-200 font-mono mt-0.5 block">{queuedCount}</span>
        </div>
        <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-500/30">
          <span className="text-[11px] font-mono text-amber-400 uppercase block">DEA Schedule II Hold</span>
          <span className="text-2xl font-extrabold text-amber-300 font-mono mt-0.5 block">{deaCount}</span>
        </div>
        <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
          <span className="text-[11px] font-mono text-slate-400 uppercase block">Dispensed / Ready</span>
          <span className="text-2xl font-extrabold text-slate-200 font-mono mt-0.5 block">{dispensedCount}</span>
        </div>
      </div>

      {/* Search & Filter Tabs */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-3.5">
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-900 border border-slate-800 text-xs">
          <button
            onClick={() => setFilterStatus('ALL')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
              filterStatus === 'ALL' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All Orders ({orders.length})
          </button>
          <button
            onClick={() => setFilterStatus('QUEUED')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
              filterStatus === 'QUEUED' ? 'bg-blue-600/20 text-blue-300 border border-blue-500/40' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Queued ({queuedCount})
          </button>
          <button
            onClick={() => setFilterStatus('BLOCKED_DEA')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
              filterStatus === 'BLOCKED_DEA' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            DEA Review ({deaCount})
          </button>
          <button
            onClick={() => setFilterStatus('DISPENSED')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
              filterStatus === 'DISPENSED' ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Dispensed ({dispensedCount})
          </button>
        </div>

        {/* Search input */}
        <div className="relative w-full sm:w-72">
          <Search className="h-4 w-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search drug name, patient, or Rx#..."
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      {/* Orders Table */}
      <div className="flex-1 bg-slate-950/80 rounded-2xl border border-slate-800 overflow-hidden flex flex-col min-h-0">
        <div className="overflow-y-auto flex-1">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/90 text-slate-400 uppercase text-[10px] tracking-wider sticky top-0 border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Order ID & Date</th>
                <th className="py-3 px-4">Patient</th>
                <th className="py-3 px-4">Prescription</th>
                <th className="py-3 px-4">Co-Pay</th>
                <th className="py-3 px-4">Pickup Slot / Locker</th>
                <th className="py-3 px-4">Fulfillment Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-200">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-500">
                    No prescription dispense orders match the active filter.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((o) => {
                  const isDeaBlocked = o.status === 'BLOCKED_DEA_REVIEW';
                  const isQueued = o.status === 'QUEUED_FOR_FILL';
                  const isDispensed = o.status === 'DISPENSED';

                  return (
                    <tr key={o.order_id} className="hover:bg-slate-900/50 transition">
                      <td className="py-3 px-4 font-mono">
                        <span className="text-white font-bold block">{o.order_id}</span>
                        <span className="text-[10px] text-slate-500">{o.created_at}</span>
                      </td>

                      <td className="py-3 px-4">
                        <span className="font-semibold text-white block">
                          {o.first_name} {o.last_name}
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono">{o.patient_id}</span>
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white">{o.drug_name || 'Atorvastatin Calcium'}</span>
                          <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
                            {o.strength || '20mg'}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400 font-mono">
                          Rx: {o.rx_number} • {o.dosage_form || 'Tablet'}
                        </span>
                      </td>

                      <td className="py-3 px-4 font-mono text-emerald-400 font-bold">
                        ${Number(o.copay_charged || 12.40).toFixed(2)}
                      </td>

                      <td className="py-3 px-4 text-slate-300">
                        <span className="block font-medium">{o.pickup_slot || 'Friday 3:00 PM - 6:00 PM'}</span>
                        <span className="text-[10px] text-slate-500">Drive-Thru Locker 4B</span>
                      </td>

                      <td className="py-3 px-4">
                        {isDeaBlocked ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/50">
                            <ShieldAlert className="h-3 w-3" />
                            BLOCKED DEA REVIEW
                          </span>
                        ) : isQueued ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/50">
                            <Clock className="h-3 w-3" />
                            QUEUED FOR FILL
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/50">
                            <CheckCircle className="h-3 w-3" />
                            DISPENSED & READY
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setSelectedOrderForLabel(o)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition cursor-pointer"
                            title="Print Thermal Rx Prescription Label"
                          >
                            <Printer className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Thermal Rx Prescription Label Modal Preview */}
      {selectedOrderForLabel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-white text-slate-950 p-6 rounded-2xl max-w-md w-full shadow-2xl font-mono border-4 border-slate-900">
            <div className="flex items-center justify-between border-b-2 border-slate-900 pb-2 mb-3">
              <div>
                <h3 className="font-extrabold text-sm uppercase tracking-wider">Community Care Pharmacy</h3>
                <p className="text-[10px] text-slate-600">740 Castro St, San Francisco, CA • (415) 555-0100</p>
              </div>
              <button
                onClick={() => setSelectedOrderForLabel(null)}
                className="text-slate-500 hover:text-slate-950 font-bold text-lg"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between border-b pb-1">
                <span>Rx #: <strong>{selectedOrderForLabel.rx_number}</strong></span>
                <span>Date: <strong>{new Date().toLocaleDateString()}</strong></span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500">Patient:</span>
                <p className="text-sm font-bold">{selectedOrderForLabel.first_name} {selectedOrderForLabel.last_name}</p>
              </div>
              <div className="p-2 bg-slate-100 rounded border">
                <p className="text-sm font-bold uppercase">{selectedOrderForLabel.drug_name || 'Atorvastatin Calcium'} {selectedOrderForLabel.strength || '20mg'}</p>
                <p className="text-[11px] text-slate-700 mt-1">Take 1 tablet by mouth daily at bedtime with water.</p>
              </div>
              <div className="flex justify-between text-[11px] pt-1">
                <span>Qty: 30 Tablets</span>
                <span>Co-Pay: <strong>${Number(selectedOrderForLabel.copay_charged || 12.40).toFixed(2)}</strong></span>
              </div>
              <div className="pt-2 border-t text-center">
                <span className="text-[10px] text-slate-500 block">Drive-thru contactless pickup window:</span>
                <span className="font-bold text-xs">{selectedOrderForLabel.pickup_slot || 'Friday 3:00 PM - 6:00 PM'}</span>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t-2 border-slate-900 flex justify-end gap-2">
              <button
                onClick={() => setSelectedOrderForLabel(null)}
                className="px-4 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800"
              >
                Print to Zebra Thermal Printer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
