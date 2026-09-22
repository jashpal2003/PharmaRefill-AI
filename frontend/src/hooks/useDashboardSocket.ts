'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import {
  Patient,
  Prescription,
  DispenseOrder,
  CallSession,
  DashboardSummary,
  TranscriptMessage,
  LeMURAudit,
  TokenItem
} from '@/lib/types';

export function useDashboardSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [orders, setOrders] = useState<DispenseOrder[]>([]);
  const [sessions, setSessions] = useState<CallSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [activeState, setActiveState] = useState<string>('IDLE');
  const [isAgentSpeaking, setIsAgentSpeaking] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptMessage[]>([]);
  const [recentTokens, setRecentTokens] = useState<TokenItem[]>([]);
  const [deaAlert, setDeaAlert] = useState<{ active: boolean; medication?: any; reason?: string }>({ active: false });
  const [emergencyAlert, setEmergencyAlert] = useState<{ active: boolean; warning?: string }>({ active: false });
  const [latestAudit, setLatestAudit] = useState<LeMURAudit | null>(null);
  const [retryCount, setRetryCount] = useState<number>(0);
  const [totalCopay, setTotalCopay] = useState<number>(0);
  const [pickupSlot, setPickupSlot] = useState<string | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    const protocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = typeof window !== 'undefined' ? window.location.hostname : '127.0.0.1';
    const port = '8000';
    const url = `${protocol}//${host}:${port}/ws/dashboard`;

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
              if (data.patient) setPatient(data.patient);
              if (data.prescriptions) setPrescriptions(data.prescriptions);
              if (data.orders) setOrders(data.orders);
              if (data.sessions) setSessions(data.sessions);
              break;

            case 'CALL_STARTED':
              setActiveSessionId(data.session_id);
              setActiveState('CONSENT_DISCLOSURE');
              setTranscript([{
                id: `sys-${Date.now()}`,
                speaker: 'SYSTEM',
                text: `Inbound Call connected from ${data.caller_phone}. Telemetry ANI match: ${data.ani_matched ? 'Eleanor Vance (PAT-1001)' : 'Unrecognized'}`,
                timestamp: 'Now'
              }]);
              setDeaAlert({ active: false });
              setEmergencyAlert({ active: false });
              setRetryCount(0);
              break;

            case 'TRANSCRIPT_UPDATE':
              if (data.tokens) setRecentTokens(data.tokens);
              setIsAgentSpeaking(false);
              setTranscript((prev) => [
                ...prev,
                {
                  id: `caller-${Date.now()}`,
                  speaker: 'CALLER',
                  text: data.text,
                  timestamp: 'Now',
                  tokens: data.tokens,
                  confidence: data.confidence
                }
              ]);
              break;

            case 'AGENT_SPEAKING':
              setIsAgentSpeaking(true);
              setActiveState(data.current_state || 'RESPONDING');
              if (data.total_copay) setTotalCopay(data.total_copay);
              if (data.spoken_text) {
                setTranscript((prev) => [
                  ...prev,
                  {
                    id: `agent-${Date.now()}`,
                    speaker: 'AGENT',
                    text: data.spoken_text,
                    timestamp: 'Now',
                    isEscalation: data.is_escalation
                  }
                ]);
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
              if (data.audit) {
                setLatestAudit(data.audit);
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

            case 'DISPENSE_QUEUE_UPDATED':
              // Trigger reload of orders
              fetch(`http://${host}:${port}/api/orders`)
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
        reconnectTimeoutRef.current = setTimeout(connect, 3000);
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch (e) {
      console.error('WebSocket connection initialization error:', e);
    }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (socketRef.current) socketRef.current.close();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    };
  }, [connect]);

  const refreshData = async () => {
    const host = typeof window !== 'undefined' ? window.location.hostname : '127.0.0.1';
    try {
      const [sumRes, ptRes, ordRes, sessRes] = await Promise.all([
        fetch(`http://${host}:8000/api/dashboard`),
        fetch(`http://${host}:8000/api/patient/PAT-1001`),
        fetch(`http://${host}:8000/api/orders`),
        fetch(`http://${host}:8000/api/sessions`)
      ]);
      const sum = await sumRes.json();
      const pt = await ptRes.json();
      const ord = await ordRes.json();
      const sess = await sessRes.json();

      setSummary(sum);
      if (pt.patient) setPatient(pt.patient);
      if (pt.prescriptions) setPrescriptions(pt.prescriptions);
      setOrders(ord);
      setSessions(sess);
    } catch (e) {
      console.warn('Refresh data failed:', e);
    }
  };

  return {
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
  };
}
