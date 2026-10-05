// src/lib/backend-health.ts
// Is the server answering yet? (AUDIT_PRODUCTION.md B3)
//
// The backend can be asleep: measured cold start was 102 s, against a 45 s
// request timeout and a 10 s scan timeout, so the first thing a returning user
// did simply failed with an error that blamed their connection. Hosting has
// since moved to an always-on instance, which makes this rare — but "rare" is
// still a deploy, a restart or an incident, so the app keeps the honest answer:
//
//   • GET /health on launch and every time the app returns to the foreground.
//   • No answer within SLOW_MS → state 'waking'. The UI shows "Waking up — a
//     moment" (waking-banner.tsx). This is not an error and is not shown as one.
//   • While the server is not known to be awake, requests are given
//     WAKE_BUDGET_MS (90 s) instead of the normal timeout, so the request the
//     user actually made lands as soon as the server is up.
//   • Any HTTP response at all marks it awake and clears the banner.
//
// 'unreachable' is the different case — no network, or still nothing after the
// full budget. That is left to each screen's existing error handling; this
// module does not put up a banner for it, because it cannot tell the user
// anything they can act on that the screen does not already say.

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';

export type BackendState = 'unknown' | 'awake' | 'waking' | 'unreachable';

/** How long /health may stay silent before we say "waking up". */
const SLOW_MS = 4_000;
/** The longest a cold start is given, for the ping and for a request behind it. */
export const WAKE_BUDGET_MS = 90_000;
const ATTEMPT_TIMEOUT_MS = 20_000;
/** A failure this fast is "no network", not "still booting". */
const FAST_FAIL_MS = 1_500;
const RETRY_GAP_MS = 2_000;

let state: BackendState = 'unknown';
const listeners = new Set<(s: BackendState) => void>();
let inflight: Promise<boolean> | null = null;

function setState(next: BackendState) {
  if (next === state) return;
  state = next;
  listeners.forEach((fn) => {
    try {
      fn(next);
    } catch {
      // a listener must never break the health loop
    }
  });
}

export function getBackendState(): BackendState {
  return state;
}

export function subscribeBackendState(fn: (s: BackendState) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Called by api.ts whenever the server returned ANY response. */
export function markBackendAwake(): void {
  setState('awake');
}

/** The timeout a request should use right now. */
export function requestBudgetMs(normalMs: number): number {
  return state === 'awake' ? normalMs : Math.max(normalMs, WAKE_BUDGET_MS);
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** One /health attempt. Resolves 'ok', 'fast_fail' (no network) or 'slow_fail'. */
async function attempt(timeoutMs: number): Promise<'ok' | 'fast_fail' | 'slow_fail'> {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_URL}/health`, { signal: controller.signal });
    // Any answer means the process is up, whatever the status.
    return res.status > 0 ? 'ok' : 'slow_fail';
  } catch {
    return Date.now() - started < FAST_FAIL_MS ? 'fast_fail' : 'slow_fail';
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Ping the server, waiting out a cold start. Resolves true once it answers,
 * false if it is unreachable. Concurrent callers share one run. Never throws.
 */
export function pingBackend(): Promise<boolean> {
  if (!API_URL) return Promise.resolve(false);
  if (inflight) return inflight;

  inflight = (async () => {
    const started = Date.now();
    let settled = false;
    // Say "waking up" only if it is actually slow — a healthy server answers in
    // well under SLOW_MS and the user never sees anything.
    const slowTimer = setTimeout(() => {
      if (!settled) setState('waking');
    }, SLOW_MS);
    let fastFails = 0;
    try {
      for (;;) {
        const remaining = WAKE_BUDGET_MS - (Date.now() - started);
        if (remaining <= 0) break;
        const result = await attempt(Math.min(ATTEMPT_TIMEOUT_MS, remaining));
        if (result === 'ok') {
          settled = true;
          setState('awake');
          return true;
        }
        if (result === 'fast_fail') {
          fastFails += 1;
          // Refused instantly, twice: this is the network, not a sleeping
          // server. Do not make the user watch "waking up" for 90 s.
          if (fastFails >= 2) break;
        } else {
          fastFails = 0;
        }
        await sleep(RETRY_GAP_MS);
      }
      settled = true;
      setState('unreachable');
      return false;
    } finally {
      settled = true;
      clearTimeout(slowTimer);
      inflight = null;
    }
  })();
  return inflight;
}
