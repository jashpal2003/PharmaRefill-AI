'use client';

import { apiFetch } from '@/lib/api';
import React, { useState } from 'react';
import { Header } from '@/components/Header';
import { Sidebar, ActiveNavView } from '@/components/Sidebar';
import { CallCenterView } from '@/components/CallCenterView';
import { DispenseQueueView } from '@/components/DispenseQueueView';
import { PatientRegistryView } from '@/components/PatientRegistryView';
import { ConsultationsView } from '@/components/ConsultationsView';
import { BillingView } from '@/components/BillingView';
import { ClinicalAuditsView } from '@/components/ClinicalAuditsView';
import { VoiceSettingsView } from '@/components/VoiceSettingsView';
import { DockedCallBar } from '@/components/DockedCallBar';
import { InteractivePhoneModal } from '@/components/InteractivePhoneModal';
import { WerBenchmarkModal } from '@/components/WerBenchmarkModal';
import { SnapToVerifyModal } from '@/components/SnapToVerifyModal';
import { SmsDispatchModal } from '@/components/SmsDispatchModal';
import { SoapNoteModal } from '@/components/SoapNoteModal';
import { useDashboardSocket } from '@/hooks/useDashboardSocket';
import { AnalyticsView } from '@/components/AnalyticsView';
import { PriorAuthView } from '@/components/PriorAuthView';
import { ImmunizationsView } from '@/components/ImmunizationsView';
import { OutreachView } from '@/components/OutreachView';
import { InventoryView } from '@/components/InventoryView';
import { ComplianceView } from '@/components/ComplianceView';
import { WarmTransferModal } from '@/components/WarmTransferModal';

