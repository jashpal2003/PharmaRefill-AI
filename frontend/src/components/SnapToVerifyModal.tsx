'use client';

import React, { useState } from 'react';
import { X, Camera, CheckCircle, Smartphone, ArrowRight, ShieldCheck, Sparkles } from 'lucide-react';

interface SnapToVerifyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SnapToVerifyModal: React.FC<SnapToVerifyModalProps> = ({ isOpen, onClose }) => {
  const [scanned, setScanned] = useState(false);
  const [isScanning, setIsScanning] = useState(false);

  const triggerScan = () => {
    setIsScanning(true);
    setTimeout(() => {
      setIsScanning(false);
      setScanned(true);
    }, 1500);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-6 text-slate-100 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/20">
              <Camera className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                "Snap-to-Verify" Dual-Channel Fallback
              </h2>
              <p className="text-xs text-slate-400">
                Solves the #1 senior citizen failure mode when Rx numbers cannot be voiced.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Interactive Phone Camera Viewport */}
        <div className="py-5 flex flex-col items-center">
          <div className="w-64 h-96 rounded-3xl bg-slate-950 border-4 border-slate-700 shadow-2xl overflow-hidden relative flex flex-col items-center justify-between p-4">
            {/* Phone Speaker Notch */}
            <div className="w-20 h-3.5 bg-slate-800 rounded-full mb-2" />

            {/* Camera View Area */}
            <div className="w-full flex-1 rounded-xl bg-slate-900/90 border border-slate-800 relative flex flex-col items-center justify-center p-3 text-center overflow-hidden">
              {isScanning ? (
                <div className="space-y-2 flex flex-col items-center">
                  <div className="h-12 w-12 rounded-full border-4 border-teal-400 border-t-transparent animate-spin" />
                  <span className="text-xs text-teal-300 font-mono">Scanning Label OCR...</span>
                </div>
              ) : scanned ? (
                <div className="space-y-2 flex flex-col items-center">
                  <CheckCircle className="h-10 w-10 text-emerald-400 animate-bounce" />
                  <span className="text-xs font-bold text-emerald-300">Label Verified!</span>
                  <div className="bg-slate-950 p-2 rounded border border-slate-800 text-[10px] font-mono text-left w-full text-slate-300">
                    <div>Rx: <span className="text-white">RX-4829103</span></div>
                    <div>Drug: <span className="text-white">Atorvastatin 20mg</span></div>
                    <div>Patient: <span className="text-white">Eleanor Vance</span></div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2 flex flex-col items-center text-slate-500">
                  <Camera className="h-12 w-12 opacity-40" />
                  <span className="text-[11px]">Point camera at pill bottle label</span>
                </div>
              )}

              {/* Target Aiming Grid */}
              <div className="absolute inset-3 border-2 border-dashed border-teal-500/40 rounded-lg pointer-events-none" />
            </div>

            {/* Shutter Button */}
            <button
              onClick={triggerScan}
              disabled={isScanning}
              className="mt-3 w-12 h-12 rounded-full bg-teal-500 hover:bg-teal-400 text-slate-950 flex items-center justify-center shadow-lg shadow-teal-500/30 transition cursor-pointer"
            >
              <Camera className="h-6 w-6" />
            </button>
          </div>

          <div className="mt-4 text-xs text-slate-300 max-w-sm text-center leading-relaxed">
            While on the phone, the agent automatically texts an instant web camera link to the caller's mobile. Optical OCR extracts the Rx number without disconnecting the voice call.
          </div>
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition cursor-pointer"
          >
            Close Scanner
          </button>
        </div>
      </div>
    </div>
  );
};
