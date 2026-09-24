import { createClient, Session, SupabaseClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';

// The publishable key is safe in the browser: it can only reach Supabase Auth here.
// All PHI lives in a schema the Data API cannot see; the browser talks to it only through our FastAPI backend.
export const supabase: SupabaseClient | null = url && publishableKey ? createClient(url, publishableKey, {
  auth: { persistSession: true, autoRefreshToken: true },
}) : null;

let accessToken: string | null = null;

export function setSession(session: Session | null) {
  accessToken = session?.access_token ?? null;
}

export function currentAccessToken(): string | null {
  return accessToken;
}
