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
  ArrowUpRight
} from 'lucide-react';

interface InteractivePhoneModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

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
    summary: 'Aetna Premier • Levothyroxine 75mcg, Albuterol HFA, Gabapentin 300mg'
  },
  {
    id: 'PAT-1004',
    name: 'David Kim',
    phone: '+14155550344',
    dob: 'March 5, 1982',
    summary: 'UnitedHealthcare • Losartan 50mg, Rosuvastatin 10mg'
  }
];

const QUICK_ACTIONS = [
  {
    label: 'Standard Refill',
    icon: CheckCircle,
    color: 'hover:border-blue-500/50 hover:bg-blue-950/30 text-slate-200',
    text: 'Hello, I am calling to refill my prescription.'
  },
  {
    label: 'Refill + Med-Sync',
    icon: Clock,
    color: 'hover:border-blue-500/50 hover:bg-blue-950/30 text-slate-200',
    text: 'Yes please synchronize all my maintenance prescriptions for Friday pickup!'
  },
  {
    label: 'Prescription Status',
    icon: HelpCircle,
    color: 'hover:border-slate-600 hover:bg-slate-800/60 text-slate-300',
    text: 'Is my prescription ready for pickup today?'
  },
  {
    label: 'Pharmacist Consult',
    icon: Calendar,
    color: 'hover:border-slate-600 hover:bg-slate-800/60 text-slate-300',
    text: 'I would like to schedule a consultation with the clinical pharmacist to review my meds.'
  },
  {
    label: 'Billing & Copay',
    icon: DollarSign,
    color: 'hover:border-slate-600 hover:bg-slate-800/60 text-slate-300',
    text: 'How much do I owe on my pharmacy account balance today?'
  },
  {
    label: 'DEA Schedule II Test',
    icon: AlertTriangle,
    color: 'hover:border-amber-500/50 hover:bg-amber-950/30 text-amber-300',
    text: 'I also need to refill my Oxycodone prescription for pain relief.'
  },
  {
    label: 'Emergency Sentinel',
    icon: AlertOctagon,
    color: 'hover:border-rose-500/50 hover:bg-rose-950/30 text-rose-300',
    text: 'Help! My throat feels swollen and tight, I cannot breathe properly!'
  },
  {
    label: 'Hours & FAQ',
    icon: HelpCircle,
    color: 'hover:border-slate-600 hover:bg-slate-800/60 text-slate-300',
    text: 'What time does your pharmacy and drive-thru close today?'
  },
  {
    label: 'Transfer to Staff',
    icon: ArrowUpRight,
    color: 'hover:border-slate-500 hover:bg-slate-800 text-slate-300',
    text: 'Can I speak to the on-duty pharmacist directly please?'
  }
];

