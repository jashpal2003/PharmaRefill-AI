'use client';

import React, { useId } from 'react';
import { Sparkles, Mic, Volume2, ShieldAlert, AlertOctagon, Activity, Zap } from 'lucide-react';

export type OrbState =
  | 'IDLE'
  | 'LISTENING'
  | 'THINKING'
  | 'SPEAKING'
  | 'BARGE_IN'
  | 'EMERGENCY'
  | 'DEA_BLOCKED';

interface VoiceOrbProps {
  state: OrbState;
  size?: 'sm' | 'md' | 'lg' | 'hero';
  showLabel?: boolean;
  subtext?: string;
  onClick?: () => void;
  className?: string;
}

export const VoiceOrb: React.FC<VoiceOrbProps> = ({
  state = 'IDLE',
  size = 'md',
  showLabel = true,
  subtext,
  onClick,
  className = '',
}) => {
  const gradientId = useId();

  // Size dimensions
  const dims = {
    sm: { box: 64, orb: 36, waves: 56, text: 'text-[10px]' },
    md: { box: 110, orb: 60, waves: 96, text: 'text-xs' },
    lg: { box: 160, orb: 90, waves: 140, text: 'text-sm' },
    hero: { box: 220, orb: 120, waves: 196, text: 'text-base' },
  }[size];

  // Palette & styles depending on state
  const config = {
    IDLE: {
      color1: '#0284C7', // Sky 600
      color2: '#0D9488', // Teal 600
      color3: '#1E293B', // Slate 800
      glow: 'rgba(14, 165, 233, 0.25)',
      badgeBg: 'bg-slate-800/80 border-slate-700/60 text-slate-300',
      title: 'Standby Line',
      icon: Activity,
      iconColor: 'text-cyan-400',
      pulseSpeed: 'animate-pulse',
    },
    LISTENING: {
      color1: '#06B6D4', // Cyan 500
      color2: '#3B82F6', // Blue 500
      color3: '#0891B2',
      glow: 'rgba(6, 182, 212, 0.45)',
      badgeBg: 'bg-cyan-950/80 border-cyan-500/50 text-cyan-300',
      title: 'AssemblyAI Listening',
      icon: Mic,
      iconColor: 'text-cyan-300',
      pulseSpeed: 'animate-ping',
    },
    THINKING: {
      color1: '#8B5CF6', // Violet 500
      color2: '#EC4899', // Pink 500
      color3: '#6366F1',
      glow: 'rgba(139, 92, 246, 0.5)',
      badgeBg: 'bg-purple-950/80 border-purple-500/50 text-purple-300',
      title: 'AssemblyAI LLM Gateway',
      icon: Sparkles,
      iconColor: 'text-purple-300',
      pulseSpeed: 'animate-spin',
    },
    SPEAKING: {
      color1: '#10B981', // Emerald 500
      color2: '#06B6D4', // Cyan 500
      color3: '#059669',
      glow: 'rgba(16, 185, 129, 0.45)',
      badgeBg: 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300',
      title: 'Cartesia Sonic-2 Speaking',
      icon: Volume2,
      iconColor: 'text-emerald-300',
      pulseSpeed: 'animate-pulse',
    },
    BARGE_IN: {
      color1: '#F59E0B', // Amber 500
      color2: '#EF4444', // Red 500
      color3: '#D97706',
      glow: 'rgba(245, 158, 11, 0.6)',
      badgeBg: 'bg-amber-950/80 border-amber-500/60 text-amber-300',
      title: '⚡ Real-time Barge-In Detected',
      icon: Zap,
      iconColor: 'text-amber-300',
      pulseSpeed: 'animate-bounce',
    },
    EMERGENCY: {
      color1: '#F43F5E', // Rose 500
      color2: '#E11D48',
      color3: '#881337',
      glow: 'rgba(244, 63, 94, 0.65)',
      badgeBg: 'bg-rose-950/90 border-rose-500 text-rose-200',
      title: 'Emergency Sentinel Triaged',
      icon: AlertOctagon,
      iconColor: 'text-rose-300',
      pulseSpeed: 'animate-ping',
    },
    DEA_BLOCKED: {
      color1: '#D97706', // Amber 600
      color2: '#DC2626', // Red 600
      color3: '#78350F',
      glow: 'rgba(217, 119, 6, 0.55)',
      badgeBg: 'bg-amber-950/90 border-amber-600/80 text-amber-200',
      title: 'Title 21 CFR § 1306 DEA Hard Block',
      icon: ShieldAlert,
      iconColor: 'text-amber-400',
      pulseSpeed: 'animate-pulse',
    },
  }[state] || {
    color1: '#0284C7',
    color2: '#0D9488',
    color3: '#1E293B',
    glow: 'rgba(14, 165, 233, 0.25)',
    badgeBg: 'bg-slate-800 text-slate-300',
    title: 'Standby',
    icon: Activity,
    iconColor: 'text-slate-400',
    pulseSpeed: '',
  };

  const IconComponent = config.icon;

  return (
    <div
      onClick={onClick}
      className={`flex flex-col items-center justify-center select-none ${onClick ? 'cursor-pointer hover:scale-105 transition-transform' : ''} ${className}`}
    >
      {/* Reactor Canvas / SVG Orb */}
      <div
        className="relative flex items-center justify-center"
        style={{ width: dims.box, height: dims.box }}
      >
        {/* Ambient Back Glow */}
        <div
          className="absolute inset-0 rounded-full blur-2xl transition-all duration-700 pointer-events-none"
          style={{ background: config.glow }}
        />

        {/* Outer Undulating Ripple Waves (Listening or Speaking) */}
        {(state === 'LISTENING' || state === 'SPEAKING' || state === 'BARGE_IN') && (
          <>
            <span
              className={`absolute rounded-full border border-current opacity-40 ${
                state === 'BARGE_IN' ? 'animate-ping' : 'animate-ping'
              }`}
              style={{
                width: dims.waves,
                height: dims.waves,
                color: config.color1,
                animationDuration: state === 'LISTENING' ? '1.8s' : '1.2s',
              }}
            />
            <span
              className="absolute rounded-full border border-current opacity-20 animate-ping"
              style={{
                width: dims.waves * 1.25,
                height: dims.waves * 1.25,
                color: config.color2,
                animationDuration: '2.4s',
                animationDelay: '0.4s',
              }}
            />
          </>
        )}

        {/* Orbiting Particle Ring (Thinking / Processing) */}
        {state === 'THINKING' && (
          <div
            className="absolute rounded-full border border-dashed border-purple-400/50 animate-spin"
            style={{
              width: dims.waves * 0.95,
              height: dims.waves * 0.95,
              animationDuration: '6s',
            }}
          />
        )}

        {/* Core Glowing Orb SVG */}
        <svg
          width={dims.orb}
          height={dims.orb}
          viewBox="0 0 100 100"
          className="relative z-10 transition-all duration-500 drop-shadow-xl"
        >
          <defs>
            <radialGradient id={`${gradientId}-radial`} cx="35%" cy="35%" r="65%">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.8" />
              <stop offset="30%" stopColor={config.color1} />
              <stop offset="80%" stopColor={config.color2} />
              <stop offset="100%" stopColor={config.color3} />
            </radialGradient>

            <linearGradient id={`${gradientId}-ring`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={config.color1} stopOpacity="0.9" />
              <stop offset="100%" stopColor={config.color2} stopOpacity="0.2" />
            </linearGradient>

            <filter id={`${gradientId}-glow`} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Outer Rim Ring */}
          <circle
            cx="50"
            cy="50"
            r="47"
            fill="none"
            stroke={`url(#${gradientId}-ring)`}
            strokeWidth="2.5"
            strokeDasharray={state === 'SPEAKING' ? '4 2' : state === 'THINKING' ? '6 3' : 'none'}
            className={state === 'THINKING' ? 'animate-spin origin-center' : ''}
          />

          {/* Main Core Body */}
          <circle
            cx="50"
            cy="50"
            r="42"
            fill={`url(#${gradientId}-radial)`}
            filter={`url(#${gradientId}-glow)`}
            className={`transition-all duration-300 ${
              state === 'SPEAKING'
                ? 'scale-95 origin-center'
                : state === 'LISTENING'
                ? 'scale-100 origin-center'
                : ''
            }`}
          />

          {/* Specular Highlight Arc */}
          <ellipse
            cx="42"
            cy="32"
            rx="18"
            ry="9"
            fill="#FFFFFF"
            opacity="0.35"
            transform="rotate(-25 42 32)"
          />
        </svg>

        {/* Center Icon Overlay */}
        <div className="absolute z-20 pointer-events-none flex items-center justify-center">
          <IconComponent
            className={`transition-transform duration-300 ${
              size === 'hero' ? 'h-9 w-9' : size === 'lg' ? 'h-6 w-6' : size === 'md' ? 'h-4 w-4' : 'h-3 w-3'
            } ${config.iconColor} drop-shadow-md`}
          />
        </div>
      </div>

      {/* State Label & Subtext */}
      {showLabel && (
        <div className="mt-2 flex flex-col items-center text-center">
          <span
            className={`font-mono font-semibold px-2.5 py-0.5 rounded-full border text-[11px] shadow-sm flex items-center gap-1.5 ${config.badgeBg}`}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: config.color1 }}
            />
            {config.title}
          </span>
          {subtext && (
            <span className="text-[10px] text-slate-400 mt-1 max-w-[220px] truncate">
              {subtext}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
