// src/lib/format-total.ts
// Client-side mirror of the backend's value_resolver.format_total_kcal.
//
// WHY A MIRROR AND NOT THE BACKEND STRING: the app reads day totals STRAIGHT from
// Supabase under RLS (daily_intake / food_logs) — no backend call is involved — so
// the server's `kcal_display` never reaches these screens. The rule still has to
// hold on both sides, so the formatting lives in one place per side and the two
// are kept deliberately identical. If you change the spread here, change
// ESTIMATE_SPREAD in value_resolver.py too.
//
// The rule: a total is only as certain as its least certain part. Summing an
// estimated item into a flat number launders an estimate into a fact.

export const ESTIMATE_SPREAD = 0.2; // ±20%, matches value_resolver.ESTIMATE_SPREAD

/**
 * Headline number for a SUM. Ranged when any contributing item was an estimate,
 * exact only when every part was verified.
 */
export function formatTotalKcal(kcal: number, hasEstimate: boolean): string {
  // No thousands separators: the backend emits none, and its meal-total string is
  // rendered VERBATIM elsewhere in the app. Localising only here would put
  // "1,160–1,740" next to "1160–1740" on the same screen.
  const n = Math.round(kcal || 0);
  if (!hasEstimate) return `${n} kcal`;
  const lo = Math.round((n * (1 - ESTIMATE_SPREAD)) / 10) * 10;
  const hi = Math.round((n * (1 + ESTIMATE_SPREAD)) / 10) * 10;
  if (lo === hi) return `~${n} kcal (est.)`;
  return `${lo}–${hi} kcal · estimate`;
}

/** True when any row in a day/meal carries an estimate-tier provenance. */
export function hasEstimateItem(
  rows: readonly { provenance?: string | null }[],
): boolean {
  return rows.some(
    (r) => r.provenance === 'ai_estimate' || r.provenance === 'analog_estimate',
  );
}