export const InteractivePhoneModal: React.FC<InteractivePhoneModalProps> = ({
  isOpen,
  onClose,
  onRefresh
}) => {
  const [activeCall, setActiveCall] = useState(false);
  const [sessionId, setSessionId] = useState<string>('');
  const [selectedCaller, setSelectedCaller] = useState(CALLER_PRESETS[0]);
  const [customPhone, setCustomPhone] = useState('+1 (415) 555-0192');
  const [isProcessing, setIsProcessing] = useState(false);
  const [callLog, setCallLog] = useState<Array<{ speaker: string; text: string; audioBase64?: string; sttEngine?: string; isEscalation?: boolean }>>([]);
  const [isVoiceMuted, setIsVoiceMuted] = useState(false);
  const [isOnHold, setIsOnHold] = useState(false);
  const [customInput, setCustomInput] = useState('');
  
  // Real MediaRecorder Audio Tracking with AssemblyAI
  const [isRecordingMic, setIsRecordingMic] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isTranscribingAssemblyAI, setIsTranscribingAssemblyAI] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>('47c38ca4-5f35-497b-b1a3-415245fb35e1');
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
    },
    {
      id: '9626c31c-bec5-4cca-baa8-f8ba9e84c8bc',
      name: 'Jacqueline - Reassuring Agent',
      description: 'Empathetic healthcare reassurance voice.'
    },
    {
      id: '694f9389-aac1-45b6-b726-9d9369183238',
      name: 'Sarah - Mindful Woman',
      description: 'Calm, gentle tone designed to comfort elderly callers.'
    }
  ]);

  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<any>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const holdMusicTimerRef = useRef<any>(null);

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
    } catch (e) {
      // AudioContext unavailable
    }
  };

  // Synthesized gentle hold chime
  const playHoldChime = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      if (!audioCtxRef.current) audioCtxRef.current = new AudioCtx();
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
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
      holdMusicTimerRef.current = setInterval(playHoldChime, 3000);
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
      setCallLog([{ speaker: 'AGENT', text: data.spoken_text, audioBase64: data.audio_base64 }]);
      playAgentAudio(data.audio_base64, data.spoken_text);
      onRefresh();
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  const sendUtterance = async (text: string, sttEngineLabel = 'Scenario Quick Action') => {
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
      setCallLog((prev) => [
        ...prev,
        {
          speaker: 'AGENT',
          text: data.spoken_text,
          audioBase64: data.audio_base64,
          isEscalation: data.is_escalation
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
        await sendUtterance(text, 'AssemblyAI Universal STT (Live Mic)');
      } else {
        alert('AssemblyAI could not detect voice speech in your recording. Please speak clearly into your microphone.');
      }
    } catch (err) {
      console.error('Error submitting audio to AssemblyAI:', err);
      alert('Failed to connect to AssemblyAI transcription endpoint.');
    } finally {
      setIsTranscribingAssemblyAI(false);
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 overflow-y-auto">
      <div className="relative w-full max-w-5xl bg-[#0F172A] border border-slate-700/80 rounded-2xl shadow-2xl p-6 text-slate-100 max-h-[92vh] flex flex-col">
        {/* Softphone Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 shadow-md">
              <Phone className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">
                  PharmaRefill AI Voice Softphone Suite
                </h2>
                <span className="flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700/60">
                  <Sparkles className="h-3 w-3 text-blue-400" />
                  Cartesia Sonic-2 Live
                </span>
                <span className="flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700/60">
                  <Radio className="h-3 w-3 text-slate-400" />
                  AssemblyAI Live STT
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Interactive bidirectional phone simulator with DTMF keypad, live microphone, and multi-intent triage.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Cartesia Voice Picker */}
            <div className="flex items-center gap-1.5 bg-slate-950/80 border border-slate-800 px-2.5 py-1 rounded-lg">
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

        {/* Softphone Grid: Left Phone Dial & Profiles, Right Live Call Feed */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 py-4 flex-1 overflow-hidden">
          {/* Left Column (5 cols): Caller Profile & DTMF Dialer */}
          <div className="md:col-span-5 flex flex-col space-y-3 overflow-y-auto pr-1">
            {/* Caller Identity Selector */}
            <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                1. Select Simulated Inbound Caller
              </span>
              <div className="space-y-1.5">
                {CALLER_PRESETS.map((cp) => {
                  const isSel = selectedCaller.id === cp.id;
                  return (
                    <div
                      key={cp.id}
                      onClick={() => {
                        setSelectedCaller(cp);
                        setCustomPhone(cp.phone);
                        if (activeCall) endCall();
                      }}
                      className={`p-2.5 rounded-lg border transition cursor-pointer text-xs ${
                        isSel
                          ? 'bg-slate-800/90 border-emerald-500/70 shadow-sm shadow-emerald-500/20'
                          : 'bg-slate-900/50 border-slate-800/80 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white">{cp.name}</span>
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
                    className="py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 active:bg-emerald-500 active:text-slate-950 border border-slate-800 text-sm font-bold text-slate-200 transition cursor-pointer flex flex-col items-center justify-center"
                  >
                    <span>{d}</span>
                  </button>
                ))}
              </div>

              {/* Call Control Button */}
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
                    className="col-span-2 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-md shadow-blue-600/20"
                  >
                    <Phone className="h-4 w-4" />
                    <span>Dial Inbound Call (Connect AI)</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Right Column (7 cols): Live Call Monitor, Actions & Transcript */}
          <div className="md:col-span-7 flex flex-col bg-slate-950/90 rounded-xl border border-slate-800 p-4 overflow-hidden">
            {/* Call Status & Telemetry Bar */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 mb-3">
              <div className="flex items-center gap-2">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    isOnHold
                      ? 'bg-amber-400 animate-ping'
                      : activeCall
                      ? 'bg-emerald-400 animate-pulse'
                      : 'bg-slate-600'
                  }`}
                />
                <span className="text-xs font-mono text-slate-200">
                  {isOnHold
                    ? `[ON HOLD] ${selectedCaller.name} (${sessionId})`
                    : activeCall
                    ? `Connected: ${selectedCaller.name} (${sessionId})`
                    : 'Telephony Line Standby'}
                </span>

                {isPlayingAudio && !isOnHold && (
                  <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-mono">
                    <Activity className="h-3 w-3 animate-pulse text-emerald-400" />
                    <span>Cartesia Sonic-2 Speaking...</span>
                  </div>
                )}
              </div>

              <div className="text-[11px] font-mono text-slate-400">
                ANI: <span className="text-emerald-400">{selectedCaller.phone}</span>
              </div>
            </div>

            {/* Live Message History Feed */}
            <div className="flex-1 overflow-y-auto space-y-2.5 pr-2 mb-3 text-xs">
              {callLog.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 py-12">
                  <Play className="h-8 w-8 mb-2 opacity-40 text-emerald-400" />
                  <p className="font-medium text-slate-400">Click "Dial Inbound Call" or choose a scenario below to start.</p>
                  <p className="text-[11px] text-slate-500 mt-1">Speak via your microphone or use one-click natural actions.</p>
                </div>
              ) : (
                callLog.map((log, i) => (
                  <div
                    key={i}
                    className={`p-3 rounded-xl border relative transition-all ${
                      log.speaker === 'CALLER'
                        ? 'bg-slate-900 border-slate-700 text-cyan-100 ml-6'
                        : log.speaker === 'SYSTEM'
                        ? 'bg-slate-900/60 border-slate-800 text-amber-200/90 text-center font-mono text-[11px]'
                        : log.isEscalation
                        ? 'bg-rose-950/30 border-rose-600/50 text-rose-100 mr-6'
                        : 'bg-emerald-950/25 border-emerald-600/40 text-emerald-100 mr-6'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-semibold text-slate-400">
                          {log.speaker === 'CALLER'
                            ? `Caller (${selectedCaller.name})`
                            : log.speaker === 'SYSTEM'
                            ? 'Telephony System'
                            : 'PharmaRefill AI (Daniel - Modern Assistant)'}
                        </span>
                        {log.speaker === 'CALLER' && log.sttEngine && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-950/60 text-cyan-400 border border-cyan-800/40 font-mono">
                            {log.sttEngine}
                          </span>
                        )}
                      </div>
                      {log.speaker === 'AGENT' && log.audioBase64 && (
                        <button
                          onClick={() => playAgentAudio(log.audioBase64, log.text)}
                          className="flex items-center gap-1 text-[10px] text-emerald-400 hover:text-emerald-300 font-mono transition cursor-pointer"
                          title="Replay Cartesia Voice Audio"
                        >
                          <RotateCcw className="h-3 w-3" />
                          <span>Replay</span>
                        </button>
                      )}
                    </div>
                    <p className="leading-relaxed">{log.text}</p>
                  </div>
                ))
              )}

              {/* Transcribing / Processing Indicator */}
              {isTranscribingAssemblyAI && (
                <div className="text-xs text-cyan-300 bg-cyan-950/40 border border-cyan-800/50 p-2.5 rounded-xl flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-400" />
                  <span>AssemblyAI is transcribing your microphone audio with FDA Word Boost...</span>
                </div>
              )}

              {isProcessing && !isTranscribingAssemblyAI && (
                <div className="text-xs text-slate-400 italic p-2 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                  Cartesia Sonic-2 synthesizing voice response...
                </div>
              )}
            </div>

            {/* Quick Action Chips & Real Mic Controls */}
            {activeCall ? (
              <div className="pt-3 border-t border-slate-800 space-y-2.5">
                {/* Active Live Microphone Banner */}
                {isRecordingMic && (
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-rose-950/80 border border-rose-500/60 text-rose-200 animate-pulse">
                    <div className="flex items-center gap-2 text-xs font-semibold">
                      <span className="h-2.5 w-2.5 rounded-full bg-rose-500 animate-ping" />
                      <span>Listening live... Speak clearly ({recordingSeconds}s)</span>
                    </div>
                    <button
                      onClick={stopMicRecording}
                      className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold transition cursor-pointer shadow-md"
                    >
                      Done & Transcribe (AssemblyAI)
                    </button>
                  </div>
                )}

                {/* Quick Natural Intent Chips */}
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-1.5">
                    Click Any Natural Voice Scenario:
                  </span>
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                    {QUICK_ACTIONS.map((qa, idx) => (
                      <button
                        key={idx}
                        onClick={() => sendUtterance(qa.text, qa.label)}
                        disabled={isProcessing || isRecordingMic || isOnHold}
                        className={`px-2.5 py-1 rounded-lg border border-slate-800 bg-slate-900/80 text-[11px] font-medium transition cursor-pointer flex items-center gap-1.5 ${qa.color} disabled:opacity-40`}
                      >
                        <qa.icon className="h-3 w-3" />
                        <span>{qa.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Freeform Typing & Microphone Action Bar */}
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
                    placeholder={`Say or type anything to ${selectedCaller.name} (e.g. "I want to refill my medication")...`}
                    className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
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
                        <span>Stop</span>
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
            ) : (
              <div className="p-3 bg-slate-900/50 border border-slate-800/80 rounded-xl text-xs text-slate-400 flex items-center justify-between">
                <span>Select a patient on the left and click "Dial Inbound Call" to test live telephony.</span>
                <button
                  onClick={startCall}
                  className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg transition"
                >
                  Dial Now
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
