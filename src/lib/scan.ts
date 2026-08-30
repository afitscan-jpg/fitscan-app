import type { ScanResponse } from '@/types/scan';

import { ApiError, apiFetch } from './api';

export type ScanOutcome =
  | { kind: 'ok'; data: ScanResponse }
  | { kind: 'not_found' }
  // We couldn't reach the product database — we do NOT know whether this product
  // exists. Never render this as "not found"; that is a claim we can't make.
  | { kind: 'unavailable' }
  | { kind: 'invalid' }
  | { kind: 'upstream_error' };

export async function fetchScan(barcode: string): Promise<ScanOutcome> {
  try {
    const data = await apiFetch<ScanResponse>(`/scan/${barcode}`);
    if (data.status === 'unavailable') return { kind: 'unavailable' };
    if (data.status === 'not_found') return { kind: 'not_found' };
    return { kind: 'ok', data };
  } catch (e) {
    if (e instanceof ApiError) {
      if (e.status === 400) return { kind: 'invalid' };
      if (e.status === 502) return { kind: 'upstream_error' };
    }
    throw e;
  }
}
