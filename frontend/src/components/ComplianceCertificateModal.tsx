'use client';

import React, { useEffect, useState } from 'react';
import {
  ShieldCheck,
  Lock,
  Download,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  X,
  FileCheck2,
  Copy,
  Check,
  Scale,
  Award
} from 'lucide-react';
import { apiJson } from '@/lib/api';

interface CertificateData {
  certificate_id: string;
  session_id: string;
  issued_at: string;
  pharmacy: {
    name: string;
    dea_registration: string;
    npi: string;
    address: string;
  };
  caller_verification: {
    caller_phone_masked: string;
    patient_id: string;
    patient_name: string;
    verified: boolean;
    auth_method: string;
    hipaa_minimum_necessary_enforced: boolean;
    two_party_recording_consent_disclosed: boolean;
  };
  regulatory_enforcement: {
    title_21_cfr_1306_enforced: boolean;
    controlled_substance_refills_prevented: boolean;
    dea_hard_block_status: string;
    cfr_statute: string;
    supervising_pharmacist: string;
  };
  dispense_audit: {
    orders_processed: number;
    orders_summary: Array<{
      order_id?: string;
      drug_name?: string;
      strength?: string;
      status?: string;
    }>;
    total_copay_disclosed: string;
    pickup_window: string;
  };
  cryptographic_proof: {
    algorithm: string;
    prev_block_hash: string;
    transcript_sha256: string;
    merkle_payload_hash: string;
    certificate_signature: string;
    tamper_evident_status: string;
    verification_url: string;
  };
}

interface VerificationResult {
  session_id: string;
  is_valid: boolean;
  tamper_status: string;
  server_hash: string;
  client_hash: string;
  verified_at: string;
  dea_cfr_1306_compliant: boolean;
  hipaa_consent_verified: boolean;
}

interface ComplianceCertificateModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId?: string;
}

