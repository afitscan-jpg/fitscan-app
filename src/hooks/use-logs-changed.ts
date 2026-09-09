// src/hooks/use-logs-changed.ts
// Subscribe a component to the app-wide food-log change signal ([[log-events]]).
// The callback fires whenever any food_log mutation completes. The latest
// callback is always used (kept in a ref) so callers don't need to memoise it,
// and the subscription is torn down on unmount.

import { useEffect, useRef } from 'react';

import { subscribeLogsChanged } from '@/lib/log-events';

export function useLogsChanged(callback: () => void): void {
  const ref = useRef(callback);
  ref.current = callback;

  useEffect(() => subscribeLogsChanged(() => ref.current()), []);
}
