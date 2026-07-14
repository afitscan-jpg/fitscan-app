import { ensureSession, supabase } from './supabase';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`);
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new ApiError(res.status, text);
  }
  return res.json() as Promise<T>;
}

// Return the current access token, creating an anonymous session first if none
// exists yet.
async function currentAccessToken(): Promise<string> {
  let {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    await ensureSession();
    ({
      data: { session },
    } = await supabase.auth.getSession());
  }
  return session?.access_token ?? '';
}

/**
 * fetch() for the authenticated backend endpoints (/ai/parse, /insights/*).
 * Attaches the Supabase access token as `Authorization: Bearer <jwt>`; the
 * backend derives the user id from it. On a 401 it refreshes the session once
 * and retries once. Returns the raw Response so callers keep their own
 * res.ok / res.json() handling.
 */
export async function authFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const run = (token: string) =>
    fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        ...(options.headers ?? {}),
        Authorization: `Bearer ${token}`,
      },
    });

  let res = await run(await currentAccessToken());

  if (res.status === 401) {
    const { data } = await supabase.auth.refreshSession();
    const refreshed = data.session?.access_token;
    if (refreshed) res = await run(refreshed);
  }

  return res;
}
