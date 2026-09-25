'use client';

// App-wide feedback: toasts for action results and an accessible prompt/confirm dialog
// that replaces window.prompt (validation, keyboard support, focus management).
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';

type ToastTone = 'success' | 'error' | 'info';
interface Toast { id: number; tone: ToastTone; message: string }

interface PromptOptions {
  title: string;
  description?: string;
  label?: string;
  placeholder?: string;
  defaultValue?: string;
  minLength?: number;
  multiline?: boolean;
  choices?: { value: string; label: string; hint?: string }[];
  confirmLabel?: string;
  danger?: boolean;
  /** No input: a plain confirm dialog. Resolves to "confirm" or null. */
  confirmOnly?: boolean;
}

interface FeedbackApi {
  toast: (message: string, tone?: ToastTone) => void;
  prompt: (opts: PromptOptions) => Promise<string | null>;
  confirm: (opts: Omit<PromptOptions, 'confirmOnly'>) => Promise<boolean>;
}

const Ctx = createContext<FeedbackApi | null>(null);

export function useFeedback(): FeedbackApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useFeedback must be used inside <FeedbackProvider>');
  return ctx;
}

export const FeedbackProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [dialog, setDialog] = useState<(PromptOptions & { resolve: (v: string | null) => void }) | null>(null);
  const seq = useRef(0);

  const toast = useCallback((message: string, tone: ToastTone = 'success') => {
    const id = ++seq.current;
    setToasts((t) => [...t.slice(-3), { id, tone, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === 'error' ? 7000 : 4000);
  }, []);

  const prompt = useCallback((opts: PromptOptions) => new Promise<string | null>((resolve) => setDialog({ ...opts, resolve })), []);
  const confirm = useCallback(async (opts: Omit<PromptOptions, 'confirmOnly'>) => (await prompt({ ...opts, confirmOnly: true })) !== null, [prompt]);

  const close = (value: string | null) => {
    dialog?.resolve(value);
    setDialog(null);
  };

  return (
    <Ctx.Provider value={{ toast, prompt, confirm }}>
      {children}
      {dialog && <PromptDialog opts={dialog} onClose={close} />}
      <div className="fixed bottom-4 right-4 z-[70] flex flex-col gap-2 w-[min(360px,calc(100vw-2rem))]" aria-live="polite" role="status">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.tone} flex items-start gap-2.5 rounded-xl px-3.5 py-3 text-sm shadow-xl`}>
            {t.tone === 'success' ? <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" /> : t.tone === 'error' ? <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" /> : <Info className="h-4 w-4 mt-0.5 shrink-0" />}
            <span className="flex-1 leading-snug">{t.message}</span>
            <button onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))} aria-label="Dismiss" className="opacity-60 hover:opacity-100 cursor-pointer"><X className="h-3.5 w-3.5" /></button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
};

const PromptDialog: React.FC<{ opts: PromptOptions; onClose: (v: string | null) => void }> = ({ opts, onClose }) => {
  const [value, setValue] = useState(opts.defaultValue ?? opts.choices?.[0]?.value ?? '');
  const inputRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const tooShort = !opts.confirmOnly && !opts.choices && (opts.minLength ?? 1) > value.trim().length;

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (tooShort) return;
    onClose(opts.confirmOnly ? 'confirm' : value.trim());
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose(null)}>
      <form onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="dlg-title" className="surface-raised w-full max-w-md rounded-2xl p-5 space-y-4">
        <div>
          <h2 id="dlg-title" className="text-base font-semibold text-strong">{opts.title}</h2>
          {opts.description && <p className="text-sm text-muted mt-1 leading-relaxed">{opts.description}</p>}
        </div>
        {opts.choices ? (
          <div className="space-y-2" role="radiogroup" aria-label={opts.label || opts.title}>
            {opts.choices.map((c) => (
              <label key={c.value} className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 cursor-pointer text-sm ${value === c.value ? 'border-blue-500 bg-blue-500/10' : 'border-subtle'}`}>
                <input type="radio" name="choice" className="mt-1" checked={value === c.value} onChange={() => setValue(c.value)} />
                <span><span className="text-strong font-medium">{c.label}</span>{c.hint && <span className="block text-xs text-muted">{c.hint}</span>}</span>
              </label>
            ))}
          </div>
        ) : !opts.confirmOnly && (
          <label className="block text-sm">
            <span className="text-muted">{opts.label}</span>
            {opts.multiline ? (
              <textarea ref={inputRef} value={value} onChange={(e) => setValue(e.target.value)} placeholder={opts.placeholder} rows={4} className="field mt-1.5 w-full" />
            ) : (
              <input ref={inputRef} value={value} onChange={(e) => setValue(e.target.value)} placeholder={opts.placeholder} className="field mt-1.5 w-full" />
            )}
            {opts.minLength && opts.minLength > 1 && (
              <span className={`block text-xs mt-1 ${tooShort ? 'text-amber-400' : 'text-muted'}`}>{value.trim().length}/{opts.minLength} characters minimum</span>
            )}
          </label>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={() => onClose(null)} className="btn btn-ghost">Cancel</button>
          <button type="submit" disabled={tooShort} className={`btn ${opts.danger ? 'btn-danger' : 'btn-primary'}`}>{opts.confirmLabel || 'Confirm'}</button>
        </div>
      </form>
    </div>
  );
};

/** Turns API errors ("403: Forbidden for role") into sentences a pharmacist can act on. */
export function friendlyError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.startsWith('401')) return 'Your session has expired. Please sign in again.';
  if (msg.startsWith('403')) return 'Your role does not allow this action. Ask an administrator if you need access.';
  if (msg.startsWith('404')) return 'That record no longer exists. Refresh and try again.';
  if (msg.startsWith('409')) return msg.replace(/^409:\s*/, '');
  if (msg.startsWith('422')) return 'Some fields are missing or invalid.';
  if (/Failed to fetch|NetworkError/i.test(msg)) return 'Cannot reach the RxTriage server. Check that the backend is running.';
  return msg.replace(/^\d{3}:\s*/, '');
}
