// src/lib/kcal.ts
// One rule for every total the app computes itself: a total is the sum of the
// per-row DISPLAYED (rounded) kcal, never the rounded sum of unrounded rows.
// 2 × 99.6 shows as 100 + 100 and must total 200, not round(199.2) = 199. The
// backend applies the same rule to text-log totals (value_resolver.shown_kcal).

/** Round each value the way its row displays it, then sum. */
export function sumShownKcal(values: Iterable<number>): number {
  let total = 0;
  for (const v of values) total += Math.round(Number(v) || 0);
  return total;
}
