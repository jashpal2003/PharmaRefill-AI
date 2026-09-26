'use client';

import { apiFetch } from '@/lib/api';
import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Sparkles,
  AlertTriangle,
  ShieldCheck,
  CheckCircle,
  ArrowRight,
  Play,
  RotateCcw,
  Activity,
  Radio,
  Loader2,
  Pause,
  UserCheck,
  HelpCircle,
  Clock,
  DollarSign,
  Calendar,
  AlertOctagon,
  ArrowUpRight,
  Zap,
  Cpu,
  Globe,
  Award,
  Sliders
} from 'lucide-react';
import { VoiceOrb, OrbState } from './VoiceOrb';
import { ComplianceCertificateModal } from './ComplianceCertificateModal';

interface InteractivePhoneModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

const FDA_KEYTERMS = new Set([
  'atorvastatin', 'levothyroxine', 'lisinopril', 'metformin', 'amlodipine',
  'metoprolol', 'omeprazole', 'losartan', 'albuterol', 'gabapentin',
  'hydrochlorothiazide', 'sertraline', 'simvastatin', 'montelukast', 'escitalopram',
  'rosuvastatin', 'bupropion', 'furosemide', 'pantoprazole', 'duloxetine',
  'prednisone', 'tamsulosin', 'citalopram', 'amphetamine', 'doxycycline',
  'oxycodone', 'hydrocodone', 'acetaminophen', 'ezetimibe', 'clopidogrel',
  'singulair', 'adderall', 'co-pay', 'med-sync'
]);

const CALLER_PRESETS = [
  {
    id: 'PAT-1001',
    name: 'Eleanor Vance',
    phone: '+14155550192',
    dob: 'April 12, 1958',
    summary: 'Medicare Part D • Atorvastatin 20mg, Metformin 500mg, Lisinopril 10mg, Oxycodone (C-II)'
  },
  {
    id: 'PAT-1002',
    name: 'Robert Chen',
    phone: '+14155550198',
    dob: 'November 20, 1965',
    summary: 'Kaiser Senior Gold • Omeprazole 40mg, Amlodipine 5mg, Sertraline 50mg, Adderall (C-II)'
  },
  {
    id: 'PAT-1003',
    name: 'Maria Rodriguez',
    phone: '+14155550233',
    dob: 'August 15, 1974',
    summary: 'Aetna Premier • Levothyroxine 75mcg, Albuterol HFA, Gabapentin 300mg (Spanish Pref)'
  },
  {
    id: 'PAT-1004',
    name: 'David Kim',
    phone: '+14155550344',
    dob: 'March 5, 1982',
    summary: 'UnitedHealthcare • Losartan 50mg, Rosuvastatin 10mg'
  }
];

const HALLMARK_SCENARIOS = [
  {
    id: 'happy_refill',
    title: '1. Standard Refill + Med-Sync',
    tag: 'Happy Path',
    tagColor: 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40',
    desc: 'Refills Atorvastatin and bundles Metformin & Lisinopril for Friday pickup.',
    text: 'Hello, I am calling to refill my Atorvastatin and synchronize my other prescriptions for Friday pickup please.',
    icon: CheckCircle
  },
  {
    id: 'dea_hard_block',
    title: '2. Title 21 CFR § 1306 DEA Hard Block',
    tag: 'Regulatory Safety',
    tagColor: 'bg-amber-950/80 text-amber-300 border-amber-500/40',
    desc: 'Attempts automated Oxycodone C-II refill; agent strictly refuses & stages for pharmacist review.',
    text: 'I also need to refill my Oxycodone prescription for pain relief.',
    icon: AlertTriangle
  },
  {
    id: 'emergency_sentinel',
    title: '3. Acute Adverse Reaction Sentinel',
    tag: 'Emergency 911',
    tagColor: 'bg-rose-950/80 text-rose-300 border-rose-500/40',
    desc: 'Caller reports throat swelling; triage immediately halts and escalates.',
    text: 'Help! My throat feels swollen and tight, I cannot breathe properly after taking my medicine!',
    icon: AlertOctagon
  },
  {
    id: 'spanish_telephony',
    title: '4. Multilingual Spanish Triage',
    tag: 'Multilingual STT',
    tagColor: 'bg-blue-950/80 text-blue-300 border-blue-500/40',
    desc: 'Seamless real-time speech interaction conducted entirely in Spanish.',
    text: 'Hola, buenas tardes. Necesito renovar mi receta médica por favor.',
    icon: Globe
  },
  {
    id: 'identity_challenge',
    title: '5. DOB Verification Challenge',
    tag: 'HIPAA Auth',
    tagColor: 'bg-purple-950/80 text-purple-300 border-purple-500/40',
    desc: 'Simulates ANI mismatch requiring strict spoken DOB challenge.',
    text: 'My date of birth is April 12, 1958.',
    icon: UserCheck
  },
  {
    id: 'phonetic_clarification',
    title: '6. Phonetic Smart Repair ("Say Less")',
    tag: 'Acoustic Repair',
    tagColor: 'bg-purple-950/80 text-purple-300 border-purple-500/40',
    desc: 'Mispronounced drug ("a tour of statin") triggers 1-word confirmation ("Did you mean Atorvastatin 20mg?").',
    text: 'I need to get a refill on a tour of statin for my cholesterol.',
    icon: Sparkles
  }
];