export default function PharmacistCockpitPage() {
  const {
    isConnected,
    summary,
    patients,
    patient,
    selectPatient,
    prescriptions,
    orders,
    sessions,
    consultations,
    billing,
    pharmacyInfo,
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
    handoff,
    dismissHandoff,
    refreshData
  } = useDashboardSocket();

  const [activeView, setActiveView] = useState<ActiveNavView>('CALL_CENTER');
  const [isPhoneModalOpen, setIsPhoneModalOpen] = useState(false);
  const [isBenchmarkModalOpen, setIsBenchmarkModalOpen] = useState(false);
  const [isSnapModalOpen, setIsSnapModalOpen] = useState(false);
  const [isSmsModalOpen, setIsSmsModalOpen] = useState(false);
  const [isSoapModalOpen, setIsSoapModalOpen] = useState(false);

  const queuedOrdersCount = orders.filter((o) => o.status === 'QUEUED_FOR_FILL').length;
  const isCallActive = Boolean(activeSessionId) || activeState !== 'DISCONNECTED';

  const handleDispenseAll = async () => {
    try {
      await apiFetch('/api/orders/dispense-all', { method: 'POST' });
      refreshData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleExportFhir = async () => {
    const ptId = patient?.patient_id || 'PAT-1001';
    try {
      const res = await apiFetch(`/api/export/fhir/${ptId}`);
      const bundle = await res.json();
      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `FHIR_Bundle_${ptId}_${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
    }
  };

  const handleResetDemo = async () => {
    try {
      await apiFetch('/api/reset-demo', { method: 'POST' });
      refreshData();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="h-screen w-screen flex text-slate-100 selection:bg-blue-600/30 selection:text-white font-sans overflow-hidden" style={{ background: '#060c18' }}>
      {/* Left Navigation Sidebar (Full Height 100vh) */}
      <Sidebar
        activeView={activeView}
        onSelectView={setActiveView}
        isCallActive={isCallActive}
        queuedOrdersCount={queuedOrdersCount}
        consultationsCount={consultations.length}
      />

      {/* Main Cockpit Area (Topbar + Workspace Views) */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden min-w-0">
        {/* Top System Header */}
        <Header
          isConnected={isConnected}
          patients={patients}
          selectedPatient={patient}
          onSelectPatient={selectPatient}
          onOpenPhoneModal={() => setIsPhoneModalOpen(true)}
          onOpenBenchmarkModal={() => setIsBenchmarkModalOpen(true)}
          onOpenSnapModal={() => setIsSnapModalOpen(true)}
          onOpenSmsModal={() => setIsSmsModalOpen(true)}
          onOpenSoapModal={() => setIsSoapModalOpen(true)}
          onResetDemo={handleResetDemo}
          activeView={activeView}
        />

        {/* Dynamic Workspace View Container */}
        <main className="flex-1 overflow-y-auto pb-20 relative" style={{ background: '#060c18' }}>
          {activeView === 'CALL_CENTER' && (
            <CallCenterView
              activeSessionId={activeSessionId}
              activeState={activeState}
              isAgentSpeaking={isAgentSpeaking}
              transcript={transcript}
              recentTokens={recentTokens}
              retryCount={retryCount}
              selectedPatient={patient}
              onOpenPhoneModal={() => setIsPhoneModalOpen(true)}
              onOpenSoapModal={() => setIsSoapModalOpen(true)}
            />
          )}

          {activeView === 'DISPENSE_QUEUE' && (
            <DispenseQueueView
              orders={orders}
              onDispenseAll={handleDispenseAll}
              onRefresh={refreshData}
            />
          )}

          {activeView === 'PATIENT_REGISTRY' && (
            <PatientRegistryView
              patients={patients}
              selectedPatient={patient}
              onSelectPatient={selectPatient}
              prescriptions={prescriptions}
              consultations={consultations}
              billing={billing}
              totalCopay={totalCopay}
              pickupSlot={pickupSlot}
              onOpenPhoneModal={() => setIsPhoneModalOpen(true)}
              onRefresh={refreshData}
            />
          )}

          {activeView === 'CONSULTATIONS' && (
            <ConsultationsView
              patients={patients}
              consultations={consultations}
              onRefresh={refreshData}
              onOpenPhoneModal={() => setIsPhoneModalOpen(true)}
            />
          )}

          {activeView === 'BILLING' && (
            <BillingView
              patients={patients}
              selectedPatient={patient}
              onSelectPatient={selectPatient}
              billing={billing}
              prescriptions={prescriptions}
              onRefresh={refreshData}
            />
          )}

          {activeView === 'CLINICAL_AUDITS' && (
            <ClinicalAuditsView
              sessions={sessions}
              orders={orders}
              deaAlert={deaAlert}
              emergencyAlert={emergencyAlert}
              latestAudit={latestAudit}
              onOpenBenchmarkModal={() => setIsBenchmarkModalOpen(true)}
              onExportFhir={handleExportFhir}
              onRefresh={refreshData}
            />
          )}

          {activeView === 'ANALYTICS' && <AnalyticsView />}
          {activeView === 'PRIOR_AUTH' && <PriorAuthView patients={patients} />}
          {activeView === 'IMMUNIZATIONS' && <ImmunizationsView patients={patients} />}
          {activeView === 'OUTREACH' && <OutreachView />}
          {activeView === 'INVENTORY' && <InventoryView />}
          {activeView === 'COMPLIANCE' && <ComplianceView patients={patients} />}

          {activeView === 'VOICE_SETTINGS' && (
            <VoiceSettingsView
              pharmacyInfo={pharmacyInfo}
              onRefresh={refreshData}
            />
          )}
        </main>
      </div>

      {/* Omnipresent Docked Call Bar (visible across views when softphone is minimized during a call) */}
      {!isPhoneModalOpen && (
        <DockedCallBar
          isCallActive={isCallActive}
          activeSessionId={activeSessionId}
          activeState={activeState}
          isAgentSpeaking={isAgentSpeaking}
          patient={patient}
          onOpenPhoneModal={() => setIsPhoneModalOpen(true)}
        />
      )}

      {/* Interactive Softphone Modal */}
      <InteractivePhoneModal
        isOpen={isPhoneModalOpen}
        onClose={() => setIsPhoneModalOpen(false)}
        onRefresh={refreshData}
      />

      {/* AssemblyAI WER Benchmark Modal */}
      <WerBenchmarkModal
        isOpen={isBenchmarkModalOpen}
        onClose={() => setIsBenchmarkModalOpen(false)}
      />

      {/* Snap-to-Verify Mobile Verification Modal */}
      <SnapToVerifyModal
        isOpen={isSnapModalOpen}
        onClose={() => setIsSnapModalOpen(false)}
        patientId={patient?.patient_id}
        patientName={patient ? `${patient.first_name} ${patient.last_name}` : undefined}
      />

      {/* Outbound SMS & 24/7 Drive-Thru Locker Modal */}
      <SmsDispatchModal
        isOpen={isSmsModalOpen}
        onClose={() => setIsSmsModalOpen(false)}
        patientId={patient?.patient_id}
        patientName={patient ? `${patient.first_name} ${patient.last_name}` : 'Patient'}
        patientPhone={patient?.primary_phone || '+1 (415) 555-0192'}
      />

      {/* Warm-transfer screen pop for the pharmacist */}
      <WarmTransferModal
        packet={handoff}
        onClose={dismissHandoff}
        onOpenSoap={() => { dismissHandoff(); setIsSoapModalOpen(true); }}
      />

      {/* Clinical SOAP Note Generator Modal (Epic Cheers / DAX Format) */}
      <SoapNoteModal
        isOpen={isSoapModalOpen}
        onClose={() => setIsSoapModalOpen(false)}
        patientId={patient?.patient_id}
        patientName={patient ? `${patient.first_name} ${patient.last_name}` : 'Patient'}
        sessionId={activeSessionId || handoff?.session_id || undefined}
      />
    </div>
  );
}
