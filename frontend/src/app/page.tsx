'use client';

import { apiFetch, apiJson } from '@/lib/api';
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
import { AuthGate } from '@/components/AuthGate';
import { FeedbackProvider, friendlyError, useFeedback } from '@/components/feedback';

export default function Page() {
  return (
    <AuthGate>
      <FeedbackProvider>
        <PharmacistCockpit />
      </FeedbackProvider>
    </AuthGate>
  );
}

function PharmacistCockpit() {
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
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [isPhoneModalOpen, setIsPhoneModalOpen] = useState(false);
  const [isBenchmarkModalOpen, setIsBenchmarkModalOpen] = useState(false);
  const [isSnapModalOpen, setIsSnapModalOpen] = useState(false);
  const [isSmsModalOpen, setIsSmsModalOpen] = useState(false);
  const [isSoapModalOpen, setIsSoapModalOpen] = useState(false);

  const queuedOrdersCount = orders.filter((o) => o.status === 'QUEUED_FOR_FILL').length;
  // A call is live only while a session exists and hasn't ended. ("IDLE" used to count as live.)
  const isCallActive = Boolean(activeSessionId) && !['IDLE', 'DISCONNECTED', 'CALL_COMPLETED'].includes(activeState);
  const { toast } = useFeedback();

  const handleDispenseAll = async () => {
    try {
      const r = await apiJson<{ dispensed: number }>('/api/orders/dispense-all', { method: 'POST' });
      toast(r.dispensed ? `Dispensed ${r.dispensed} order${r.dispensed > 1 ? 's' : ''}. Refill counts and fill history updated.` : 'Nothing was queued for fill.', r.dispensed ? 'success' : 'info');
      refreshData();
    } catch (e) {
      toast(friendlyError(e), 'error');
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
      toast(`FHIR R4 bundle for ${ptId} downloaded.`);
    } catch (e) {
      toast(friendlyError(e), 'error');
    }
  };

  const handleResetDemo = async () => {
    try {
      await apiJson('/api/reset-demo', { method: 'POST' });
      toast('Demo data reset to the original seed.');
      refreshData();
    } catch (e) {
      toast(friendlyError(e), 'error');
    }
  };

  return (
    <div className="h-screen w-screen flex font-sans overflow-hidden text-body" style={{ background: 'var(--bg-main)' }}>
      {/* Left Navigation Sidebar (Full Height 100vh) */}
      <Sidebar
        activeView={activeView}
        onSelectView={setActiveView}
        isCallActive={isCallActive}
        isConnected={isConnected}
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
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
          onNavigate={setActiveView}
          onOpenMobileNav={() => setMobileNavOpen(true)}
          activeView={activeView}
        />

        {/* Dynamic Workspace View Container */}
        <main className="flex-1 overflow-y-auto pb-20 relative" style={{ background: 'var(--bg-main)' }}>
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
