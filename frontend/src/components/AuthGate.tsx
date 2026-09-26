'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { Loader2, LogIn, ShieldCheck } from 'lucide-react';
import { setSession, supabase } from '@/lib/supabase';
import { apiJson } from '@/lib/api';

interface StaffIdentity {
  email: string | null;
  role: string;
  phi_masked: boolean;
}

const AuthContext = createContext<{ me: StaffIdentity | null; signOut: () => void }>({ me: null, signOut: () => {} });
export const useAuth = () => useContext(AuthContext);

export const AuthGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSess] = useState<Session | null>(null);
  const [ready, setReady] = useState(!supabase);
  const [me, setMe] = useState<StaffIdentity | null>(null);
  const [meError, setMeError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setSess(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => {
      setSession(s);
      setSess(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (supabase && !session) {
      setMe(null);
      return;
    }
    apiJson<StaffIdentity>('/api/me')
      .then((m) => { setMe(m); setMeError(null); })
      .catch((e) => setMeError(e.message));
  }, [session?.access_token]);

  const signOut = () => {
    supabase?.auth.signOut();
    setMe(null);
  };

  if (!ready) {
    return <div className="h-screen flex items-center justify-center bg-[var(--bg-main)] text-slate-400"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }
  if (supabase && !session) return <LoginView />;
  if (meError) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-3 bg-[var(--bg-main)] text-slate-300 p-6 text-center">
        <ShieldCheck className="h-8 w-8 text-amber-400" />
        <p className="text-sm max-w-md">
          {meError.startsWith('401')
            ? 'Signed in, but this account has not been granted a pharmacy staff role. Ask an administrator to assign one.'
            : `Could not reach the RxTriage backend (${meError}).`}
        </p>
        <button onClick={signOut} className="px-3 py-1.5 rounded-lg bg-slate-800 text-xs cursor-pointer">Sign out</button>
      </div>
    );
  }
  if (!me) {
    return <div className="h-screen flex items-center justify-center bg-[var(--bg-main)] text-slate-400"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }
  return <AuthContext.Provider value={{ me, signOut }}>{children}</AuthContext.Provider>;
};

const LoginView: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    setBusy(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden" style={{ background: '#030711' }}>
      {/* Ambient glow orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full blur-3xl pointer-events-none" style={{ background: 'rgba(99, 102, 241, 0.08)' }} />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full blur-3xl pointer-events-none" style={{ background: 'rgba(6, 182, 212, 0.06)' }} />

      <form
        onSubmit={submit}
        className="w-full max-w-[380px] relative z-10 animate-scale-in"
        style={{
          background: 'rgba(12, 24, 48, 0.6)',
          backdropFilter: 'blur(32px) saturate(1.5)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: '24px',
          padding: '32px',
          boxShadow: '0 32px 64px -16px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.04)',
        }}
      >
        {/* Logo */}
        <div className="flex flex-col items-center mb-6">
          <div className="h-14 w-14 rounded-2xl flex items-center justify-center mb-4 shadow-lg"
            style={{
              background: 'linear-gradient(135deg, #4F46E5, #6366F1, #8B5CF6)',
              boxShadow: '0 8px 24px -4px rgba(99, 102, 241, 0.4)',
            }}
          >
            <ShieldCheck className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-xl font-extrabold tracking-tight" style={{ color: '#F0F4FF' }}>
            PharmaRefill AI
          </h1>
          <p className="text-xs mt-1" style={{ color: '#5A6B8A' }}>
            Staff sign-in · HIPAA access logged
          </p>
        </div>

        <div className="space-y-4">
          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#5A6B8A' }}>Email</span>
            <input
              type="email" required autoComplete="username" value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1.5 w-full rounded-xl px-4 py-2.5 text-sm outline-none transition-all"
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                color: '#F0F4FF',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.5)';
                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.12)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            />
          </label>

          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#5A6B8A' }}>Password</span>
            <input
              type="password" required autoComplete="current-password" value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1.5 w-full rounded-xl px-4 py-2.5 text-sm outline-none transition-all"
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                color: '#F0F4FF',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.5)';
                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.12)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            />
          </label>
        </div>

        {error && (
          <div className="mt-3 p-2.5 rounded-lg text-xs flex items-center gap-2" style={{
            background: 'rgba(244, 63, 94, 0.06)',
            border: '1px solid rgba(244, 63, 94, 0.2)',
            color: '#FDA4AF',
          }}>
            <span className="h-1.5 w-1.5 rounded-full bg-rose-400 shrink-0" />
            {error}
          </div>
        )}

        <button
          type="submit" disabled={busy}
          className="w-full mt-5 flex items-center justify-center gap-2.5 py-2.5 rounded-xl text-sm font-bold cursor-pointer transition-all disabled:opacity-50"
          style={{
            background: 'linear-gradient(135deg, #4F46E5, #6366F1)',
            color: '#fff',
            boxShadow: '0 4px 14px -4px rgba(99, 102, 241, 0.4)',
          }}
          onMouseEnter={(e) => {
            if (!busy) {
              e.currentTarget.style.background = 'linear-gradient(135deg, #6366F1, #818CF8)';
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 6px 20px -4px rgba(99, 102, 241, 0.5)';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'linear-gradient(135deg, #4F46E5, #6366F1)';
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 14px -4px rgba(99, 102, 241, 0.4)';
          }}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
          Sign in
        </button>
      </form>
    </div>
  );
};
