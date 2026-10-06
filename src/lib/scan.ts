import type { ScanDiag, ScanResponse } from '@/types/scan';

import { ApiError, RequestRefusedError, authFetch } from './api';
import { getBackendState, WAKE_BUDGET_MS } from './backend-health';

export type ScanOutcome =
  | { kind: 'ok'; data: ScanResponse; diag: ScanDiag }
  | { kind: 'not_found'; diag: ScanDiag }
  // We couldn't reach the product database — we do NOT know whether this product
  // exists. Never render this as "not found"; that is a claim we can't make.
  | { kind: 'unavailable'; diag: ScanDiag }
  // Our backend would not accept the session (401/403) even after one refresh.
  // Not an outage and not a missing product: the user's sign-in state is the
  // problem, and the screen must say that rather than "try the scan again".
  | { kind: 'auth'; diag: ScanDiag }
  | { kind: 'invalid'; diag: ScanDiag }
  | { kind: 'upstream_error'; diag: ScanDiag };

/**
 * C3 — a scan must resolve, always. The shared api.ts timeout is 45 s, sized for
 * a Render cold start on a request the user is willing to wait for. A person
 * holding a phone at a barcode is not: past ~10 s they assume it is broken, and
 * an infinite spinner is the single worst outcome because it is the one state
 * with no way out. Past this we resolve to `unavailable`, which has an escape.
 */
const SCAN_TIMEOUT_MS = 10_000;

/**
 * B3 — the one exception: when the server is waking from sleep, 10 s guarantees
 * a failure. The "waking up" banner is on screen telling the user why this is
 * slow, so wait for it rather than resolve to a wrong "unavailable".
 */
function scanDeadlineMs(): number {
  return getBackendState() === 'awake' ? SCAN_TIMEOUT_MS : WAKE_BUDGET_MS;
}

/** GET /scan/{barcode} as the signed-in user (the route requires auth — M2).
 *  authFetch refreshes the session and retries once on 401/403 before this sees
 *  the status. Returns the HTTP status with the body so the diag can carry it. */
async function requestScan(barcode: string): Promise<{ data: ScanResponse; status: number }> {
  const res = await authFetch(`/scan/${barcode}`);
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new ApiError(res.status, text);
  }
  return { data: (await res.json()) as ScanResponse, status: res.status };
}

/** Local fallback diag when we never got a response to read one from. */
function localDiag(
  barcode: string, status: string, ms: number, err: string | null,
  http_status: number | null = null,
): ScanDiag {
  return {
    barcode, status, source: null, ms,
    off_status: null, off_ms: null, off_error: err, http_status,
  };
}

export async function fetchScan(barcode: string): Promise<ScanOutcome> {
  const t0 = Date.now();
  try {
    // Race the request against the scan-specific deadline. Whichever settles
    // first wins; a late response is simply ignored.
    const { data, status } = await Promise.race([
      requestScan(barcode),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('SCAN_TIMEOUT')), scanDeadlineMs()),
      ),
    ]);
    const diag: ScanDiag = {
      ...(data.diag ?? localDiag(barcode, data.status, Date.now() - t0, null)),
      http_status: status,
    };
    if (data.status === 'unavailable') return { kind: 'unavailable', diag };
    if (data.status === 'not_found') return { kind: 'not_found', diag };
    return { kind: 'ok', data, diag };
  } catch (e) {
    const ms = Date.now() - t0;
    if (e instanceof Error && e.message === 'SCAN_TIMEOUT') {
      // Not "not found" — we never got an answer. Same honest state as an OFF
      // outage, and it carries the same escape.
      return { kind: 'unavailable', diag: localDiag(barcode, 'timeout', ms, 'client_timeout') };
    }
    if (e instanceof RequestRefusedError) {
      // 30 scans a minute. Not a miss and not an outage — say "try again".
      return { kind: 'unavailable', diag: localDiag(barcode, 'rate_limited', ms, 'http_429', e.status) };
    }
    if (e instanceof ApiError) {
      if (e.status === 400) return { kind: 'invalid', diag: localDiag(barcode, 'invalid', ms, 'http_400', 400) };
      if (e.status === 401 || e.status === 403) {
        // The session was refreshed and the request retried once already.
        return { kind: 'auth', diag: localDiag(barcode, 'auth', ms, `http_${e.status}`, e.status) };
      }
      if (e.status === 502) return { kind: 'upstream_error', diag: localDiag(barcode, 'error', ms, 'http_502', 502) };
      // Any other HTTP answer: the server replied, so record what it said.
      return { kind: 'upstream_error', diag: localDiag(barcode, 'error', ms, `http_${e.status}`, e.status) };
    }
    // Network failure reaching OUR backend (airplane mode, DNS). Also not a miss.
    return {
      kind: 'unavailable',
      diag: localDiag(barcode, 'unavailable', ms,
        e instanceof Error ? e.name || 'network_error' : 'network_error'),
    };
  }
}

/**
 * C1 — the one-line human-readable summary, e.g.
 *   "EAN 8901764012273 · unavailable · OFF 503 · 2.1s"
 * Shown on non-ok screens in dev/preview builds and printed to the console on
 * every scan, so a screenshot or a log paste contains what actually happened.
 */
export function formatDiag(d: ScanDiag): string {
  const parts = [`EAN ${d.barcode}`, d.status];
  if (d.http_status != null) parts.push(`HTTP ${d.http_status}`);
  if (d.source) parts.push(d.source);
  if (d.off_status != null) parts.push(`OFF ${d.off_status}`);
  if (d.off_error) parts.push(d.off_error);
  parts.push(`${(d.ms / 1000).toFixed(1)}s`);
  return parts.join(' · ');
}
