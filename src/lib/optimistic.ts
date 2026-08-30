// src/lib/optimistic.ts
// One shape for "update the UI now, write it, put it back if the write fails".
//
// THE CLASS OF BUG THIS FIXES: several handlers moved the UI, awaited a write,
// and swallowed the failure — `catch { /* ignore */ }`. Offline, +250 ml appeared
// to do nothing and Delete left the row in place, both without a word. The user's
// natural response is to tap again, which for a write is the worst outcome.
//
// Three rules, in one place so they cannot drift per-handler:
//   1. a failed write ALWAYS reverts the optimistic UI,
//   2. a failed write ALWAYS says something,
//   3. the message describes what didn't happen, never what the user did wrong.

export interface OptimisticRun<T> {
  /** Move the UI immediately. Optional — omit for non-optimistic writes. */
  apply?: () => void;
  /** Put the UI back exactly as it was. Required when `apply` is given. */
  revert?: () => void;
  /** The real write. */
  commit: () => Promise<T>;
  /** How to tell the user. Wire this to useToast(). */
  notify: (message: string) => void;
  /** What didn't happen, in plain words. */
  message: string;
  /** Optional: refresh from source after a successful write. */
  settle?: () => void | Promise<void>;
}

/**
 * Returns the commit result, or null when it failed (already reverted and
 * reported). Never throws — callers can branch on null instead of try/catch,
 * which is what made the old handlers so easy to leave silent.
 */
export async function runOptimistic<T>(run: OptimisticRun<T>): Promise<T | null> {
  run.apply?.();
  try {
    const result = await run.commit();
    if (run.settle) await run.settle();
    return result;
  } catch {
    run.revert?.();
    run.notify(run.message);
    return null;
  }
}
