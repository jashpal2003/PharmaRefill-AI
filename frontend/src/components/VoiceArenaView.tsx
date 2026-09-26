'use client';

import React, { useState, useRef } from 'react';
import {
  Phone,
  PhoneOff,
  Zap,
  ShieldCheck,
  AlertTriangle,
  AlertOctagon,
  CheckCircle,
  Globe,
  Radio,
  Send,
  RotateCcw,
  Award,
  Sparkles,
  Sliders,
  Check,
  Volume2,
  Layers,
  Mic,
  Clock,
} from 'lucide-react';
import { VoiceOrb, OrbState } from './VoiceOrb';
import { apiFetch } from '@/lib/api';
import { ComplianceCertificateModal } from './ComplianceCertificateModal';

const SCENARIOS = [
  {
    id: 'happy_refill',
    title: 'Standard Refill + Med-Sync',
    tag: 'Happy Path',
    tagClass: 'tag-success',
    desc: 'Refills Atorvastatin 20mg and synchronizes Metformin & Lisinopril for Friday pickup.',
    text: 'Hello, I am calling to refill my Atorvastatin and synchronize my other maintenance medications for Friday pickup please.',
    icon: CheckCircle,
    iconColor: 'text-emerald-400',
  },
  {
    id: 'phonetic_clarification',
    title: 'Phonetic Smart Repair',
    tag: 'Say Less™',
    tagClass: 'tag-purple',
    desc: 'Ambiguous drug name triggers 1-word confirmation instead of repetitive re-prompts.',
    text: 'I need to get a refill on a tour of statin for my cholesterol.',
    icon: Sparkles,
    iconColor: 'text-violet-400',
  },
  {
    id: 'dea_hard_block',
    title: 'DEA Schedule II Hard Block',
    tag: 'Safety Guardrail',
    tagClass: 'tag-warning',
    desc: 'Oxycodone C-II refill attempt is deterministically blocked and staged for pharmacist review.',
    text: 'I also need to refill my Oxycodone prescription for back pain.',
    icon: AlertTriangle,
    iconColor: 'text-amber-400',
  },
  {
    id: 'emergency_sentinel',
    title: 'Adverse Reaction Sentinel',
    tag: 'Emergency 911',
    tagClass: 'tag-danger',
    desc: 'Caller reports throat swelling; automated triage halts with warm transfer.',
    text: 'Help! My throat feels swollen and tight, I cannot breathe properly!',
    icon: AlertOctagon,
    iconColor: 'text-rose-400',
  },
  {
    id: 'spanish_telephony',
    title: 'Multilingual Spanish STT',
    tag: 'Multilingual',
    tagClass: 'tag-accent',
    desc: 'Conversation in Spanish via AssemblyAI multilingual speech recognition.',
    text: 'Hola, buenas tardes. Necesito renovar mi receta médica por favor.',
    icon: Globe,
    iconColor: 'text-cyan-400',
  },
];

const STACK_LAYERS = [
  { label: 'AssemblyAI Universal-3.5', sub: '16kHz WebSocket + FDA Keyterms', color: 'text-cyan-400', bgColor: 'rgba(6, 182, 212, 0.08)', borderColor: 'rgba(6, 182, 212, 0.2)', icon: Radio },
  { label: 'AssemblyAI LLM Gateway', sub: 'Clinical Intent + Phonetic Repair', color: 'text-violet-400', bgColor: 'rgba(139, 92, 246, 0.08)', borderColor: 'rgba(139, 92, 246, 0.2)', icon: Sparkles },
  { label: 'Cartesia Sonic-2 TTS', sub: 'Sub-150ms voice synthesis', color: 'text-emerald-400', bgColor: 'rgba(16, 185, 129, 0.08)', borderColor: 'rgba(16, 185, 129, 0.2)', icon: Volume2 },
  { label: 'SHA-256 Compliance Cert', sub: 'Title 21 CFR § 1306 · HIPAA', color: 'text-amber-400', bgColor: 'rgba(245, 158, 11, 0.08)', borderColor: 'rgba(245, 158, 11, 0.2)', icon: ShieldCheck },
];

