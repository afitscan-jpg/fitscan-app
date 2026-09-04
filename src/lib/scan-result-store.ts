import type { ScanDiag, ScanResponse } from '@/types/scan';

let pending: ScanResponse | null = null;
// C1: the diagnostic is kept SEPARATELY from the result, because the screens that
// most need it are the ones with no result at all — not_found, unavailable, error.
// Those navigate with only a route param, so without this the diag would be
// available on exactly the screens that don't need it.
let pendingDiag: ScanDiag | null = null;

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
  /** Set on EVERY outcome, ok or not. */
  setDiag(diag: ScanDiag | null): void {
    pendingDiag = diag;
  },
  takeDiag(): ScanDiag | null {
    const d = pendingDiag;
    pendingDiag = null;
    return d;
  },
};
