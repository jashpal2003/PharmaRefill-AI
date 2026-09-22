'use client';

import React, { useRef, useEffect } from 'react';
import { User, Bot, Sparkles, ShieldAlert } from 'lucide-react';
import { TranscriptMessage, TokenItem } from '@/lib/types';

interface TranscriptFeedProps {
  transcript: TranscriptMessage[];
  recentTokens: TokenItem[];
  retryCount?: number;
}

export const TranscriptFeed: React.FC<TranscriptFeedProps> = ({
  transcript,
  recentTokens,
  retryCount = 0
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcript, recentTokens]);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Word Boost Streaming Tokens Bubble */}
      {recentTokens.length > 0 && (
        <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-xl p-3 mb-4">
          <div className="flex items-center justify-between text-xs text-emerald-400 font-semibold mb-2">
            <div className="flex items-center gap-1">
              <Sparkles className="h-3.5 w-3.5 text-emerald-400 animate-spin" />
              <span>AssemblyAI Real-Time Word Boost Feed</span>
            </div>
            <span className="text-[10px] font-mono bg-emerald-900/60 px-2 py-0.5 rounded text-emerald-200">
              Top 250 FDA Entities
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
            {recentTokens.map((token, idx) => {
              const isBoosted = token.is_word_boost_match || (token as any).isWordBoost;
              return (
                <span
                  key={idx}
                  className={`text-xs px-2 py-0.5 rounded-full font-mono transition-all ${
                    isBoosted
                      ? 'bg-emerald-500/20 border border-emerald-400/80 text-emerald-200 font-bold shadow-sm shadow-emerald-500/20'
                      : 'bg-slate-800/80 text-slate-300'
                  }`}
                >
                  {token.text}
                  {isBoosted && (
                    <span className="ml-1 text-[9px] text-emerald-400 uppercase tracking-wider font-sans">
                      [BOOST]
                    </span>
                  )}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Dead-End Retry Warning Counter if retry count > 0 */}
      {retryCount > 0 && (
        <div className="bg-amber-950/30 border border-amber-500/50 rounded-xl p-2.5 mb-3 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 text-amber-300 font-medium">
            <ShieldAlert className="h-4 w-4 text-amber-400" />
            <span>Dead-End Retry Counter: {retryCount} / 2</span>
          </div>
          <span className="text-[11px] text-amber-400/80 font-mono">
            Auto-Escalation at 2
          </span>
        </div>
      )}

      {/* Transcript History Feed */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs"
      >
        {transcript.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 italic p-6 text-center">
            <p>Awaiting incoming patient speech stream...</p>
            <p className="text-[11px] mt-1 text-slate-600">
              Click &quot;Simulate Eleanor Vance Call&quot; above to trigger live streaming audio and transcription.
            </p>
          </div>
        ) : (
          transcript.map((msg, idx) => {
            const isCaller = msg.speaker.toUpperCase() === 'CALLER';
            const timeStr = typeof msg.timestamp === 'string' 
              ? msg.timestamp 
              : (msg.timestamp as any)?.toLocaleTimeString ? (msg.timestamp as any).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : String(msg.timestamp);

            return (
              <div
                key={msg.id || idx}
                className={`flex flex-col ${isCaller ? 'items-end' : 'items-start'}`}
              >
                <div className="flex items-center gap-1 text-[11px] text-slate-400 mb-1">
                  {isCaller ? (
                    <>
                      <span className="font-semibold text-teal-400">Caller (Eleanor)</span>
                      <User className="h-3 w-3 text-teal-400" />
                    </>
                  ) : (
                    <>
                      <Bot className="h-3 w-3 text-emerald-400" />
                      <span className="font-semibold text-emerald-400">PharmaRefill AI</span>
                    </>
                  )}
                  <span className="text-[10px] text-slate-500 ml-1 font-mono">
                    {timeStr}
                  </span>
                </div>
                <div
                  className={`max-w-[88%] p-3 rounded-2xl leading-relaxed shadow-sm ${
                    isCaller
                      ? 'bg-gradient-to-br from-teal-950/80 to-slate-900 border border-teal-500/30 text-teal-100 rounded-tr-none'
                      : (msg as any).isEscalation
                      ? 'bg-gradient-to-br from-rose-950/80 to-slate-950 border border-rose-500/40 text-rose-100 rounded-tl-none'
                      : 'bg-gradient-to-br from-slate-900 to-slate-950 border border-emerald-500/20 text-slate-200 rounded-tl-none'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
export default TranscriptFeed;
