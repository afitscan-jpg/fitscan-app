import type { ScanDiag, ScanResponse } from '@/types/scan';

import { ApiError, apiFetch } from './api';

export type ScanOutcome =
  | { kind: 'ok'; data: ScanResponse; diag: ScanDiag }
  | { kind: 'not_found'; diag: ScanDiag }
  // We couldn't reach the product database — we do NOT know whether this product
  // exists. Never render this as "not found"; that is a claim we can't make.
  | { kind: 'unavailable'; diag: ScanDiag }
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

/** Local fallback diag when we never got a response to read one from. */
function localDiag(barcode: string, status: string, ms: number, err: string | null): ScanDiag {
  return {
    barcode, status, source: null, ms,
    off_status: null, off_ms: null, off_error: err,
  };
}

export async function fetchScan(barcode: string): Promise<ScanOutcome> {
  const t0 = Date.now();
  try {
    // Race the request against the scan-specific deadline. Whichever settles
    // first wins; a late response is simply ignored.
    const data = await Promise.race([
      apiFetch<ScanResponse>(`/scan/${barcode}`),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('SCAN_TIMEOUT')), SCAN_TIMEOUT_MS),
      ),
    ]);
    const diag: ScanDiag =
      data.diag ?? localDiag(barcode, data.status, Date.now() - t0, null);
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
    if (e instanceof ApiError) {
      if (e.status === 400) return { kind: 'invalid', diag: localDiag(barcode, 'invalid', ms, 'http_400') };
      if (e.status === 502) return { kind: 'upstream_error', diag: localDiag(barcode, 'error', ms, 'http_502') };
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
  if (d.source) parts.push(d.source);
  if (d.off_status != null) parts.push(`OFF ${d.off_status}`);
  if (d.off_error) parts.push(d.off_error);
  parts.push(`${(d.ms / 1000).toFixed(1)}s`);
  return parts.join(' · ');
}
