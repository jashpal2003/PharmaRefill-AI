'use client';

import React from 'react';
import { AlertTriangle, Lock } from 'lucide-react';

interface EmergencyBannerProps {
  emergencyAlert: {
    active: boolean;
    warning?: string;
  };
  deaAlert?: {
    active: boolean;
    medication?: any;
    reason?: string;
  };
}

export const EmergencyBanner: React.FC<EmergencyBannerProps> = ({
  emergencyAlert,
  deaAlert
}) => {
  if (!emergencyAlert.active && !deaAlert?.active) {
    return null;
  }

  return (
    <div className="space-y-3 mb-4">
      {/* Critical Emergency Anaphylaxis Sentinel Alert (Pulsing Red) */}
      {emergencyAlert.active && (
        <div className="emergency-pulse bg-rose-950/80 border-2 border-rose-500 rounded-xl p-4 text-rose-100 shadow-lg shadow-rose-950/50">
          <div className="flex items-center gap-2 text-sm font-bold text-rose-200 mb-1">
            <AlertTriangle className="h-5 w-5 text-rose-400 animate-bounce" />
            <span>CRITICAL CLINICAL ALERT: ANAPHYLAXIS SENTINEL</span>
          </div>
          <p className="text-xs text-rose-200 leading-relaxed">
            {emergencyAlert.warning ||
              'Patient reported acute symptoms (tight throat / breathing distress). Automated processing halted; emergency warm transfer to on-duty pharmacist in progress.'}
          </p>
          <div className="mt-2.5 text-[11px] font-mono bg-rose-900/70 px-2.5 py-1.5 rounded text-rose-100 flex items-center justify-between">
            <span>ACTION: EMERGENCY EXTENSION 101 ACTIVE</span>
            <span className="font-bold underline cursor-pointer bg-rose-800 px-2 py-0.5 rounded text-white">
              TAKE OVER CALL NOW
            </span>
          </div>
        </div>
      )}

      {/* DEA Schedule II-V Controlled Substance Safety Lock (Amber Banner) */}
      {deaAlert?.active && (
        <div className="dea-pulse bg-amber-950/80 border-2 border-amber-500 rounded-xl p-4 text-amber-100 shadow-lg shadow-amber-950/40">
          <div className="flex items-center gap-2 text-sm font-bold text-amber-300 mb-1">
            <Lock className="h-5 w-5 text-amber-400" />
            <span>DEA TITLE 21 CFR § 1306 SAFETY LOCK ACTIVATED</span>
          </div>
          <p className="text-xs text-amber-200 leading-relaxed">
            Caller requested{' '}
            <span className="font-bold text-white">
              {deaAlert.medication?.drug_name || 'Oxycodone-Acetaminophen'}
            </span>{' '}
            (Schedule II C-II Controlled Substance). Autonomous voice dispensing strictly blocked. Order routed to licensed pharmacist queue.
          </p>
          <div className="mt-2.5 text-[11px] font-mono bg-amber-900/60 px-2.5 py-1.5 rounded text-amber-200 flex items-center justify-between">
            <span>DISPENSE ORDER STATUS: BLOCKED_DEA_REVIEW</span>
            <span className="font-semibold text-amber-300">PHARMACIST SIGN-OFF REQUIRED</span>
          </div>
        </div>
      )}
    </div>
  );
};
export default EmergencyBanner;
