// Shared API client: base URL + bearer token for every backend call.
export const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || 'http://127.0.0.1:8000').replace(/\/$/, '');
const API_TOKEN = process.env.NEXT_PUBLIC_API_TOKEN || '';

export function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers || {});
  if (API_TOKEN) headers.set('Authorization', `Bearer ${API_TOKEN}`);
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
  return `${base}${path}${API_TOKEN ? `${path.includes('?') ? '&' : '?'}token=${encodeURIComponent(API_TOKEN)}` : ''}`;
}
