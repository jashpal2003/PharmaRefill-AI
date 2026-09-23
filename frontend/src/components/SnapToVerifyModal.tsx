'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Camera, CheckCircle, Upload, X, XCircle } from 'lucide-react';
import { apiJson } from '@/lib/api';

interface SnapToVerifyModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientId?: string;
  patientName?: string;
}

// BarcodeDetector ships in Chromium browsers (Chrome, Edge, Android). Other browsers get manual entry.
declare global {
  interface Window {
    BarcodeDetector?: any;
  }
}

export const SnapToVerifyModal: React.FC<SnapToVerifyModalProps> = ({ isOpen, onClose, patientId, patientName }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [supported, setSupported] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [manual, setManual] = useState('');
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const stop = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setScanning(false);
  };

  useEffect(() => {
    setSupported(typeof window !== 'undefined' && !!window.BarcodeDetector);
    if (!isOpen) {
      stop();
      setResult(null);
      setError(null);
    }
    return stop;
  }, [isOpen]);

  const verify = async (code: string) => {
    if (!patientId) return setError('Select a patient first.');
    try {
      setError(null);
      setResult(await apiJson(`/api/verify/ndc?code=${encodeURIComponent(code)}&patient_id=${patientId}`));
    } catch (e: any) {
      setError(e.message);
    }
  };

  const detectFrom = async (source: CanvasImageSource) => {
    const detector = new window.BarcodeDetector({ formats: ['upc_a', 'ean_13', 'data_matrix', 'code_128'] });
    const codes = await detector.detect(source);
    return codes[0]?.rawValue as string | undefined;
  };

  const startCamera = async () => {
    setResult(null);
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setScanning(true);
      const loop = async () => {
        if (!streamRef.current || !videoRef.current) return;
        try {
          const code = await detectFrom(videoRef.current);
          if (code) {
            stop();
            await verify(code);
            return;
          }
        } catch {}
        requestAnimationFrame(loop);
      };
      loop();
    } catch (e: any) {
      setError(`Camera unavailable: ${e.message}`);
    }
  };

  const onFile = async (file?: File) => {
    if (!file) return;
    setResult(null);
    try {
      const bitmap = await createImageBitmap(file);
      const code = await detectFrom(bitmap);
      if (!code) return setError('No barcode found in that image.');
      await verify(code);
    } catch (e: any) {
      setError(e.message);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" role="dialog" aria-modal="true" aria-label="Snap to verify">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-6 text-slate-100 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-teal-400" />
            <div>
              <h2 className="text-base font-bold">Snap-to-Verify (NDC barcode)</h2>
              <p className="text-xs text-slate-400">Scan the stock bottle barcode to confirm it matches {patientName || 'the patient'}’s prescription.</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 cursor-pointer"><X className="h-5 w-5" /></button>
        </div>

        <div className="rounded-xl bg-black aspect-video overflow-hidden relative flex items-center justify-center">
          <video ref={videoRef} className={`w-full h-full object-cover ${scanning ? '' : 'hidden'}`} muted playsInline />
          {!scanning && <span className="text-xs text-slate-500">{supported ? 'Camera off' : 'Barcode scanning needs Chrome or Edge — use manual entry below.'}</span>}
          {scanning && <div className="absolute inset-x-8 top-1/2 h-0.5 bg-teal-400/80 animate-pulse" />}
        </div>

        <div className="flex flex-wrap gap-2">
          <button disabled={!supported || scanning} onClick={startCamera} className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-xs font-semibold cursor-pointer">Start camera</button>
          {scanning && <button onClick={stop} className="px-3 py-1.5 rounded-lg bg-slate-800 text-xs cursor-pointer">Stop</button>}
          <label className={`px-3 py-1.5 rounded-lg bg-slate-800 text-xs cursor-pointer flex items-center gap-1 ${supported ? '' : 'opacity-50 pointer-events-none'}`}>
            <Upload className="h-3.5 w-3.5" /> Upload photo
            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          </label>
          <input value={manual} onChange={(e) => setManual(e.target.value)} placeholder="or type NDC / barcode digits" className="flex-1 min-w-[160px] bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs" />
          <button onClick={() => verify(manual)} disabled={!manual} className="px-3 py-1.5 rounded-lg bg-blue-600 disabled:opacity-50 text-xs font-semibold cursor-pointer">Verify</button>
        </div>

        {error && <p className="text-xs text-rose-300">{error}</p>}
        {result && (
          <div className={`rounded-xl p-3 border text-xs space-y-1 ${result.match ? 'border-emerald-500/40 bg-emerald-950/30' : 'border-rose-500/40 bg-rose-950/30'}`}>
            <div className="flex items-center gap-2 font-bold">
              {result.match ? <CheckCircle className="h-4 w-4 text-emerald-400" /> : <XCircle className="h-4 w-4 text-rose-400" />}
              {result.match ? 'Match — correct product' : 'MISMATCH — do not dispense'}
            </div>
            <div className="font-mono text-slate-300">NDC {result.ndc11 || result.ndc10} {result.product ? `· ${result.product}` : ''}</div>
            {result.rx && <div className="text-slate-300">Rx {result.rx.rx_number}: {result.rx.drug_name} {result.rx.strength}</div>}
            {result.reason && <div className="text-rose-200">{result.reason}</div>}
          </div>
        )}
      </div>
    </div>
  );
};
