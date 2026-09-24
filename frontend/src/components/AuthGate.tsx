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
    return <div className="h-screen flex items-center justify-center bg-[#060c18] text-slate-400"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }
  if (supabase && !session) return <LoginView />;
  if (meError) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-3 bg-[#060c18] text-slate-300 p-6 text-center">
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
    return <div className="h-screen flex items-center justify-center bg-[#060c18] text-slate-400"><Loader2 className="h-6 w-6 animate-spin" /></div>;
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
    <div className="min-h-screen flex items-center justify-center bg-[#060c18] p-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900/80 p-6 space-y-4 text-slate-100">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-blue-400" />
          <div>
            <h1 className="text-base font-bold">RxTriage AI · Pharmacist Cockpit</h1>
            <p className="text-xs text-slate-400">Staff sign-in. All access is logged.</p>
          </div>
        </div>
        <label className="block text-xs text-slate-300">
          Email
          <input type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
        </label>
        <label className="block text-xs text-slate-300">
          Password
          <input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
        </label>
        {error && <p className="text-xs text-rose-300" role="alert">{error}</p>}
        <button type="submit" disabled={busy} className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-sm font-semibold cursor-pointer">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />} Sign in
        </button>
      </form>
    </div>
  );
};
