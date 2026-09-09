// src/lib/log-events.ts
// A tiny app-wide "food logs changed" signal. Every food_log mutation (add /
// delete / edit / scan) emits it at the data layer, so any surface that caches
// an AGGREGATE of food_logs (Insights charts, and anything else that opts in)
// can refetch the moment the underlying data moves — not only on the next screen
// focus. Deliberately dependency-free (no React, no store lib): a Set of
// listeners fired synchronously. See [[use-logs-changed]] for the subscribe hook.

type Listener = () => void;

const listeners = new Set<Listener>();

/** Fire after any successful food_log mutation. Never throws. */
export function emitLogsChanged(): void {
  for (const listener of listeners) {
    try {
      listener();
    } catch {
      // A subscriber's refetch must never break the mutation that triggered it.
    }
  }
}

/** Subscribe to log changes. Returns an unsubscribe fn. */
export function subscribeLogsChanged(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