export const VoiceArenaView: React.FC = () => {
  const [activeCall, setActiveCall] = useState(false);
  const [sessionId, setSessionId] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isBargeIn, setIsBargeIn] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [latency, setLatency] = useState({ stt: 138, engine: 14, tts: 260, total: 412 });
  const [transcriptLog, setTranscriptLog] = useState<
    Array<{ speaker: string; text: string; audioBase64?: string; isEscalation?: boolean; phoneticRepair?: any }>
  >([]);
  const [customInput, setCustomInput] = useState('');
  const [certModalOpen, setCertModalOpen] = useState(false);
  const [vadThresholdMs, setVadThresholdMs] = useState(400);
  const [vadMode, setVadMode] = useState<'RAPID_FIRE' | 'BALANCED' | 'ELDERLY_CALLER'>('BALANCED');

  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    setTimeout(() => transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  const handleVadChange = async (newThreshold: number) => {
    const clamped = Math.max(200, Math.min(1000, newThreshold));
    setVadThresholdMs(clamped);
    setVadMode(clamped <= 350 ? 'RAPID_FIRE' : clamped >= 650 ? 'ELDERLY_CALLER' : 'BALANCED');
    try {
      await apiFetch('/api/settings/vad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threshold_ms: clamped }),
      });
    } catch {}
  };

  const stopAudio = () => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current.currentTime = 0;
    }
    setIsPlayingAudio(false);
  };

  const playAudio = (audioBase64?: string) => {
    stopAudio();
    if (audioBase64?.startsWith('data:audio/')) {
      const sound = new Audio(audioBase64);
      audioPlayerRef.current = sound;
      setIsPlayingAudio(true);
      sound.onended = () => setIsPlayingAudio(false);
      sound.onerror = () => setIsPlayingAudio(false);
      sound.play().catch(() => setIsPlayingAudio(false));
    }
  };

  const triggerBargeIn = () => {
    if (!activeCall) return;
    stopAudio();
    setIsBargeIn(true);
    setTranscriptLog((prev) => [
      ...prev,
      { speaker: 'SYSTEM', text: '⚡ Barge-In detected: agent speech halted, caller turn prioritized.' },
    ]);
    scrollToBottom();
    setTimeout(() => setIsBargeIn(false), 2200);
  };

  const startCall = async () => {
    stopAudio();
    const newSession = `DEMO-${Date.now().toString().slice(-6)}`;
    setSessionId(newSession);
    setActiveCall(true);
    setIsProcessing(true);
    setTranscriptLog([]);

    try {
      const res = await apiFetch('/api/call/simulate-step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: newSession,
          caller_phone: '+14155550192',
          utterance: '',
          voice_id: '47c38ca4-5f35-497b-b1a3-415245fb35e1',
        }),
      });
      const data = await res.json();
      if (data.latency_ms) {
        setLatency({
          stt: data.latency_ms.stt || 138,
          engine: data.latency_ms.engine || 12,
          tts: data.latency_ms.tts || 260,
          total: data.latency_ms.total || 410,
        });
      }
      setTranscriptLog([{ speaker: 'AGENT', text: data.spoken_text, audioBase64: data.audio_base64 }]);
      playAudio(data.audio_base64);
      scrollToBottom();
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  const sendUtterance = async (text: string) => {
    if (!text.trim()) return;
    stopAudio();
    setIsProcessing(true);
    setTranscriptLog((prev) => [...prev, { speaker: 'CALLER', text }]);
    scrollToBottom();

    try {
      const res = await apiFetch('/api/call/simulate-step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId || `DEMO-${Date.now().toString().slice(-6)}`,
          caller_phone: '+14155550192',
          utterance: text,
          voice_id: '47c38ca4-5f35-497b-b1a3-415245fb35e1',
        }),
      });
      const data = await res.json();
      if (data.latency_ms) {
        setLatency({
          stt: data.latency_ms.stt || 140,
          engine: data.latency_ms.engine || 15,
          tts: data.latency_ms.tts || 265,
          total: data.latency_ms.total || 420,
        });
      }
      setTranscriptLog((prev) => [
        ...prev,
        {
          speaker: 'AGENT',
          text: data.spoken_text,
          audioBase64: data.audio_base64,
          isEscalation: data.is_escalation,
          phoneticRepair: data.phonetic_repair,
        },
      ]);
      playAudio(data.audio_base64);
      scrollToBottom();
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  const endCall = () => {
    stopAudio();
    setActiveCall(false);
  };

  let orbState: OrbState = 'IDLE';
  if (isBargeIn) orbState = 'BARGE_IN';
  else if (isPlayingAudio) orbState = 'SPEAKING';
  else if (isProcessing) orbState = 'THINKING';
  else if (activeCall) orbState = 'LISTENING';

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
      {/* HERO SECTION */}
      <div className="px-6 pt-6 pb-4">
        <div className="flex items-start justify-between gap-4 mb-1">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">
              <span className="gradient-text-brand">PharmaRefill AI</span>
              <span className="text-[var(--text-secondary)] font-medium text-lg ml-2">Voice Arena</span>
            </h1>
            <p className="text-[13px] text-[var(--text-dim)] mt-1 max-w-xl">
              Interactive voice agent powered by AssemblyAI · Cartesia Sonic-2 · FDA Keyterms Boosting
            </p>
          </div>
          <button
            onClick={() => setCertModalOpen(true)}
            className="btn btn-glass !px-3.5 !py-2 text-xs shrink-0"
          >
            <Award className="h-3.5 w-3.5 text-emerald-400" />
            <span>SHA-256 Certificate</span>
          </button>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 px-6 pb-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 h-full">

          {/* LEFT: Voice Playground (8 cols) */}
          <div className="lg:col-span-8 flex flex-col gap-4">
            {/* Orb + Controls */}
            <div className="bento-card flex flex-col items-center py-8 relative overflow-hidden">
              {/* Ambient glow */}
              <div className="absolute inset-0 pointer-events-none" style={{
                background: 'radial-gradient(ellipse at 50% 30%, rgba(99, 102, 241, 0.06) 0%, transparent 60%)',
              }} />

              <div className="relative z-10">
                <VoiceOrb
                  state={orbState}
                  size="hero"
                  showLabel={true}
                  subtext={activeCall ? `Session: ${sessionId}` : 'Ready for demo'}
                />
              </div>

              {/* Call Controls */}
              <div className="mt-5 flex items-center gap-3 relative z-10">
                {activeCall ? (
                  <>
                    <button onClick={endCall} className="btn btn-danger !px-5">
                      <PhoneOff className="h-4 w-4" />
                      <span>End Call</span>
                    </button>
                    <button onClick={triggerBargeIn} className="btn btn-glass !px-3.5 text-xs">
                      <Zap className="h-3.5 w-3.5 text-amber-400" />
                      <span>Barge-In</span>
                    </button>
                  </>
                ) : (
                  <button onClick={startCall} className="btn btn-primary !px-6 !py-2.5">
                    <Phone className="h-4 w-4" />
                    <span>Start Live Demo</span>
                  </button>
                )}
              </div>

              {/* Latency HUD */}
              <div className="mt-4 flex items-center gap-4 text-[10px] font-mono text-[var(--text-dim)]">
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                  STT {latency.stt}ms
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />
                  Engine {latency.engine}ms
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  TTS {latency.tts}ms
                </span>
                <span className="text-indigo-400 font-bold">= {latency.total}ms</span>
              </div>
            </div>

            {/* Scenarios */}
            <div>
              <div className="flex items-center justify-between mb-2.5 px-1">
                <span className="text-[11px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">Demo Scenarios</span>
                {/* VAD slider inline */}
                <div className="flex items-center gap-2">
                  <Sliders className="h-3 w-3 text-[var(--text-dim)]" />
                  <span className="text-[10px] font-mono text-[var(--text-dim)]">VAD</span>
                  <input
                    type="range" min="200" max="1000" step="50" value={vadThresholdMs}
                    onChange={(e) => handleVadChange(Number(e.target.value))}
                    className="w-20 h-1 accent-indigo-400 cursor-pointer"
                  />
                  <span className="text-[10px] font-mono text-indigo-400 font-bold w-10">{vadThresholdMs}ms</span>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5 stagger-children">
                {SCENARIOS.map((sc) => (
                  <button
                    key={sc.id}
                    onClick={() => {
                      if (!activeCall) startCall();
                      setTimeout(() => sendUtterance(sc.text), activeCall ? 0 : 800);
                    }}
                    className="bento-card bento-card-interactive !p-3.5 text-left flex flex-col gap-2 group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <sc.icon className={`h-3.5 w-3.5 ${sc.iconColor}`} />
                        <span className="font-semibold text-[12px] text-[var(--text-strong)]">{sc.title}</span>
                      </div>
                    </div>
                    <p className="text-[11px] text-[var(--text-dim)] line-clamp-2 leading-relaxed">{sc.desc}</p>
                    <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full ${sc.tagClass} self-start`}>
                      {sc.tag}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Live Transcript */}
            <div className="bento-card flex flex-col flex-1 min-h-[200px]">
              <div className="flex items-center justify-between pb-3 mb-3" style={{ borderBottom: '1px solid var(--glass-border)' }}>
                <div className="flex items-center gap-2">
                  <Radio className={`h-3.5 w-3.5 ${activeCall ? 'text-emerald-400 animate-pulse' : 'text-[var(--text-dim)]'}`} />
                  <span className="text-xs font-semibold text-[var(--text-strong)]">Live Transcript</span>
                </div>
                {activeCall && (
                  <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Recording
                  </span>
                )}
              </div>

              <div className="flex-1 overflow-y-auto space-y-2.5 transcript-scroll min-h-0 max-h-[300px]">
                {transcriptLog.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-[var(--text-dim)]">
                    <Mic className="h-8 w-8 mb-2 opacity-30" />
                    <p className="text-xs">Click "Start Live Demo" or pick a scenario</p>
                  </div>
                ) : (
                  transcriptLog.map((log, i) => (
                    <div
                      key={i}
                      className={`animate-slide-up ${
                        log.speaker === 'CALLER'
                          ? 'transcript-bubble-patient ml-6'
                          : log.speaker === 'SYSTEM'
                          ? 'text-center text-[10px] font-mono text-amber-400/80 py-1'
                          : log.isEscalation
                          ? 'transcript-bubble-agent mr-6 !border-rose-500/30 !bg-rose-500/5'
                          : 'transcript-bubble-agent mr-6'
                      }`}
                    >
                      {log.speaker !== 'SYSTEM' && (
                        <div className="flex items-center justify-between text-[10px] text-[var(--text-dim)] mb-1">
                          <span className="font-semibold">
                            {log.speaker === 'CALLER' ? '👤 Caller' : '🤖 PharmaRefill AI'}
                          </span>
                          {log.audioBase64 && (
                            <button
                              onClick={() => playAudio(log.audioBase64)}
                              className="text-indigo-400 hover:text-indigo-300 font-mono flex items-center gap-1 cursor-pointer"
                            >
                              <Volume2 className="h-2.5 w-2.5" />
                              Play
                            </button>
                          )}
                        </div>
                      )}
                      <p className="text-xs leading-relaxed">{log.text}</p>

                      {log.phoneticRepair && (
                        <div className="mt-2 p-2 rounded-lg flex items-center justify-between gap-2" style={{
                          background: 'rgba(139, 92, 246, 0.08)',
                          border: '1px solid rgba(139, 92, 246, 0.25)',
                        }}>
                          <div className="flex items-center gap-1.5 text-[11px] text-violet-300">
                            <Sparkles className="h-3.5 w-3.5 text-violet-400" />
                            <span>
                              Match: <strong>{log.phoneticRepair.target_drug}</strong> ({Math.round(log.phoneticRepair.confidence * 100)}%)
                            </span>
                          </div>
                          <button
                            onClick={() => sendUtterance('Yes, confirm that medication please')}
                            className="px-2 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-1 cursor-pointer transition"
                            style={{ background: 'rgba(139, 92, 246, 0.3)', color: '#C4B5FD' }}
                          >
                            <Check className="h-3 w-3" />
                            Confirm
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
                <div ref={transcriptEndRef} />
              </div>

              {/* Input */}
              {activeCall && (
                <div className="mt-3 flex items-center gap-2" style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '12px' }}>
                  <input
                    value={customInput}
                    onChange={(e) => setCustomInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && customInput.trim()) {
                        sendUtterance(customInput.trim());
                        setCustomInput('');
                      }
                    }}
                    placeholder="Type what the caller says…"
                    className="field flex-1 !text-xs !py-2"
                  />
                  <button
                    onClick={() => {
                      if (customInput.trim()) {
                        sendUtterance(customInput.trim());
                        setCustomInput('');
                      }
                    }}
                    disabled={!customInput.trim() || isProcessing}
                    className="btn btn-primary !py-2 !px-3"
                  >
                    <Send className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: Stack + Info (4 cols) */}
          <div className="lg:col-span-4 flex flex-col gap-4">
            {/* Voice AI Stack */}
            <div className="bento-card">
              <div className="flex items-center gap-2 mb-4">
                <Layers className="h-4 w-4 text-indigo-400" />
                <span className="text-sm font-bold text-[var(--text-strong)]">Voice AI Stack</span>
              </div>
              <div className="space-y-2.5 stagger-children">
                {STACK_LAYERS.map((layer) => (
                  <div
                    key={layer.label}
                    className="flex items-center gap-3 p-3 rounded-xl transition-all"
                    style={{ background: layer.bgColor, border: `1px solid ${layer.borderColor}` }}
                  >
                    <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: layer.bgColor }}>
                      <layer.icon className={`h-4 w-4 ${layer.color}`} />
                    </div>
                    <div className="min-w-0">
                      <div className={`text-xs font-semibold ${layer.color}`}>{layer.label}</div>
                      <div className="text-[10px] text-[var(--text-dim)] mt-0.5">{layer.sub}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="bento-card !p-4 text-center">
                <Clock className="h-4 w-4 text-indigo-400 mx-auto mb-2" />
                <div className="stat-value text-lg">{latency.total}ms</div>
                <div className="stat-label mt-1">E2E Latency</div>
              </div>
              <div className="bento-card !p-4 text-center">
                <Sliders className="h-4 w-4 text-cyan-400 mx-auto mb-2" />
                <div className="text-lg font-extrabold text-cyan-400">{vadThresholdMs}ms</div>
                <div className="stat-label mt-1">VAD Threshold</div>
              </div>
            </div>

            {/* VAD Presets */}
            <div className="bento-card !p-4">
              <span className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider block mb-2.5">Turn Detection</span>
              <div className="space-y-1.5">
                {[
                  { label: '⚡ Rapid-Fire', ms: 300, mode: 'RAPID_FIRE' as const },
                  { label: '🎯 Balanced', ms: 450, mode: 'BALANCED' as const },
                  { label: '👴 Elderly', ms: 700, mode: 'ELDERLY_CALLER' as const },
                ].map((p) => (
                  <button
                    key={p.mode}
                    onClick={() => handleVadChange(p.ms)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition cursor-pointer ${
                      vadMode === p.mode
                        ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30'
                        : 'text-[var(--text-dim)] hover:text-[var(--text-body)] hover:bg-[var(--surface-1)] border border-transparent'
                    }`}
                  >
                    {p.label} ({p.ms}ms)
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <ComplianceCertificateModal
        isOpen={certModalOpen}
        onClose={() => setCertModalOpen(false)}
        sessionId={sessionId || 'DEMO-001'}
      />
    </div>
  );
};
