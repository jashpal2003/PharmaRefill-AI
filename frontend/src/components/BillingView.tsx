'use client';

import { apiFetch } from '@/lib/api';
import React, { useState } from 'react';
import {
  CreditCard,
  DollarSign,
  ShieldCheck,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  Receipt,
  Building,
  User,
  AlertCircle,
  Sparkles,
  RefreshCw,
  Wallet,
  Zap,
  X
} from 'lucide-react';
import { Patient, BillingAccount, Prescription } from '@/lib/types';

interface BillingViewProps {
  patients: Patient[];
  selectedPatient: Patient | null;
  onSelectPatient: (patientId: string) => void;
  billing: BillingAccount | null;
  prescriptions: Prescription[];
  onRefresh: () => void;
}

export const BillingView: React.FC<BillingViewProps> = ({
  patients,
  selectedPatient,
  onSelectPatient,
  billing,
  prescriptions,
  onRefresh
}) => {
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [payAmount, setPayAmount] = useState<number>(billing?.outstanding_balance || 18.5);
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentSuccessMsg, setPaymentSuccessMsg] = useState<string | null>(null);

  // Compute total copay for selected patient's active prescriptions
  const calculatedPrescriptionCopay = prescriptions.reduce(
    (sum, rx) => sum + (rx.copay_amount || 0),
    0
  );

  const handleProcessPayment = async () => {
    if (!selectedPatient) return;
    setIsProcessing(true);
    setPaymentSuccessMsg(null);
    try {
      const res = await apiFetch(
        `/api/billing/${selectedPatient.patient_id}/pay`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount: Number(payAmount) })
        }
      );
      if (res.ok) {
        const data = await res.json();
        setPaymentSuccessMsg(
          `Payment of $${Number(payAmount).toFixed(2)} processed successfully via ${billing?.card_brand || 'Visa'} ending in ${billing?.card_last4 || '4242'}.`
        );
        onRefresh();
        setTimeout(() => {
          setIsPayModalOpen(false);
          setPaymentSuccessMsg(null);
        }, 1600);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0B1120] p-6 overflow-y-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-blue-400 uppercase">
            <DollarSign className="h-4 w-4" />
            <span>Revenue Cycle & Point of Sale Triage</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-100 mt-1">Copays & Patient Accounts</h1>
          <p className="text-sm text-slate-400">
            Real-time NCPDP insurance adjudication, contactless card-on-file billing, and voice agent copay quotes.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => onRefresh()}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-300 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-lg transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Refresh Balances</span>
          </button>
          <button
            onClick={() => {
              setPayAmount(billing?.outstanding_balance || 18.5);
              setIsPayModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-950 bg-gradient-to-r from-emerald-400 to-teal-300 hover:from-emerald-300 hover:to-teal-200 rounded-lg shadow-md shadow-emerald-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <CreditCard className="h-4 w-4" />
            <span>Charge Copay Balance</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/70 border border-slate-800/80 rounded-xl p-4 flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-slate-400">Outstanding Account Balance</div>
            <div className="text-2xl font-bold text-slate-100 mt-1">
              ${billing?.outstanding_balance ? billing.outstanding_balance.toFixed(2) : '18.50'}
            </div>
            <div className="text-[11px] text-amber-400 mt-0.5">Due at prescription pickup</div>
          </div>
          <div className="h-10 w-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <DollarSign className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-slate-900/70 border border-slate-800/80 rounded-xl p-4 flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-slate-400">Card on File</div>
            <div className="text-base font-bold text-emerald-400 mt-1 flex items-center gap-2">
              <span>{billing?.card_brand || 'Visa'} •••• {billing?.card_last4 || '4242'}</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">Expires {billing?.card_exp || '09/27'}</div>
          </div>
          <div className="h-10 w-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <CreditCard className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-slate-900/70 border border-slate-800/80 rounded-xl p-4 flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-slate-400">Auto-Pay Authorization</div>
            <div className="text-base font-bold text-teal-300 mt-1 flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              <span>{billing?.auto_pay_enabled ? 'Active / Authorized' : 'Authorized (Voice)'}</span>
            </div>
            <div className="text-[11px] text-teal-400/80 mt-0.5">1-click drive-thru checkout</div>
          </div>
          <div className="h-10 w-10 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
            <Zap className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-slate-900/70 border border-slate-800/80 rounded-xl p-4 flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-slate-400">Primary PBM Network</div>
            <div className="text-base font-bold text-slate-200 mt-1 truncate">
              {billing?.insurance_provider || 'Blue Cross Blue Shield'}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              BIN: {billing?.bin || '004336'} • PCN: {billing?.pcn || 'ADV'}
            </div>
          </div>
          <div className="h-10 w-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <Building className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Patient Selector Tabs */}
      <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-800/80 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-slate-400" />
          <span className="text-xs font-semibold text-slate-300">Select Patient Ledger:</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {patients.map((p) => {
            const isSelected = selectedPatient?.patient_id === p.patient_id;
            return (
              <button
                key={p.patient_id}
                onClick={() => onSelectPatient(p.patient_id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  isSelected
                    ? 'bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/20'
                    : 'bg-slate-800/70 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-700/50'
                }`}
              >
                {p.first_name} {p.last_name} ({p.patient_id})
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Grid: Copay Breakdown & Adjudication Ledger */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Prescription Copay Items (2 cols) */}
        <div className="lg:col-span-2 bg-slate-900/40 border border-slate-800/80 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h2 className="text-sm font-bold text-slate-100">Prescription Adjudication & Copay Schedule</h2>
              <p className="text-xs text-slate-400">
                Itemized drug co-payments adjudicated through {billing?.insurance_provider || 'PBM Insurance'}.
              </p>
            </div>
            <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20">
              Rx Total: ${calculatedPrescriptionCopay.toFixed(2)}
            </span>
          </div>

          <div className="divide-y divide-slate-800/60">
            {prescriptions.map((rx) => (
              <div key={rx.rx_number} className="py-3.5 flex items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-lg bg-slate-800 flex items-center justify-center text-xs font-mono text-slate-300 shrink-0">
                    Rx
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-200">{rx.drug_name}</span>
                      <span className="text-xs text-slate-400">{rx.strength}</span>
                      <span className="text-[10px] font-mono text-slate-500 bg-slate-950 px-1 rounded border border-slate-800">
                        {rx.rx_number}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      Qty: {rx.days_supply * 1} tablets • {rx.days_supply}-day supply • Sig: {rx.directions}
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-sm font-bold text-emerald-400">
                    ${rx.copay_amount ? rx.copay_amount.toFixed(2) : '10.00'}
                  </div>
                  <div className="text-[10px] text-slate-500 flex items-center gap-1 justify-end">
                    <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                    <span>NCPDP Tier 1</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Adjudication Metadata Banner */}
          <div className="mt-4 p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              <span>Real-time Electronic Claim: Paid in Full (Response 00 / Claim Approved)</span>
            </div>
            <div className="font-mono text-slate-400">RxGroup: {billing?.group_number || 'RX9912'}</div>
          </div>
        </div>

        {/* Right Column: Account & Payment Method Details */}
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-5 space-y-5 flex flex-col justify-between">
          <div className="space-y-4">
            <h2 className="text-sm font-bold text-slate-100 border-b border-slate-800 pb-2">
              Stored Payment Instrument
            </h2>

            {/* Virtual Credit Card View */}
            <div className="bg-gradient-to-tr from-slate-900 via-indigo-950 to-slate-900 border border-indigo-500/30 rounded-xl p-4 shadow-lg text-slate-100 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-xl pointer-events-none" />
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold tracking-wider text-indigo-300 uppercase">
                  {PHARMACY_BRAND_NAME} Secure Pay
                </span>
                <span className="text-xs font-bold text-slate-200">
                  {billing?.card_brand || 'VISA'}
                </span>
              </div>

              <div className="mt-6 mb-4 font-mono text-base tracking-widest text-slate-200">
                •••• •••• •••• {billing?.card_last4 || '4242'}
              </div>

              <div className="flex items-center justify-between text-xs">
                <div>
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider">Cardholder</div>
                  <div className="font-semibold text-slate-200">
                    {selectedPatient ? `${selectedPatient.first_name} ${selectedPatient.last_name}` : 'No patient selected'}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider">Expires</div>
                  <div className="font-mono font-semibold text-slate-200">
                    {billing?.card_exp || '09/27'}
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Summary list */}
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between py-1.5 border-b border-slate-800/80">
                <span className="text-slate-400">Total Outstanding Balance</span>
                <span className="font-bold text-slate-100">
                  ${billing?.outstanding_balance ? billing.outstanding_balance.toFixed(2) : '18.50'}
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-800/80">
                <span className="text-slate-400">Payment Authorization</span>
                <span className="text-emerald-400 font-medium">PCI-DSS Tokenized</span>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-slate-400">Voice Bot Settlement</span>
                <span className="text-teal-300 font-medium">Eligible (Auto-Charged)</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              setPayAmount(billing?.outstanding_balance || 18.5);
              setIsPayModalOpen(true);
            }}
            className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-emerald-400 to-teal-300 hover:from-emerald-300 hover:to-teal-200 transition-all shadow-md shadow-emerald-500/20 flex items-center justify-center gap-2"
          >
            <CreditCard className="h-4 w-4" />
            <span>Process Payment Now</span>
          </button>
        </div>
      </div>

      {/* Pay Modal */}
      {isPayModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setIsPayModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-100"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2">
              <CreditCard className="h-4 w-4" />
              <span>Charge Patient Copay</span>
            </div>
            <h2 className="text-lg font-bold text-slate-100 mb-1">Point of Sale Copay Processing</h2>
            <p className="text-xs text-slate-400 mb-4">
              Patient: {selectedPatient?.first_name} {selectedPatient?.last_name} ({selectedPatient?.patient_id})
            </p>

            {paymentSuccessMsg ? (
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-center space-y-2">
                <CheckCircle2 className="h-8 w-8 text-emerald-400 mx-auto" />
                <div className="text-sm font-semibold text-emerald-300">{paymentSuccessMsg}</div>
                <p className="text-xs text-slate-400">Electronic receipt generated and synchronized with pharmacy ledger.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-slate-400 block mb-1">
                    Payment Amount ($ USD)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-sm">$</span>
                    <input
                      type="number"
                      step="0.01"
                      value={payAmount}
                      onChange={(e) => setPayAmount(parseFloat(e.target.value) || 0)}
                      className="w-full pl-8 pr-3 py-2 text-sm bg-slate-900 border border-slate-800 rounded-lg text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Payment Method:</span>
                    <span className="text-slate-200 font-medium">
                      {billing?.card_brand || 'Visa'} ending in {billing?.card_last4 || '4242'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-400">
                    <span>NCPDP Transmission:</span>
                    <span className="text-emerald-400 font-medium">Direct Batch Settled</span>
                  </div>
                </div>

                <div className="pt-2 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsPayModalOpen(false)}
                    className="px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-900 rounded-lg transition-colors border border-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleProcessPayment}
                    disabled={isProcessing}
                    className="px-5 py-2 text-xs font-semibold text-slate-950 bg-gradient-to-r from-emerald-400 to-teal-300 hover:from-emerald-300 hover:to-teal-200 rounded-lg transition-all flex items-center gap-2"
                  >
                    {isProcessing ? (
                      <>
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        <span>Processing...</span>
                      </>
                    ) : (
                      <>
                        <CreditCard className="h-3.5 w-3.5" />
                        <span>Confirm & Charge ${Number(payAmount).toFixed(2)}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const PHARMACY_BRAND_NAME = 'ApexCare';
