'use client';

import { apiFetch, wsUrl } from '@/lib/api';

import { useEffect, useState, useRef, useCallback } from 'react';
import {
  Patient,
  Prescription,
  DispenseOrder,
  CallSession,
  DashboardSummary,
  TranscriptMessage,
  LeMURAudit,
  TokenItem,
  Consultation,
  BillingAccount,
  PharmacyInfo
} from '@/lib/types';

export type {
  Patient,
  Prescription,
  DispenseOrder,
  CallSession,
  DashboardSummary,
  TranscriptMessage,
  LeMURAudit,
  TokenItem,
  Consultation,
  BillingAccount,
  PharmacyInfo
};

export function useDashboardSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [orders, setOrders] = useState<DispenseOrder[]>([]);
  const [sessions, setSessions] = useState<CallSession[]>([]);
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [billing, setBilling] = useState<BillingAccount | null>(null);
  const [pharmacyInfo, setPharmacyInfo] = useState<PharmacyInfo>({});
  
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [activeState, setActiveState] = useState<string>('IDLE');
  const [isAgentSpeaking, setIsAgentSpeaking] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptMessage[]>([]);
  const [recentTokens, setRecentTokens] = useState<TokenItem[]>([]);
  const [deaAlert, setDeaAlert] = useState<{ active: boolean; medication?: any; reason?: string }>({ active: false });
  const [emergencyAlert, setEmergencyAlert] = useState<{ active: boolean; warning?: string }>({ active: false });
  const [latestAudit, setLatestAudit] = useState<LeMURAudit | null>(null);
  const [handoff, setHandoff] = useState<any | null>(null);
  const [role, setRole] = useState<string>('');
  const [retryCount, setRetryCount] = useState<number>(0);
  const [totalCopay, setTotalCopay] = useState<number>(0);
  const [pickupSlot, setPickupSlot] = useState<string | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const patientIdRef = useRef<string | undefined>(undefined);
  const unmountedRef = useRef(false);
  patientIdRef.current = patient?.patient_id;

  const connect = useCallback(() => {
    const url = wsUrl('/ws/dashboard');

    try {
      const ws = new WebSocket(url);
      socketRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          const { type, data } = msg;

          switch (type) {
            case 'INITIAL_SNAPSHOT':
              if (data.summary) setSummary(data.summary);
              if (data.patients) setPatients(data.patients);
              if (data.patient) setPatient(data.patient);
              if (data.prescriptions) setPrescriptions(data.prescriptions);
              if (data.orders) setOrders(data.orders);
              if (data.sessions) setSessions(data.sessions);
              if (data.consultations) setConsultations(data.consultations);
              if (data.billing) setBilling(data.billing);
              if (data.pharmacy_info) setPharmacyInfo(data.pharmacy_info);
              if (data.role) setRole(data.role);
              break;

            case 'CALL_STARTED':
              setActiveSessionId(data.session_id);
              setActiveState('AUTHENTICATION');
              if (data.patient) setPatient(data.patient);
              setTranscript([{
                id: `sys-${Date.now()}`,
                speaker: 'SYSTEM',
                text: `Inbound Call connected from ${data.caller_phone}. Telemetry ANI match: ${data.ani_matched ? `${data.patient?.first_name} ${data.patient?.last_name} (${data.patient?.patient_id})` : 'New Caller / Unmatched'}`,
                timestamp: 'Now'
              }]);
              setDeaAlert({ active: false });
              setEmergencyAlert({ active: false });
              setRetryCount(0);
              break;

            case 'TRANSCRIPT_UPDATE':
              if (data.tokens) setRecentTokens(data.tokens);
              setIsAgentSpeaking(false);
              if (data.text) {
                setTranscript((prev) => {
                  const last = prev[prev.length - 1];
                  if (last && last.speaker === 'CALLER' && last.text.trim() === data.text.trim()) {
                    return prev;
                  }
                  return [
                    ...prev,
                    {
                      id: `caller-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                      speaker: 'CALLER',
                      text: data.text,
                      timestamp: 'Just now',
                      tokens: data.tokens,
                      confidence: data.confidence
                    }
                  ];
                });
              }
              break;

            case 'AGENT_SPEAKING':
              setIsAgentSpeaking(true);
              setActiveState(data.current_state || 'RESPONDING');
              if (data.total_copay) setTotalCopay(data.total_copay);
              if (data.patient) setPatient(data.patient);
              if (data.spoken_text) {
                setTranscript((prev) => {
                  const last = prev[prev.length - 1];
                  if (last && last.speaker === 'AGENT' && last.text.trim() === data.spoken_text.trim()) {
                    return prev;
                  }
                  return [
                    ...prev,
                    {
                      id: `agent-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                      speaker: 'AGENT',
                      text: data.spoken_text,
                      timestamp: 'Just now',
                      isEscalation: data.is_escalation,
                      audioBase64: data.audio_base64
                    }
                  ];
                });
              }
              break;

            case 'DEA_BLOCK_ALERT':
              setDeaAlert({
                active: true,
                medication: data.medication,
                reason: data.reason
              });
              break;

            case 'EMERGENCY_ALERT':
              setEmergencyAlert({
                active: true,
                warning: data.warning
              });
              break;

            case 'LEMUR_AUDIT_COMPLETED':
            case 'LEMUR_AUDIT_READY':
              if (data?.audit) {
                setLatestAudit(data.audit);
              } else if (data) {
                setLatestAudit(data);
              }
              break;

            case 'CONSULTATION_SCHEDULED':
              setConsultations((prev) => [data, ...prev]);
              break;

            case 'BILLING_PAYMENT_PROCESSED':
              if (data?.res && patientIdRef.current === data.patient_id) {
                setBilling((prev) => prev ? { ...prev, outstanding_balance: data.res.remaining_balance } : null);
              }
              break;

            case 'DEMO_STATE_RESET':
              setTranscript([]);
              setDeaAlert({ active: false });
              setEmergencyAlert({ active: false });
              setLatestAudit(null);
              setActiveSessionId(null);
              setActiveState('IDLE');
              break;

            case 'WARM_TRANSFER_CONTEXT':
              setHandoff(data);
              break;

            case 'DISPENSE_QUEUE_UPDATED':
              apiFetch(`/api/orders`)
                .then((r) => r.json())
                .then((d) => setOrders(d))
                .catch(() => {});
              break;
          }
        } catch (e) {
          console.error('Error parsing dashboard socket frame:', e);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        // Reconnect only after an unexpected drop (not on unmount), picking up a refreshed token.
        if (!unmountedRef.current) reconnectTimeoutRef.current = setTimeout(connect, 3000);
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch (e) {
      console.error('WebSocket connection initialization error:', e);
    }
  }, []);

  useEffect(() => {
    unmountedRef.current = false;
    connect();
    return () => {
      unmountedRef.current = true;
      if (socketRef.current) socketRef.current.close();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    };
  }, [connect]);

  const selectPatient = async (patientId: string) => {
    try {
      const res = await apiFetch(`/api/patient/${patientId}`);
      if (res.ok) {
        const data = await res.json();
        setPatient(data.patient);
        setPrescriptions(data.prescriptions || []);
        setBilling(data.billing || null);
        setConsultations(data.consultations || []);
      }
    } catch (e) {
      console.warn('Could not select patient:', e);
    }
  };

  const refreshData = async () => {
    const currentPtId = patient?.patient_id || 'PAT-1001';
    try {
      const [sumRes, ptsRes, ptRes, ordRes, sessRes, consRes] = await Promise.all([
        apiFetch(`/api/dashboard`),
        apiFetch(`/api/patients`),
        apiFetch(`/api/patient/${currentPtId}`),
        apiFetch(`/api/orders`),
        apiFetch(`/api/sessions`),
        apiFetch(`/api/consultations`)
      ]);
      const sum = await sumRes.json();
      const pts = await ptsRes.json();
      const pt = await ptRes.json();
      const ord = await ordRes.json();
      const sess = await sessRes.json();
      const cons = await consRes.json();

      setSummary(sum);
      setPatients(pts);
      if (pt.patient) setPatient(pt.patient);
      if (pt.prescriptions) setPrescriptions(pt.prescriptions);
      if (pt.billing) setBilling(pt.billing);
      setOrders(ord);
      setSessions(sess);
      setConsultations(cons);
    } catch (e) {
      console.warn('Refresh data failed:', e);
    }
  };

  return {
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
    handoff,
    dismissHandoff: () => setHandoff(null),
    role,
    retryCount,
    totalCopay,
    pickupSlot,
    refreshData
  };
}