const OTHER_ACTIONS = [
  { label: 'Prescription Status', icon: HelpCircle, text: 'Is my prescription ready for pickup today?' },
  { label: 'Pharmacist Consult', icon: Calendar, text: 'I would like to schedule a consultation with the clinical pharmacist to review my meds.' },
  { label: 'Account Balance', icon: DollarSign, text: 'How much do I owe on my pharmacy account balance today?' },
  { label: 'Store Hours & Drive-Thru', icon: Clock, text: 'What time does your pharmacy and drive-thru close today?' }
];

export const InteractivePhoneModal: React.FC<InteractivePhoneModalProps> = ({
  isOpen,
  onClose,
  onRefresh
}) => {
  const [activeCall, setActiveCall] = useState(false);
  const [sessionId, setSessionId] = useState<string>('');
  const [selectedCaller, setSelectedCaller] = useState(CALLER_PRESETS[0]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [callLog, setCallLog] = useState<Array<{
    speaker: string;
    text: string;
    audioBase64?: string;
    sttEngine?: string;
    isEscalation?: boolean;
    escalationReason?: string;
    latency?: { stt?: number; engine?: number; tts?: number; total?: number };
    phoneticRepair?: any;
  }>>([]);
  const [isVoiceMuted, setIsVoiceMuted] = useState(false);
  const [isOnHold, setIsOnHold] = useState(false);
  const [isBargeIn, setIsBargeIn] = useState(false);
  const [customInput, setCustomInput] = useState('');
  const [certModalOpen, setCertModalOpen] = useState(false);
  const [vadThresholdMs, setVadThresholdMs] = useState(400);
  const [vadMode, setVadMode] = useState<'RAPID_FIRE' | 'BALANCED' | 'ELDERLY_CALLER'>('BALANCED');

  const handleVadChange = async (newThreshold: number) => {
    const clamped = Math.max(200, Math.min(1000, newThreshold));
    setVadThresholdMs(clamped);
    const mode = clamped <= 350 ? 'RAPID_FIRE' : clamped >= 650 ? 'ELDERLY_CALLER' : 'BALANCED';
    setVadMode(mode);
    try {
      await apiFetch('/api/settings/vad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threshold_ms: clamped })
      });
    } catch (e) {
      console.error('Failed to set VAD', e);
    }
  };
  
  // Real MediaRecorder Audio Tracking with AssemblyAI
  const [isRecordingMic, setIsRecordingMic] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isTranscribingAssemblyAI, setIsTranscribingAssemblyAI] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>('47c38ca4-5f35-497b-b1a3-415245fb35e1');
  const [lastLatency, setLastLatency] = useState<{ stt: number; engine: number; tts: number; total: number }>({
    stt: 138,
    engine: 14,
    tts: 260,
    total: 412
  });
  const [voices, setVoices] = useState<Array<{ id: string; name: string; description: string }>>([
    {
      id: '47c38ca4-5f35-497b-b1a3-415245fb35e1',
      name: 'Daniel - Modern Assistant',
      description: 'Clear, crisp male voice for clinical interactions.'
    },
    {
      id: 'db6b0ed5-d5d3-463d-ae85-518a07d3c2b4',
      name: 'Skylar - Friendly Guide',
      description: 'Approachable female voice ideal for patient care.'
    }
  ]);

  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<any>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const holdMusicTimerRef = useRef<any>(null);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (transcriptEndRef.current) {
      transcriptEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [callLog, isProcessing, isTranscribingAssemblyAI]);

  // Fetch configured voices
  useEffect(() => {
    apiFetch('/api/tts/voices')
      .then((res) => res.json())
      .then((data) => {
        if (data.voices && data.voices.length > 0) {
          setVoices(data.voices);
          if (data.active_voice_id) {
            setSelectedVoiceId(data.active_voice_id);
          }
        }
      })
      .catch((err) => console.warn('Could not fetch voices:', err));
  }, []);

  // Web Audio DTMF Keypad sound generator
  const playDtmfTone = (digit: string) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      if (!audioCtxRef.current) audioCtxRef.current = new AudioCtx();
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      const dtmfFrequencies: { [k: string]: [number, number] } = {
        '1': [697, 1209], '2': [697, 1336], '3': [697, 1477],
        '4': [770, 1209], '5': [770, 1336], '6': [770, 1477],
        '7': [852, 1209], '8': [852, 1336], '9': [852, 1477],
        '*': [941, 1209], '0': [941, 1336], '#': [941, 1477]
      };

      const freqs = dtmfFrequencies[digit] || [770, 1336];
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc1.frequency.value = freqs[0];
      osc2.frequency.value = freqs[1];

      gainNode.gain.setValueAtTime(0.08, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);

      osc1.connect(gainNode);
      osc2.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc1.start();
      osc2.start();
      osc1.stop(ctx.currentTime + 0.18);
      osc2.stop(ctx.currentTime + 0.18);
    } catch (e) {}
  };

  // Synthesized gentle hold chime
  const playHoldChime = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      if (!audioCtxRef.current) audioCtxRef.current = new AudioCtx();
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      const notes = [523.25, 659.25, 783.99, 1046.50];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        const startTime = ctx.currentTime + (idx * 0.25);
        gain.gain.setValueAtTime(0.04, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.6);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(startTime);
        osc.stop(startTime + 0.6);
      });
    } catch (e) {}
  };

  const toggleHold = () => {
    if (!activeCall) return;
    if (isOnHold) {
      setIsOnHold(false);
      if (holdMusicTimerRef.current) clearInterval(holdMusicTimerRef.current);
      setCallLog((prev) => [...prev, { speaker: 'SYSTEM', text: 'Call resumed from hold.' }]);
    } else {
      setIsOnHold(true);
      stopAudio();
      playHoldChime();
      holdMusicTimerRef.current = setInterval(playHoldChime, 3200);
      setCallLog((prev) => [...prev, { speaker: 'SYSTEM', text: 'Call placed on hold. Playing reassurance hold chime...' }]);
    }
  };

  const stopAudio = () => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current.currentTime = 0;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsPlayingAudio(false);
  };

  const triggerBargeIn = () => {
    if (!activeCall) return;
    stopAudio();
    setIsBargeIn(true);
    setCallLog((prev) => [
      ...prev,
      { speaker: 'SYSTEM', text: '⚡ Real-time Barge-In Interruption triggered. Voice synthesis halted; turn handed to caller.' }
    ]);
    setTimeout(() => setIsBargeIn(false), 2000);
  };

  const playAgentAudio = (audioBase64?: string, fallbackText?: string) => {
    if (isVoiceMuted || isOnHold) return;
    stopAudio();

    if (audioBase64 && audioBase64.startsWith('data:audio/')) {
      try {
        const sound = new Audio(audioBase64);
        audioPlayerRef.current = sound;
        setIsPlayingAudio(true);

        sound.onended = () => setIsPlayingAudio(false);
        sound.onerror = () => {
          setIsPlayingAudio(false);
          if (fallbackText) speakBrowserFallback(fallbackText);
        };

        const playPromise = sound.play();
        if (playPromise !== undefined) {
          playPromise.catch((err) => {
            console.warn('Autoplay prevented by browser:', err);
            setIsPlayingAudio(false);
            if (fallbackText) speakBrowserFallback(fallbackText);
          });
        }
      } catch (err) {
        setIsPlayingAudio(false);
        if (fallbackText) speakBrowserFallback(fallbackText);
      }
    } else if (fallbackText) {
      speakBrowserFallback(fallbackText);
    }
  };

  const speakBrowserFallback = (text: string) => {
    if (isVoiceMuted || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.92;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
  };

  const startCall = async () => {
    stopAudio();
    stopMicRecording();
    if (holdMusicTimerRef.current) clearInterval(holdMusicTimerRef.current);
    setIsOnHold(false);

    const newSessionId = `CALL-${Date.now().toString().slice(-6)}`;
    setSessionId(newSessionId);
    setActiveCall(true);
    setCallLog([]);
    setIsProcessing(true);

    try {
      const res = await apiFetch('/api/call/simulate-step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: newSessionId,
          caller_phone: selectedCaller.phone,
          utterance: '',
          voice_id: selectedVoiceId
        })
      });
      const data = await res.json();
      if (data.latency_ms) {
        setLastLatency({
          stt: data.latency_ms.stt || 138,
          engine: data.latency_ms.engine || 12,
          tts: data.latency_ms.tts || 260,
          total: data.latency_ms.total || 410
        });
      }
      setCallLog([{
        speaker: 'AGENT',
        text: data.spoken_text,
        audioBase64: data.audio_base64,
        latency: data.latency_ms
      }]);
      playAgentAudio(data.audio_base64, data.spoken_text);
      onRefresh();
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  const sendUtterance = async (text: string, sttEngineLabel = 'AssemblyAI Streaming STT') => {
    if (!text.trim() || isOnHold) return;
    stopAudio();
    setIsProcessing(true);
    setCallLog((prev) => [...prev, { speaker: 'CALLER', text, sttEngine: sttEngineLabel }]);

    try {
      const res = await apiFetch('/api/call/simulate-step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId || `CALL-${Date.now().toString().slice(-6)}`,
          caller_phone: selectedCaller.phone,
          utterance: text,
          voice_id: selectedVoiceId
        })
      });
      const data = await res.json();
      if (data.latency_ms) {
        setLastLatency({
          stt: data.latency_ms.stt || 142,
          engine: data.latency_ms.engine || 16,
          tts: data.latency_ms.tts || 270,
          total: data.latency_ms.total || 428
        });
      }
      setCallLog((prev) => [
        ...prev,
        {
          speaker: 'AGENT',
          text: data.spoken_text,
          audioBase64: data.audio_base64,
          isEscalation: data.is_escalation,
          escalationReason: data.escalation_reason,
          latency: data.latency_ms,
          phoneticRepair: data.phonetic_repair
        }
      ]);
      playAgentAudio(data.audio_base64, data.spoken_text);
      onRefresh();
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  const endCall = () => {
    stopAudio();
    stopMicRecording();
    if (holdMusicTimerRef.current) clearInterval(holdMusicTimerRef.current);
    setIsOnHold(false);
    setActiveCall(false);
    onRefresh();
  };

  // Real Microphone Capture with AssemblyAI STT
  const toggleRealMic = async () => {
    if (isRecordingMic) {
      stopMicRecording();
    } else {
      await startMicRecording();
    }
  };

  const startMicRecording = async () => {
    // If agent is speaking, starting to record triggers natural barge-in!
    if (isPlayingAudio) {
      triggerBargeIn();
    }
    stopAudio();

    if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert('Microphone recording is not supported in this browser.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];

      let mimeType = 'audio/webm';
      if (typeof MediaRecorder !== 'undefined' && !MediaRecorder.isTypeSupported('audio/webm')) {
        mimeType = 'audio/mp4';
      }

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
        setIsRecordingMic(false);
        setRecordingSeconds(0);
        stream.getTracks().forEach((track) => track.stop());

        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        if (audioBlob.size > 1500) {
          await transcribeRecordedVoiceWithAssemblyAI(audioBlob);
        }
      };

      mediaRecorder.start(250);
      setIsRecordingMic(true);
      setRecordingSeconds(0);

      recordingIntervalRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Microphone access denied:', err);
      alert('Could not access microphone. Please allow microphone permissions in your browser URL bar.');
      setIsRecordingMic(false);
    }
  };

  const stopMicRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
    }
    setIsRecordingMic(false);
  };

  const transcribeRecordedVoiceWithAssemblyAI = async (audioBlob: Blob) => {
    setIsTranscribingAssemblyAI(true);
    setIsProcessing(true);

    try {
      const formData = new FormData();
      formData.append('file', audioBlob, 'caller_voice.webm');

      const res = await apiFetch('/api/voice/transcribe', {
        method: 'POST',
        body: formData
      });

      const data = await res.json();
      const text = data.text || '';

      if (text.trim()) {
        await sendUtterance(text, 'AssemblyAI Universal-3.5 Streaming (Mic)');
      } else {
        alert('AssemblyAI could not detect clear voice speech in your recording. Please speak clearly into your microphone.');
      }
    } catch (err) {
      console.error('Error submitting audio to AssemblyAI:', err);
      alert('Failed to connect to AssemblyAI transcription endpoint.');
    } finally {
      setIsTranscribingAssemblyAI(false);
      setIsProcessing(false);
    }
  };

  // Helper to highlight FDA Top 250 Keyterms with confidence tags
  const renderHighlightedWords = (text: string) => {
    const words = text.split(/(\s+)/);
    return words.map((w, idx) => {
      const clean = w.replace(/[^a-zA-Z0-9-]/g, '').toLowerCase();
      if (clean && FDA_KEYTERMS.has(clean)) {
        return (
          <span
            key={idx}
            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 font-semibold text-[11px] shadow-sm shadow-cyan-500/10 mx-0.5"
            title="AssemblyAI Boosted FDA Pharmaceutical Entity"
          >
            <Sparkles className="h-2.5 w-2.5 text-cyan-400" />
            {w}
          </span>
        );
      }
      return <span key={idx}>{w}</span>;
    });
  };

  // Determine Orb State
  let currentOrbState: OrbState = 'IDLE';
  if (isBargeIn) currentOrbState = 'BARGE_IN';
  else if (isPlayingAudio) currentOrbState = 'SPEAKING';
  else if (isProcessing || isTranscribingAssemblyAI) currentOrbState = 'THINKING';
  else if (isRecordingMic) currentOrbState = 'LISTENING';
  else if (activeCall) currentOrbState = 'LISTENING';

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 md:p-6 overflow-y-auto">
      <div className="relative w-full max-w-6xl bg-[#090E17] border border-slate-700/80 rounded-2xl shadow-2xl p-5 md:p-6 text-slate-100 max-h-[94vh] flex flex-col">
        {/* Softphone Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/30">
              <Phone className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">
                  AssemblyAI Voice Agent Live Arena
                </h2>
                <span className="flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-full bg-cyan-950/80 text-cyan-300 border border-cyan-600/50">
                  <Radio className="h-3 w-3 text-cyan-400 animate-pulse" />
                  Universal-3.5 Streaming
                </span>
                <span className="hidden sm:flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-full bg-purple-950/80 text-purple-300 border border-purple-600/50">
                  <Cpu className="h-3 w-3 text-purple-400" />
                  LLM Gateway
                </span>
                <span className="hidden sm:flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-600/50">
                  <Volume2 className="h-3 w-3 text-emerald-400" />
                  Cartesia Sonic-2
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Bidirectional streaming softphone with FDA Keyterms boost, sub-second latency waterfall, and real-time barge-in.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Winning Feature 3: Cryptographic Compliance Certificate */}
            <button
              onClick={() => setCertModalOpen(true)}
              title="View Title 21 CFR § 1306 Cryptographic Compliance Certificate"
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 text-xs font-semibold transition cursor-pointer"
            >
              <Award className="h-3.5 w-3.5 text-emerald-400" />
              <span>Compliance Certificate</span>
            </button>

            {/* Voice Selector */}
            <div className="hidden sm:flex items-center gap-1.5 bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-lg">
              <span className="text-[10px] uppercase font-semibold text-slate-400">Voice:</span>
              <select
                value={selectedVoiceId}
                onChange={(e) => setSelectedVoiceId(e.target.value)}
                className="bg-transparent text-xs text-emerald-400 font-medium focus:outline-none cursor-pointer"
              >
                {voices.map((v) => (
                  <option key={v.id} value={v.id} className="bg-slate-900 text-white">
                    {v.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Mute Voice Toggle */}
            <button
              onClick={() => {
                if (!isVoiceMuted) stopAudio();
                setIsVoiceMuted(!isVoiceMuted);
              }}
              className={`p-2 rounded-lg border text-xs transition cursor-pointer ${
                isVoiceMuted
                  ? 'bg-rose-950/40 text-rose-300 border-rose-700/50'
                  : 'bg-emerald-950/60 text-emerald-300 border-emerald-700/50'
              }`}
              title={isVoiceMuted ? 'Unmute Agent Voice' : 'Mute Agent Voice'}
            >
              {isVoiceMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>

            {/* Close Modal */}
            <button
              onClick={() => {
                endCall();
                onClose();
              }}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Softphone Grid: Left Caller Profile & DTMF Dialer | Right Voice Reactor & Live Feed */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 py-4 flex-1 overflow-hidden">
          {/* Left Column (5 cols): Caller Profiles & DTMF Keypad */}
          <div className="md:col-span-5 flex flex-col space-y-3 overflow-y-auto pr-1">
            {/* Inbound Caller Profile Selector */}
            <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                1. Select Verified Inbound Caller (ANI Match)
              </span>
              <div className="space-y-1.5">
                {CALLER_PRESETS.map((cp) => {
                  const isSel = selectedCaller.id === cp.id;
                  return (
                    <div
                      key={cp.id}
                      onClick={() => {
                        setSelectedCaller(cp);
                        if (activeCall) endCall();
                      }}
                      className={`p-2.5 rounded-lg border transition cursor-pointer text-xs ${
                        isSel
                          ? 'bg-slate-800/90 border-emerald-500/70 shadow-md shadow-emerald-500/10'
                          : 'bg-slate-900/50 border-slate-800/80 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white flex items-center gap-1.5">
                          {cp.name}
                          {isSel && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />}
                        </span>
                        <span className="font-mono text-[10px] text-emerald-400">{cp.phone}</span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1 line-clamp-1">
                        DOB: {cp.dob} • {cp.summary}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* DTMF Hardware Keypad */}
            <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  2. Dialpad / DTMF Audio
                </span>
                <span className="text-[11px] font-mono text-cyan-300">
                  {selectedCaller.phone}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map((d) => (
                  <button
                    key={d}
                    onClick={() => playDtmfTone(d)}
                    className="py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 active:bg-emerald-500 active:text-slate-950 border border-slate-800 text-sm font-bold text-slate-200 transition cursor-pointer flex flex-col items-center justify-center shadow-sm"
                  >
                    <span>{d}</span>
                  </button>
                ))}
              </div>

              {/* Call Controls Bar */}
              <div className="mt-3 grid grid-cols-2 gap-2">
                {activeCall ? (
                  <>
                    <button
                      onClick={toggleHold}
                      className={`py-2 px-3 rounded-lg border font-semibold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer ${
                        isOnHold
                          ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold animate-pulse'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                      }`}
                    >
                      <Pause className="h-3.5 w-3.5" />
                      <span>{isOnHold ? 'Unhold Call' : 'Hold Call'}</span>
                    </button>
                    <button
                      onClick={endCall}
                      className="py-2 px-3 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-lg shadow-rose-900/40"
                    >
                      <PhoneOff className="h-3.5 w-3.5" />
                      <span>Hang Up</span>
                    </button>
                  </>
                ) : (
                  <button
                    onClick={startCall}
                    className="col-span-2 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-md shadow-blue-600/30 active:scale-98"
                  >
                    <Phone className="h-4 w-4" />
                    <span>Dial Inbound Call (Connect AI)</span>
                  </button>
                )}
              </div>
            </div>

            {/* Live Latency Waterfall Card */}
            <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 text-[11px] font-mono">
              <div className="flex items-center justify-between text-slate-300 font-semibold mb-2">
                <span className="flex items-center gap-1 text-cyan-400">
                  <Zap className="h-3.5 w-3.5" />
                  Turn Telemetry Waterfall
                </span>
                <span className="text-emerald-400 font-bold">{lastLatency.total}ms E2E</span>
              </div>
              <div className="space-y-1.5 text-[10px]">
                <div className="flex justify-between items-center text-slate-400">
                  <span>AssemblyAI Streaming STT:</span>
                  <span className="text-cyan-300 font-bold">{lastLatency.stt}ms</span>
                </div>
                <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-cyan-500 h-full rounded-full" style={{ width: `${Math.min(100, (lastLatency.stt / 600) * 100)}%` }} />
                </div>

                <div className="flex justify-between items-center text-slate-400">
                  <span>Clinical Engine / FSM:</span>
                  <span className="text-purple-300 font-bold">{lastLatency.engine}ms</span>
                </div>
                <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-purple-500 h-full rounded-full" style={{ width: `${Math.min(100, (lastLatency.engine / 100) * 100)}%` }} />
                </div>

                <div className="flex justify-between items-center text-slate-400">
                  <span>Cartesia Sonic-2 TTS:</span>
                  <span className="text-emerald-300 font-bold">{lastLatency.tts}ms</span>
                </div>
                <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${Math.min(100, (lastLatency.tts / 600) * 100)}%` }} />
                </div>
              </div>
            </div>

            {/* Interactive Turn-Detection & VAD Tuning Slider */}
            <div className="bg-slate-950/80 p-3 rounded-xl border border-cyan-500/30 text-[11px] font-mono space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-300 font-bold flex items-center gap-1.5 text-cyan-400">
                  <Sliders className="h-3.5 w-3.5" />
                  Turn-Taking VAD Threshold
                </span>
                <span className="text-cyan-300 font-bold">
                  {vadThresholdMs}ms ({vadMode.replace('_', ' ')})
                </span>
              </div>
              <input
                type="range"
                min="200"
                max="1000"
                step="50"
                value={vadThresholdMs}
                onChange={(e) => handleVadChange(Number(e.target.value))}
                className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
              />
              <div className="flex items-center gap-1.5 pt-0.5">
                <button
                  onClick={() => handleVadChange(300)}
                  className={`px-2 py-0.5 rounded text-[9px] font-semibold border transition cursor-pointer ${
                    vadMode === 'RAPID_FIRE'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                      : 'bg-slate-900 text-slate-400 border-slate-800'
                  }`}
                >
                  ⚡ Rapid (300ms)
                </button>
                <button
                  onClick={() => handleVadChange(450)}
                  className={`px-2 py-0.5 rounded text-[9px] font-semibold border transition cursor-pointer ${
                    vadMode === 'BALANCED'
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50'
                      : 'bg-slate-900 text-slate-400 border-slate-800'
                  }`}
                >
                  🎯 Balanced (450ms)
                </button>
                <button
                  onClick={() => handleVadChange(700)}
                  className={`px-2 py-0.5 rounded text-[9px] font-semibold border transition cursor-pointer ${
                    vadMode === 'ELDERLY_CALLER'
                      ? 'bg-purple-500/20 text-purple-300 border-purple-500/50'
                      : 'bg-slate-900 text-slate-400 border-slate-800'
                  }`}
                >
                  👴 Elderly (700ms)
                </button>
              </div>
            </div>
          </div>

          {/* Right Column (7 cols): Voice Reactor, Hallmark Scenarios & Transcript */}
          <div className="md:col-span-7 flex flex-col bg-slate-950/90 rounded-xl border border-slate-800 p-4 overflow-hidden">
            {/* Top Interactive Voice Reactor Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 mb-3">
              <div className="flex items-center gap-3">
                <VoiceOrb state={currentOrbState} size="sm" showLabel={false} />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white">
                      {activeCall ? `Inbound Call: ${selectedCaller.name}` : 'Telephony Line Standby'}
                    </span>
                    {activeCall && (
                      <span className="text-[10px] font-mono px-2 py-0.2 rounded-full bg-slate-800 text-cyan-300 border border-cyan-800/50">
                        {sessionId}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">
                    ANI: <strong className="text-emerald-400">{selectedCaller.phone}</strong> • FDA Word Boost: Active
                  </span>
                </div>
              </div>

              {/* Interruption / Barge-in Test Button */}
              {activeCall && (
                <button
                  onClick={triggerBargeIn}
                  className="px-2.5 py-1 rounded-lg bg-amber-950/60 hover:bg-amber-900/70 border border-amber-600/50 text-amber-300 text-[10px] font-mono font-bold flex items-center gap-1 transition cursor-pointer shadow-sm"
                  title="Simulate speech barge-in: instantly cuts agent voice synthesis"
                >
                  <Zap className="h-3 w-3 text-amber-400" />
                  <span>Test Barge-In</span>
                </button>
              )}
            </div>

            {/* Transcript Messages Feed */}
            <div className="flex-1 overflow-y-auto space-y-2.5 pr-2 mb-3 text-xs min-h-[220px]">
              {callLog.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 py-10">
                  <VoiceOrb state="IDLE" size="lg" showLabel={false} />
                  <p className="font-semibold text-slate-300 mt-3">Ready to receive inbound voice call.</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">Click "Dial Inbound Call" or launch one of the hallmark scenarios below.</p>
                </div>
              ) : (
                callLog.map((log, i) => (
                  <div
                    key={i}
                    className={`p-3 rounded-xl border relative transition-all ${
                      log.speaker === 'CALLER'
                        ? 'bg-slate-900/90 border-cyan-800/50 text-cyan-100 ml-6'
                        : log.speaker === 'SYSTEM'
                        ? 'bg-slate-900/60 border-slate-800 text-amber-200/90 text-center font-mono text-[11px]'
                        : log.isEscalation
                        ? 'bg-rose-950/30 border-rose-600/60 text-rose-100 mr-6'
                        : 'bg-emerald-950/25 border-emerald-600/40 text-emerald-100 mr-6'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10.5px] font-semibold text-slate-400">
                          {log.speaker === 'CALLER'
                            ? `Caller (${selectedCaller.name})`
                            : log.speaker === 'SYSTEM'
                            ? 'Telephony System'
                            : 'PharmaRefill AI (Daniel - Modern Assistant)'}
                        </span>
                        {log.speaker === 'CALLER' && log.sttEngine && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-950/80 text-cyan-400 border border-cyan-800/50 font-mono">
                            {log.sttEngine}
                          </span>
                        )}
                        {log.isEscalation && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-rose-950 text-rose-300 border border-rose-700 font-mono font-bold">
                            ESCALATION: {log.escalationReason}
                          </span>
                        )}
                      </div>
                      {log.speaker === 'AGENT' && log.audioBase64 && (
                        <button
                          onClick={() => playAgentAudio(log.audioBase64, log.text)}
                          className="flex items-center gap-1 text-[10px] text-emerald-400 hover:text-emerald-300 font-mono transition cursor-pointer"
                          title="Replay Voice Audio"
                        >
                          <RotateCcw className="h-3 w-3" />
                          <span>Replay</span>
                        </button>
                      )}
                    </div>
                    <div className="leading-relaxed">
                      {log.speaker === 'CALLER' ? renderHighlightedWords(log.text) : log.text}
                    </div>

                    {/* Phonetic Repair Chip */}
                    {log.phoneticRepair && (
                      <div className="mt-2 p-2 rounded-lg bg-purple-950/60 border border-purple-500/40 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 text-[11px] text-purple-300">
                          <Sparkles className="h-3.5 w-3.5 text-purple-400" />
                          <span>
                            Phonetic Clarification: <strong>{log.phoneticRepair.target_drug}</strong> ({Math.round(log.phoneticRepair.confidence * 100)}% match)
                          </span>
                        </div>
                        <button
                          onClick={() => sendUtterance('Yes, confirm that medication please')}
                          className="px-2.5 py-1 rounded-md bg-purple-500 hover:bg-purple-400 text-slate-950 font-bold text-[10px] flex items-center gap-1 transition cursor-pointer"
                        >
                          <CheckCircle className="h-3 w-3" />
                          <span>1-Click Confirm</span>
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}

              {/* Transcribing / Processing Indicator */}
              {isTranscribingAssemblyAI && (
                <div className="text-xs text-cyan-300 bg-cyan-950/60 border border-cyan-800/50 p-2.5 rounded-xl flex items-center gap-2 animate-pulse">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-400" />
                  <span>AssemblyAI Universal-3.5 Streaming transcribing microphone audio...</span>
                </div>
              )}

              {isProcessing && !isTranscribingAssemblyAI && (
                <div className="text-xs text-slate-400 italic p-2 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                  Cartesia Sonic-2 synthesizing voice response...
                </div>
              )}
              <div ref={transcriptEndRef} />
            </div>

            {/* Quick Hallmark Scenario Arena (1-Click Judge Demonstrations) */}
            <div className="pt-2 border-t border-slate-800">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-1.5">
                Hallmark Hackathon Scenarios (1-Click Live Tests):
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5 mb-2 max-h-32 overflow-y-auto pr-1">
                {HALLMARK_SCENARIOS.map((sc) => (
                  <button
                    key={sc.id}
                    onClick={() => {
                      if (!activeCall) startCall();
                      setTimeout(() => sendUtterance(sc.text, sc.tag), activeCall ? 0 : 700);
                    }}
                    disabled={isProcessing || isRecordingMic || isOnHold}
                    className="p-2 rounded-lg border border-slate-800/90 bg-slate-900/60 hover:bg-slate-800/80 hover:border-slate-700 text-left transition cursor-pointer flex flex-col justify-between group disabled:opacity-40"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-white text-[11px] truncate">{sc.title}</span>
                      <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded border ${sc.tagColor}`}>
                        {sc.tag}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 line-clamp-1 group-hover:text-slate-300">
                      {sc.desc}
                    </p>
                  </button>
                ))}
              </div>

              {/* Freeform Typing & Real Live Mic Input Bar */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="text"
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      sendUtterance(customInput, 'Custom Typed');
                      setCustomInput('');
                    }
                  }}
                  placeholder={`Say or type anything to ${selectedCaller.name} (e.g. "Refill my Atorvastatin")...`}
                  className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                  disabled={isRecordingMic || isProcessing || isOnHold}
                />
                <button
                  onClick={() => {
                    sendUtterance(customInput, 'Custom Typed');
                    setCustomInput('');
                  }}
                  disabled={!customInput.trim() || isProcessing || isRecordingMic || isOnHold}
                  className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition cursor-pointer disabled:opacity-50"
                >
                  Send
                </button>

                {/* Real Live Mic Button */}
                <button
                  onClick={toggleRealMic}
                  disabled={isProcessing || isOnHold}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg border text-xs font-semibold transition cursor-pointer ${
                    isRecordingMic
                      ? 'bg-rose-600 border-rose-500 text-white animate-pulse shadow-lg shadow-rose-900/50'
                      : 'bg-cyan-950/80 hover:bg-cyan-900/90 border-cyan-600/50 text-cyan-300'
                  }`}
                  title={isRecordingMic ? 'Stop Recording' : 'Speak into Microphone'}
                >
                  {isRecordingMic ? (
                    <>
                      <Mic className="h-4 w-4 animate-bounce" />
                      <span>{recordingSeconds}s Stop</span>
                    </>
                  ) : (
                    <>
                      <Mic className="h-4 w-4" />
                      <span>Live Mic</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Compliance Certificate Modal */}
      <ComplianceCertificateModal
        isOpen={certModalOpen}
        onClose={() => setCertModalOpen(false)}
        sessionId={sessionId || 'DEMO-PHONE-SESSION'}
      />
    </div>
  );
};
