'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, Phone, PhoneOff, Mic, MicOff, Volume2, Sparkles, AlertTriangle, ShieldCheck, CheckCircle, ArrowRight, Play } from 'lucide-react';

interface InteractivePhoneModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

const DEMO_SCENARIOS = [
  {
    id: 'SCENE_1_HAPPY_PATH',
    title: 'Scene 1: Happy Path + Passive Auth + Med-Sync',
    badge: 'Core Business Value',
    badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    description: 'Statutory consent -> Passive ANI verification (1958) -> Atorvastatin refill -> Proactive 7-day Med-Sync offer (Metformin & Lisinopril) -> $19.90 Copay & Friday pickup lock.',
    steps: [
      { speaker: 'CALLER', text: 'Hello, I am calling about my prescriptions.' },
      { speaker: 'CALLER', text: '1958' },
      { speaker: 'CALLER', text: 'Yes, please refill my Atorvastatin Calcium.' },
      { speaker: 'CALLER', text: 'Yes, please synchronize all three for Friday pickup!' },
      { speaker: 'CALLER', text: 'Yes, I confirm the copay and Friday pickup slot.' }
    ]
  },
  {
    id: 'SCENE_2_DEA_BLOCK',
    title: 'Scene 2: DEA Schedule II Controlled Substance Block',
    badge: 'Title 21 CFR § 1306',
    badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    description: 'Tests DEA Title 21 CFR § 1306 guardrail. Caller requests Oxycodone; agent executes immediate hard block, logs BLOCKED_DEA_REVIEW order, and routes to pharmacist.',
    steps: [
      { speaker: 'CALLER', text: 'Hello' },
      { speaker: 'CALLER', text: '1958' },
      { speaker: 'CALLER', text: 'I also need to refill my Oxycodone-Acetaminophen pain medication.' }
    ]
  },
  {
    id: 'SCENE_3_EMERGENCY',
    title: 'Scene 3: Emergency Adverse Reaction Sentinel',
    badge: 'Clinical Zero-Harm',
    badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
    description: 'Caller voices acute hypersensitivity/anaphylaxis symptoms ("throat feels swollen and tight"). Agent instantly halts triage and initiates emergency warm transfer.',
    steps: [
      { speaker: 'CALLER', text: 'Help, I took my new pill and my throat feels swollen and tight, I cannot breathe!' }
    ]
  },
  {
    id: 'SCENE_4_PRESCRIBER',
    title: 'Scene 4: Prescriber / Clinic Fast-Track Line',
    badge: 'B2B Healthcare',
    badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
    description: 'Doctor clinic medical assistant bypasses patient IVR queue to leave structured verbal prescription and record NPI number.',
    steps: [
      { speaker: 'CALLER', text: "Hi, this is Sarah calling from Dr. Patel's clinic to leave a verbal prescription." },
      { speaker: 'CALLER', text: 'NPI number is 1942810923 for patient Eleanor Vance, Amoxicillin 500mg capsules TID.' }
    ]
  }
];

