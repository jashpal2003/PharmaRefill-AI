'use client';

import React, { useRef, useEffect } from 'react';
import { User, Bot, Sparkles, ShieldAlert, MessageSquare } from 'lucide-react';
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
    <div className="flex flex-col flex-1 min-h-0 h-full">
      {/* Word Boost Token Stream */}
      {recentTokens.length > 0 && (
        <div
          className="mb-2.5 rounded-xl p-3 shrink-0"
          style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <div className="flex items-center justify-between text-[10.5px] mb-2">
            <div className="flex items-center gap-1.5 font-semibold" style={{ color: 'rgba(255,255,255,0.55)' }}>
              <Sparkles className="h-3 w-3 text-blue-400" />
              <span>AssemblyAI Word Boost Feed</span>
            </div>
            <span className="font-mono px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.3)', fontSize: '9.5px' }}>
              Top 250 FDA
            </span>
          </div>
          <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto">
            {recentTokens.map((token, idx) => {
              const isBoosted = token.is_word_boost_match || (token as any).isWordBoost;
              return (
                <span
                  key={idx}
                  className="text-[10px] px-2 py-0.5 rounded-full font-mono"
                  style={
                    isBoosted
                      ? { background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', color: '#93C5FD', fontWeight: 600 }
                      : { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.45)' }
                  }
                >
                  {token.text}{isBoosted && <span className="ml-1 text-[8.5px] text-blue-400 uppercase">↑</span>}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Retry Warning */}
      {retryCount > 0 && (
        <div
          className="mb-2.5 rounded-xl p-2.5 flex items-center justify-between shrink-0"
          style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)' }}
        >
          <div className="flex items-center gap-1.5 text-[11px] font-medium" style={{ color: '#FCD34D' }}>
            <ShieldAlert className="h-3.5 w-3.5" style={{ color: '#F59E0B' }} />
            <span>Dead-End Retry: {retryCount} / 2</span>
          </div>
          <span className="text-[9.5px] font-mono" style={{ color: 'rgba(245,158,11,0.6)' }}>
            Auto-escalate at 2
          </span>
        </div>
      )}

      {/* Transcript scroll area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto space-y-3 pr-0.5 text-[11.5px]"
      >
        {transcript.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6">
            <div className="h-10 w-10 rounded-2xl flex items-center justify-center mb-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <MessageSquare className="h-5 w-5" style={{ color: 'rgba(255,255,255,0.2)' }} />
            </div>
            <p className="text-[12px] font-medium" style={{ color: 'rgba(255,255,255,0.3)' }}>
              Awaiting patient speech stream
            </p>
            <p className="text-[10.5px] mt-1" style={{ color: 'rgba(255,255,255,0.18)' }}>
              Launch the Softphone Simulator to begin
            </p>
          </div>
        ) : (
          transcript.map((msg, idx) => {
            const isCaller = msg.speaker.toUpperCase() === 'CALLER';
            const isEscalation = (msg as any).isEscalation;
            const timeStr =
              typeof msg.timestamp === 'string'
                ? msg.timestamp
                : (msg.timestamp as any)?.toLocaleTimeString
                ? (msg.timestamp as any).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                : String(msg.timestamp);

            return (
              <div
                key={msg.id || idx}
                className={`flex flex-col ${isCaller ? 'items-end' : 'items-start'}`}
              >
                {/* Speaker label */}
                <div className="flex items-center gap-1 mb-1" style={{ color: 'rgba(255,255,255,0.3)', fontSize: '10px' }}>
                  {isCaller ? (
                    <>
                      <span className="font-semibold" style={{ color: 'rgba(255,255,255,0.5)' }}>Patient</span>
                      <User className="h-2.5 w-2.5" />
                    </>
                  ) : (
                    <>
                      <Bot className="h-2.5 w-2.5 text-blue-400" />
                      <span className="font-semibold text-blue-400">RxTriage AI</span>
                    </>
                  )}
                  <span className="font-mono ml-1" style={{ color: 'rgba(255,255,255,0.2)' }}>{timeStr}</span>
                </div>

                {/* Bubble */}
                <div
                  className="max-w-[88%] px-3 py-2.5 leading-relaxed"
                  style={
                    isEscalation
                      ? { background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.25)', borderRadius: '12px 4px 12px 12px', color: '#FDA4AF' }
                      : isCaller
                      ? { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px 4px 12px 12px', color: 'rgba(255,255,255,0.78)' }
                      : { background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: '4px 12px 12px 12px', color: 'rgba(255,255,255,0.82)' }
                  }
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
