import { markBackendAwake, pingBackend, requestBudgetMs } from './backend-health';
import { ensureSession, supabase } from './supabase';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Thrown when a request exceeds REQUEST_TIMEOUT_MS (e.g. a cold backend that never
 * responds). Distinct from a normal network error so callers can show a clear,
 * retryable message instead of hanging forever.
 */
export class TimeoutError extends Error {
  constructor(message = 'The request timed out — check your connection and try again.') {
    super(message);
    this.name = 'TimeoutError';
  }
}

// The normal ceiling for a request to a server that is known to be up.
const REQUEST_TIMEOUT_MS = 45000;

// fetch() with a hard timeout via AbortController. On timeout, throws TimeoutError
// (a slow/hung backend no longer freezes the screen). Other fetch errors pass through.
//
// B3: while the server is not known to be awake (first request after launch, or
// after a /health ping went unanswered) the request gets the full cold-start
// budget instead — a measured cold start was 102 s, and a 45 s limit turned
// every one of them into an error. See backend-health.ts.
async function fetchWithTimeout(input: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), requestBudgetMs(REQUEST_TIMEOUT_MS));
  try {
    const res = await fetch(input, { ...init, signal: controller.signal });
    markBackendAwake();          // any answer at all means the server is up
    return res;
  } catch (e) {
    // No answer. Find out whether it is waking or gone, so the NEXT request (and
    // the banner) know — without making this one wait any longer.
    void pingBackend();
    if (e instanceof Error && e.name === 'AbortError') throw new TimeoutError();
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Thrown by authFetch when the server refused the request for a reason the user
 * should be told in the server's own words: too many requests (429) or input
 * that is too long (413). `message` is safe to show as-is.
 */
export class RequestRefusedError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly retryAfterS: number | null = null,
  ) {
    super(message);
    this.name = 'RequestRefusedError';
  }
}

async function refusedFromResponse(res: Response): Promise<RequestRefusedError> {
  let message =
    res.status === 429
      ? 'Too many requests — give it a moment and try again.'
      : "That's too long — please shorten it and try again.";
  try {
    const body: unknown = await res.json();
    const d =
      body && typeof body === 'object' && 'detail' in body
        ? (body as { detail: unknown }).detail
        : null;
    if (typeof d === 'string' && d.trim()) message = d;
    else if (d && typeof d === 'object') {
      const m = (d as { message?: unknown }).message;
      if (typeof m === 'string' && m.trim()) message = m;
    }
  } catch {
    // non-JSON body — keep the default wording
  }
  const ra = Number(res.headers.get('Retry-After'));
  return new RequestRefusedError(res.status, message, Number.isFinite(ra) && ra > 0 ? ra : null);
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
  const res = await fetchWithTimeout(`${API_URL}${path}`);
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
    fetchWithTimeout(`${API_URL}${path}`, {
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

  // Rate limit / daily ceiling / over-long input: the server's message says
  // exactly what happened and when it clears, so carry it to the screen.
  if (res.status === 429 || res.status === 413) {
    throw await refusedFromResponse(res);
  }

  return res;
}