export const InteractivePhoneModal: React.FC<InteractivePhoneModalProps> = ({
  isOpen,
  onClose,
  onRefresh
}) => {
  const [activeCall, setActiveCall] = useState(false);
  const [sessionId, setSessionId] = useState<string>('');
  const [currentScenario, setCurrentScenario] = useState<any>(DEMO_SCENARIOS[0]);
  const [stepIndex, setStepIndex] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [spokenResponse, setSpokenResponse] = useState<string>('');
  const [callLog, setCallLog] = useState<Array<{ speaker: string; text: string }>>([]);
  const [isVoiceMuted, setIsVoiceMuted] = useState(false);
  const [customInput, setCustomInput] = useState('');
  const [isListeningMic, setIsListeningMic] = useState(false);

  const recognitionRef = useRef<any>(null);

  // Initialize Web Speech API for Browser Voice Output
  const speakText = (text: string) => {
    if (isVoiceMuted || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.92; // Geriatric cadence
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
  };

  const startCall = async (scenario = currentScenario) => {
    const newSessionId = `CALL-${Date.now().toString().slice(-6)}`;
    setSessionId(newSessionId);
    setActiveCall(true);
    setCurrentScenario(scenario);
    setStepIndex(0);
    setCallLog([]);
    setIsProcessing(true);

    try {
      const res = await fetch('http://127.0.0.1:8000/api/call/simulate-step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: newSessionId,
          caller_phone: '+14155550192',
          utterance: ''
        })
      });
      const data = await res.json();
      setSpokenResponse(data.spoken_text);
      setCallLog([{ speaker: 'AGENT', text: data.spoken_text }]);
      speakText(data.spoken_text);
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  const advanceScenarioStep = async () => {
    if (stepIndex >= currentScenario.steps.length) return;
    const callerStep = currentScenario.steps[stepIndex];
    setStepIndex((prev) => prev + 1);
    await sendUtterance(callerStep.text);
  };

  const sendUtterance = async (text: string) => {
    if (!text.trim()) return;
    setIsProcessing(true);
    setCallLog((prev) => [...prev, { speaker: 'CALLER', text }]);

    try {
      const res = await fetch('http://127.0.0.1:8000/api/call/simulate-step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId || `CALL-${Date.now().toString().slice(-6)}`,
          caller_phone: '+14155550192',
          utterance: text
        })
      });
      const data = await res.json();
      setSpokenResponse(data.spoken_text);
      setCallLog((prev) => [...prev, { speaker: 'AGENT', text: data.spoken_text }]);
      speakText(data.spoken_text);
      onRefresh();
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  const endCall = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setActiveCall(false);
    onRefresh();
  };

  // Browser Microphone Capture (SpeechRecognition)
  const toggleMic = () => {
    if (typeof window === 'undefined') return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech Recognition API not supported in this browser. Please use Chrome/Edge or click scenario buttons.');
      return;
    }

    if (isListeningMic) {
      if (recognitionRef.current) recognitionRef.current.stop();
      setIsListeningMic(false);
    } else {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setIsListeningMic(false);
        sendUtterance(transcript);
      };

      recognition.onerror = () => setIsListeningMic(false);
      recognition.onend = () => setIsListeningMic(false);

      recognitionRef.current = recognition;
      recognition.start();
      setIsListeningMic(true);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-6 text-slate-100 max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Phone className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                Interactive Pharmacy Voice Agent Simulator
              </h2>
              <p className="text-xs text-slate-400">
                Test live turn-taking, Word Boost snapping, Med-Sync logic, and clinical emergency routes.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsVoiceMuted(!isVoiceMuted)}
              className={`p-2 rounded-lg border text-xs transition cursor-pointer ${
                isVoiceMuted ? 'bg-slate-800 text-slate-500 border-slate-700' : 'bg-emerald-950/60 text-emerald-300 border-emerald-700/50'
              }`}
              title={isVoiceMuted ? 'Unmute Agent Voice' : 'Mute Agent Voice'}
            >
              <Volume2 className="h-4 w-4" />
            </button>
            <button
              onClick={() => { endCall(); onClose(); }}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content Layout */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 py-4 flex-1 overflow-hidden">
          {/* Left Column: Preset Clinical Scenarios */}
          <div className="space-y-3 overflow-y-auto pr-1">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
              1. Select Hackathon Scenario
            </span>
            {DEMO_SCENARIOS.map((sc) => {
              const isSelected = currentScenario.id === sc.id;
              return (
                <div
                  key={sc.id}
                  onClick={() => {
                    setCurrentScenario(sc);
                    startCall(sc);
                  }}
                  className={`p-3 rounded-xl border transition cursor-pointer ${
                    isSelected && activeCall
                      ? 'bg-slate-800 border-emerald-500/60 shadow-md shadow-emerald-500/10'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-white">{sc.title}</span>
                  </div>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded border inline-block mb-1.5 ${sc.badgeColor}`}>
                    {sc.badge}
                  </span>
                  <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-3">
                    {sc.description}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Right 2-Columns: Call Execution & Live Conversation */}
          <div className="md:col-span-2 flex flex-col bg-slate-950/80 rounded-xl border border-slate-800 p-4 overflow-hidden">
            {/* Call State Bar */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 mb-3">
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${activeCall ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
                <span className="text-xs font-mono text-slate-300">
                  {activeCall ? `Active Call: ${sessionId}` : 'Call Disconnected'}
                </span>
              </div>

              {activeCall ? (
                <button
                  onClick={endCall}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition cursor-pointer"
                >
                  <PhoneOff className="h-3.5 w-3.5" />
                  <span>Hang Up</span>
                </button>
              ) : (
                <button
                  onClick={() => startCall(currentScenario)}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition cursor-pointer"
                >
                  <Phone className="h-3.5 w-3.5" />
                  <span>Dial Call</span>
                </button>
              )}
            </div>

            {/* Live Message History */}
            <div className="flex-1 overflow-y-auto space-y-2.5 pr-2 mb-3 text-xs">
              {callLog.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 py-12">
                  <Play className="h-8 w-8 mb-2 opacity-40" />
                  <p>Select a scenario on the left or click "Dial Call" to begin.</p>
                </div>
              ) : (
                callLog.map((log, i) => (
                  <div
                    key={i}
                    className={`p-3 rounded-xl border ${
                      log.speaker === 'CALLER'
                        ? 'bg-slate-900 border-slate-700 text-cyan-100 ml-6'
                        : 'bg-emerald-950/25 border-emerald-600/40 text-emerald-100 mr-6'
                    }`}
                  >
                    <span className="text-[10px] font-semibold text-slate-400 block mb-1">
                      {log.speaker === 'CALLER' ? 'Caller (Eleanor)' : 'PharmaRefill AI (0.92x Paced Voice)'}
                    </span>
                    <p className="leading-relaxed">{log.text}</p>
                  </div>
                ))
              )}
              {isProcessing && (
                <div className="text-xs text-slate-400 italic p-2 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                  Orchestrating state machine & clinical checks...
                </div>
              )}
            </div>

            {/* Step Advancement & Mic Controls */}
            {activeCall && (
              <div className="pt-3 border-t border-slate-800 space-y-3">
                {/* Scripted Step Trigger */}
                {stepIndex < currentScenario.steps.length && (
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                    <div className="text-xs">
                      <span className="text-[10px] text-slate-400 block">Next Scripted Utterance:</span>
                      <span className="font-semibold text-white">
                        "{currentScenario.steps[stepIndex]?.text}"
                      </span>
                    </div>
                    <button
                      onClick={advanceScenarioStep}
                      disabled={isProcessing}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition cursor-pointer shrink-0 disabled:opacity-50"
                    >
                      <span>Speak Step {stepIndex + 1}</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}

                {/* Custom Utterance & Mic Input */}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={customInput}
                    onChange={(e) => setCustomInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        sendUtterance(customInput);
                        setCustomInput('');
                      }
                    }}
                    placeholder="Or type custom speech frame (e.g. 'I need Hydrochlorothiazide')..."
                    className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    onClick={() => {
                      sendUtterance(customInput);
                      setCustomInput('');
                    }}
                    disabled={!customInput.trim() || isProcessing}
                    className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition cursor-pointer disabled:opacity-50"
                  >
                    Send
                  </button>

                  <button
                    onClick={toggleMic}
                    className={`p-2 rounded-lg border text-xs transition cursor-pointer ${
                      isListeningMic
                        ? 'bg-rose-600 border-rose-500 text-white animate-pulse'
                        : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
                    }`}
                    title="Speak using Real Microphone"
                  >
                    {isListeningMic ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
