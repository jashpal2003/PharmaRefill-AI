'use client';

import React, { useState } from 'react';
import { Header } from '@/components/Header';
import { LiveCallMonitor } from '@/components/LiveCallMonitor';
import { PatientAdjudication } from '@/components/PatientAdjudication';
import { ClinicalAuditFeed } from '@/components/ClinicalAuditFeed';
import { InteractivePhoneModal } from '@/components/InteractivePhoneModal';
import { WerBenchmarkModal } from '@/components/WerBenchmarkModal';
import { SnapToVerifyModal } from '@/components/SnapToVerifyModal';
import { useDashboardSocket } from '@/hooks/useDashboardSocket';

export default function PharmacistCockpitPage() {
  const {
    isConnected,
    summary,
    patient,
    prescriptions,
    orders,
    sessions,
    activeSessionId,
    activeState,
    isAgentSpeaking,
    transcript,
    recentTokens,
    deaAlert,
    emergencyAlert,
    latestAudit,
    retryCount,
    totalCopay,
    pickupSlot,
    refreshData
  } = useDashboardSocket();

  const [isPhoneModalOpen, setIsPhoneModalOpen] = useState(false);
  const [isBenchmarkModalOpen, setIsBenchmarkModalOpen] = useState(false);
  const [isSnapModalOpen, setIsSnapModalOpen] = useState(false);

  const handleDispenseAll = async () => {
    try {
      await fetch('http://127.0.0.1:8000/api/orders/dispense-all', { method: 'POST' });
      refreshData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleExportFhir = async () => {
    try {
      const res = await fetch('http://127.0.0.1:8000/api/export/fhir/PAT-1001');
      const bundle = await res.json();
      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `FHIR_Bundle_PAT-1001_${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
    }
  };

  const handleResetDemo = async () => {
    try {
      await fetch('http://127.0.0.1:8000/api/reset-demo', { method: 'POST' });
      refreshData();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#06090e] text-slate-100 selection:bg-emerald-500 selection:text-slate-950">
      {/* Header Navigation & System Status Bar */}
      <Header
        isConnected={isConnected}
        onOpenPhoneModal={() => setIsPhoneModalOpen(true)}
        onOpenBenchmarkModal={() => setIsBenchmarkModalOpen(true)}
        onOpenSnapModal={() => setIsSnapModalOpen(true)}
        onResetDemo={handleResetDemo}
      />

      {/* Main 3-Panel Pharmacist Operations Cockpit Grid */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Panel 1: Live Inbound Call Monitor & Waveform */}
        <section className="h-[calc(100vh-6.5rem)] min-h-[580px]">
          <LiveCallMonitor
            activeSessionId={activeSessionId}
            activeState={activeState}
            isAgentSpeaking={isAgentSpeaking}
            transcript={transcript}
            recentTokens={recentTokens}
            retryCount={retryCount}
          />
        </section>

        {/* Panel 2: Patient Record & Adjudication & Med-Sync */}
        <section className="h-[calc(100vh-6.5rem)] min-h-[580px]">
          <PatientAdjudication
            patient={patient}
            prescriptions={prescriptions}
            totalCopay={totalCopay}
            pickupSlot={pickupSlot}
          />
        </section>

        {/* Panel 3: Clinical Audit Feed (LeMUR / LLM Gateway) */}
        <section className="h-[calc(100vh-6.5rem)] min-h-[580px]">
          <ClinicalAuditFeed
            deaAlert={deaAlert}
            emergencyAlert={emergencyAlert}
            latestAudit={latestAudit}
            onDispenseAll={handleDispenseAll}
            onExportFhir={handleExportFhir}
          />
        </section>
      </main>

      {/* Interactive Evaluation Modals */}
      <InteractivePhoneModal
        isOpen={isPhoneModalOpen}
        onClose={() => setIsPhoneModalOpen(false)}
        onRefresh={refreshData}
      />

      <WerBenchmarkModal
        isOpen={isBenchmarkModalOpen}
        onClose={() => setIsBenchmarkModalOpen(false)}
      />

      <SnapToVerifyModal
        isOpen={isSnapModalOpen}
        onClose={() => setIsSnapModalOpen(false)}
      />
    </div>
  );
}
