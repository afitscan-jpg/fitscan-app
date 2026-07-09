import type { ScanResponse } from '@/types/scan';

let pending: ScanResponse | null = null;

/** One-shot store: set before navigating to result, take (and clear) on arrival. */
export const scanResultStore = {
  set(data: ScanResponse): void {
    pending = data;
  },
  take(): ScanResponse | null {
    const d = pending;
    pending = null;
    return d;
  },
};
