'use client';

import { apiFetch } from '@/lib/api';
import React, { useState, useEffect } from 'react';
import {
  MessageSquare,
  X,
  Send,
  CheckCircle2,
  Clock,
  KeyRound,
  ShieldCheck,
  Smartphone,
  Sparkles,
  RefreshCw,
  Lock,
  ArrowRight,
  ExternalLink
} from 'lucide-react';

interface OutboundSms {
  id: string;
  patient_id: string;
  patient_name: string;
  phone: string;
  type: string;
  message: string;
  locker_id: string;
  pickup_code: string;
  timestamp: string;
  status: string;
}

interface SmsDispatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientId?: string;
  patientName?: string;
  patientPhone?: string;
}

export const SmsDispatchModal: React.FC<SmsDispatchModalProps> = ({
  isOpen,
  onClose,
  patientId = 'PAT-1001',
  patientName = 'Eleanor Vance',
  patientPhone = '+1 (415) 555-0192'
}) => {
  const [messages, setMessages] = useState<OutboundSms[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [lockerId, setLockerId] = useState('LOCKER-B12');
  const [notificationNote, setNotificationNote] = useState('Prescription ready in 24/7 drive-thru locker.');
  const [lastOtp, setLastOtp] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const fetchOutbox = async () => {
    try {
      setLoading(true);
      const res = await apiFetch('/api/sms/outbox');
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } catch (e) {
      console.error('Failed to load SMS outbox', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchOutbox();
    }
  }, [isOpen]);

  const handleSendLockerOtp = async () => {
    try {
      setSending(true);
      setStatusMessage(null);
      const res = await apiFetch('/api/sms/send-locker-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id: patientId,
          locker_id: lockerId,
          notes: notificationNote
        })
      });

      if (res.ok) {
        const data = await res.json();
        setLastOtp(data.pickup_code);
        setStatusMessage(`Successfully dispatched SMS to ${data.phone}. Locker OTP: ${data.pickup_code}`);
        await fetchOutbox();
      } else {
        setStatusMessage('Error sending SMS notification.');
      }
    } catch (e) {
      console.error(e);
      setStatusMessage('Network error dispatching SMS.');
    } finally {
      setSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="glass-panel-elevated w-full max-w-3xl rounded-2xl border border-slate-700/80 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Smartphone className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-white text-base">
                  Outbound Patient SMS & 24/7 Drive-Thru Locker Dispatch
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-950/60 border border-blue-500/30 text-blue-300">
                  Lumistry Smart-Locker
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Automated refill completion alerts with secure 4-digit pickup tokens.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Dispatch Control Form */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Send className="h-4 w-4 text-blue-400" />
                Dispatch Locker OTP SMS to Active Patient
              </span>
              <span className="text-[11px] font-mono text-slate-400">
                {patientName} ({patientId})
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">
                  Assigned Locker Unit
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Lock className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      value={lockerId}
                      onChange={(e) => setLockerId(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <button
                    onClick={() => setLockerId(`LOCKER-${String.fromCharCode(65 + Math.floor(Math.random() * 4))}${Math.floor(10 + Math.random() * 89)}`)}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
                    title="Generate Random Locker Slot"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">
                  Recipient ANI Phone
                </label>
                <input
                  type="text"
                  readOnly
                  value={patientPhone}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-300 font-mono"
                />
              </div>
            </div>

            {/* Custom Notes */}
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">
                Custom Message / Instructions
              </label>
              <input
                type="text"
                value={notificationNote}
                onChange={(e) => setNotificationNote(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-2">
              <div className="text-xs">
                {statusMessage && (
                  <span className="text-emerald-400 font-medium flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {statusMessage}
                  </span>
                )}
              </div>
              <button
                onClick={handleSendLockerOtp}
                disabled={sending}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold text-xs transition shadow-md shadow-blue-600/25 active:scale-95 cursor-pointer"
              >
                {sending ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <KeyRound className="h-4 w-4" />
                )}
                <span>Generate & Dispatch 4-Digit OTP</span>
              </button>
            </div>
          </div>

          {/* Outbox Activity Feed */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold text-white flex items-center gap-2">
                <Clock className="h-4 w-4 text-slate-400" />
                Outbound Message Ledger ({messages.length})
              </h4>
              <button
                onClick={fetchOutbox}
                disabled={loading}
                className="flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-white transition"
              >
                <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
                <span>Refresh Logs</span>
              </button>
            </div>

            <div className="space-y-3">
              {messages.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs rounded-xl bg-slate-900/40 border border-slate-800">
                  No outbound messages logged yet.
                </div>
              ) : (
                messages.map((sms) => (
                  <div
                    key={sms.id}
                    className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800/80 space-y-2 hover:border-slate-700 transition"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">{sms.patient_name}</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                          {sms.phone}
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-950/60 border border-blue-500/30 text-blue-300">
                          {sms.type}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-400 font-mono">
                          {new Date(sms.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-emerald-950/60 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          {sms.status}
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-slate-200 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/60 font-sans leading-relaxed">
                      {sms.message}
                    </p>

                    {sms.locker_id && (
                      <div className="flex items-center gap-4 text-[11px] pt-1 text-slate-400 font-mono">
                        <span className="flex items-center gap-1 text-blue-300">
                          <Lock className="h-3 w-3" />
                          Locker: {sms.locker_id}
                        </span>
                        <span className="flex items-center gap-1 text-emerald-300 font-bold bg-emerald-950/30 px-2 py-0.5 rounded border border-emerald-800/50">
                          <KeyRound className="h-3 w-3" />
                          OTP: {sms.pickup_code}
                        </span>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/50 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <span>HIPAA-Compliant Encrypted Carrier Gateway (Twilio / AWS Pinpoint)</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
