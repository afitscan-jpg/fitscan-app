import { ensureSession, supabase } from './supabase';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export type PaywallKind = 'limit' | 'premium';

export interface PaywallInfo {
  feature?: string;
  used?: number;
  limit?: number;
  status?: string;
}

/**
 * Thrown by authFetch on an HTTP 402 from the metered AI endpoints, so callers
 * can tell "you hit the paywall" apart from a real network/server failure and
 * show the upgrade sheet instead of a generic "couldn't reach server" error.
 *   kind 'limit'   → free user used their daily AI allotment (limit_reached)
 *   kind 'premium' → free user opened a premium-only feature (premium_only)
 */
export class PaywallError extends Error {
  constructor(
    public readonly kind: PaywallKind,
    public readonly info: PaywallInfo = {},
  ) {
    super(kind === 'limit' ? 'Daily free AI limit reached' : 'Premium feature');
    this.name = 'PaywallError';
  }
}

// Build a PaywallError from a 402 response body. FastAPI serializes
// HTTPException(detail=…) as {"detail": {...}}, so unwrap that first.
async function paywallFromResponse(res: Response): Promise<PaywallError> {
  let detail: Record<string, unknown> = {};
  try {
    const body: unknown = await res.json();
    const d =
      body && typeof body === 'object' && 'detail' in body
        ? (body as { detail: unknown }).detail
        : body;
    if (d && typeof d === 'object') detail = d as Record<string, unknown>;
  } catch {
    // non-JSON body — fall through to a generic limit paywall
  }
  const feature = typeof detail.feature === 'string' ? detail.feature : undefined;
  if (detail.error === 'premium_only') {
    return new PaywallError('premium', { feature });
  }
  return new PaywallError('limit', {
    feature,
    used: typeof detail.used === 'number' ? detail.used : undefined,
    limit: typeof detail.limit === 'number' ? detail.limit : undefined,
    status: typeof detail.status === 'string' ? detail.status : undefined,
  });
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

  // Metering paywall — surface a typed error so callers show the upgrade sheet
  // rather than treating it as a network failure.
  if (res.status === 402) {
    throw await paywallFromResponse(res);
  }

  return res;
}
