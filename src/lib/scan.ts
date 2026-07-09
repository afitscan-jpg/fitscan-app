import type { ScanResponse } from '@/types/scan';

import { ApiError, apiFetch } from './api';

export type ScanOutcome =
  | { kind: 'ok'; data: ScanResponse }
  | { kind: 'not_found' }
  | { kind: 'invalid' }
  | { kind: 'upstream_error' };

export async function fetchScan(barcode: string): Promise<ScanOutcome> {
  try {
    const data = await apiFetch<ScanResponse>(`/scan/${barcode}`);
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