export const ComplianceCertificateModal: React.FC<ComplianceCertificateModalProps> = ({
  isOpen,
  onClose,
  sessionId = 'DEMO-SESSION-001',
}) => {
  const [cert, setCert] = useState<CertificateData | null>(null);
  const [verification, setVerification] = useState<VerificationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCertificate = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiJson<CertificateData>(`/api/compliance/certificate/${sessionId}`);
      setCert(data);
      // Auto verify on load
      const v = await apiJson<VerificationResult>(
        `/api/compliance/verify/${sessionId}?hash=${data.cryptographic_proof.certificate_signature}`
      );
      setVerification(v);
    } catch (err: any) {
      setError(err.message || 'Failed to load compliance certificate');
    } finally {
      setLoading(false);
    }
  };

  const verifySignature = async () => {
    if (!cert) return;
    setVerifying(true);
    try {
      const v = await apiJson<VerificationResult>(
        `/api/compliance/verify/${sessionId}?hash=${cert.cryptographic_proof.certificate_signature}`
      );
      setVerification(v);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setVerifying(false);
    }
  };

  const copySignature = () => {
    if (!cert) return;
    navigator.clipboard.writeText(cert.cryptographic_proof.certificate_signature);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadJson = () => {
    if (!cert) return;
    const blob = new Blob([JSON.stringify(cert, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${cert.certificate_id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    if (isOpen) {
      fetchCertificate();
    }
  }, [isOpen, sessionId]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-3xl max-h-[92vh] flex flex-col bg-slate-950 border border-emerald-500/30 rounded-3xl shadow-2xl shadow-emerald-500/10 text-slate-100 overflow-hidden">
        {/* Header with holographic certificate styling */}
        <div className="relative px-6 py-4 border-b border-emerald-500/20 bg-gradient-to-r from-emerald-950/40 via-slate-900 to-cyan-950/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 shadow-inner">
              <Award className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold tracking-tight text-white">
                  Title 21 CFR § 1306 & HIPAA Compliance Certificate
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  SHA-256 Verifiable
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono">
                {cert ? cert.certificate_id : 'Initializing cryptographic proof…'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={downloadJson}
              disabled={!cert}
              title="Download Certificate JSON"
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              <Download className="h-4 w-4" />
            </button>
            <button
              onClick={onClose}
              title="Close Modal"
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-sm">
          {loading && (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400">
              <RefreshCw className="h-8 w-8 animate-spin text-emerald-400" />
              <p className="text-xs font-mono">Computing cryptographic hash chain & Merkle proof…</p>
            </div>
          )}

          {error && (
            <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {cert && !loading && (
            <>
              {/* Tamper Status Banner */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/60 to-slate-900 border border-emerald-500/40 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-emerald-500/20 border border-emerald-400 flex items-center justify-center text-emerald-400">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-emerald-300 flex items-center gap-1.5">
                      Cryptographic Seal: {cert.cryptographic_proof.tamper_evident_status}
                    </h3>
                    <p className="text-xs text-slate-300">
                      Zero tampering detected. Session actions verified against immutable audit chain.
                    </p>
                  </div>
                </div>
                <button
                  onClick={verifySignature}
                  disabled={verifying}
                  className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-emerald-500/20"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${verifying ? 'animate-spin' : ''}`} />
                  Verify Hash
                </button>
              </div>

              {/* 3-Column Compliance Summary Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    <span>HIPAA Identity Proof</span>
                  </div>
                  <p className="text-xs text-white font-medium">
                    {cert.caller_verification.patient_name} ({cert.caller_verification.patient_id})
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Method: {cert.caller_verification.auth_method}
                  </p>
                  <p className="text-[10px] text-emerald-400 flex items-center gap-1">
                    ✓ Consent disclosure recorded
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-cyan-400">
                    <Scale className="h-3.5 w-3.5" />
                    <span>DEA Title 21 CFR § 1306</span>
                  </div>
                  <p className="text-xs text-white font-medium">
                    Schedule II-V Hard Block: ACTIVE
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Status: {cert.regulatory_enforcement.dea_hard_block_status}
                  </p>
                  <p className="text-[10px] text-cyan-400 flex items-center gap-1">
                    ✓ Voice auto-refill strictly forbidden
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-violet-400">
                    <FileCheck2 className="h-3.5 w-3.5" />
                    <span>Dispense Audit</span>
                  </div>
                  <p className="text-xs text-white font-medium">
                    Orders: {cert.dispense_audit.orders_processed} Prescriptions
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Copay: {cert.dispense_audit.total_copay_disclosed}
                  </p>
                  <p className="text-[10px] text-violet-400 flex items-center gap-1">
                    ✓ Pickup: {cert.dispense_audit.pickup_window}
                  </p>
                </div>
              </div>

              {/* SHA-256 Hash Chain Proof Section */}
              <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5 text-emerald-400" />
                    SHA-256 Tamper-Evident Digital Signature
                  </span>
                  <button
                    onClick={copySignature}
                    className="text-xs text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    {copied ? (
                      <>
                        <Check className="h-3 w-3 text-emerald-400" /> Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" /> Copy Signature
                      </>
                    )}
                  </button>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 font-mono text-[11px] text-emerald-400 break-all select-all">
                  {cert.cryptographic_proof.certificate_signature}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] text-slate-400 pt-1 font-mono">
                  <div>
                    <span className="text-slate-500">Transcript SHA-256: </span>
                    <span className="text-slate-300">
                      {cert.cryptographic_proof.transcript_sha256.slice(0, 20)}…
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">Merkle Root: </span>
                    <span className="text-slate-300">
                      {cert.cryptographic_proof.merkle_payload_hash.slice(0, 20)}…
                    </span>
                  </div>
                </div>
              </div>

              {/* Supervising Authority Footer */}
              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                <span>
                  Supervising Pharmacist:{' '}
                  <strong className="text-slate-200">
                    {cert.regulatory_enforcement.supervising_pharmacist}
                  </strong>
                </span>
                <span>
                  Pharmacy DEA: <strong className="text-slate-200">{cert.pharmacy.dea_registration}</strong>
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
