'use client';

import React, { useState } from 'react';
import { Sidebar, ActiveNavView } from '@/components/Sidebar';
import { VoiceArenaView } from '@/components/VoiceArenaView';
import { CommandCenterView } from '@/components/CommandCenterView';
import { PatientView } from '@/components/PatientView';
import { useDashboardSocket } from '@/hooks/useDashboardSocket';
import { AuthGate } from '@/components/AuthGate';
import { FeedbackProvider } from '@/components/feedback';

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
    refreshData,
  } = useDashboardSocket();

  const [activeView, setActiveView] = useState<ActiveNavView>('VOICE_ARENA');

  const isCallActive =
    Boolean(activeSessionId) &&
    !['IDLE', 'DISCONNECTED', 'CALL_COMPLETED'].includes(activeState);

  return (
    <div
      className="h-screen w-screen flex overflow-hidden"
      style={{
        background: 'var(--bg-void)',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      {/* Ambient Mesh Background */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{ backgroundImage: 'var(--gradient-mesh)' }}
      />

      {/* Sidebar */}
      <Sidebar
        activeView={activeView}
        onSelectView={setActiveView}
        isCallActive={isCallActive}
        isConnected={isConnected}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 relative z-10">
        {activeView === 'VOICE_ARENA' && <VoiceArenaView />}

        {activeView === 'COMMAND_CENTER' && (
          <CommandCenterView
            isConnected={isConnected}
            summary={summary}
            orders={orders}
            sessions={sessions}
            patients={patients}
            onRefresh={refreshData}
            onNavigate={(view) => setActiveView(view as ActiveNavView)}
          />
        )}

        {activeView === 'PATIENTS' && (
          <PatientView
            patients={patients}
            selectedPatient={patient}
            onSelectPatient={selectPatient}
            prescriptions={prescriptions}
            consultations={consultations}
            billing={billing}
            totalCopay={totalCopay}
            pickupSlot={pickupSlot}
          />
        )}
      </main>
    </div>
  );
}
