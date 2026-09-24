// Shared API client: base URL + bearer credential for every backend call.
// Credential = the signed-in staff member's Supabase access token, or (local dev only) NEXT_PUBLIC_API_TOKEN.
import { currentAccessToken } from './supabase';

export const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || 'http://127.0.0.1:8000').replace(/\/$/, '');
const DEV_TOKEN = process.env.NEXT_PUBLIC_API_TOKEN || '';

function bearer(): string {
  return currentAccessToken() || DEV_TOKEN;
}

export function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers || {});
  const token = bearer();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
  return fetch(url, { ...init, headers });
}

export async function apiJson<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers || {});
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const res = await apiFetch(path, { ...init, headers });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail);
    } catch {}
    throw new Error(`${res.status}: ${detail}`);
  }
  return res.json();
}

export function wsUrl(path: string): string {
  const base = API_BASE.replace(/^http/, 'ws');
  const token = bearer();
  return `${base}${path}${token ? `${path.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}` : ''}`;
}
