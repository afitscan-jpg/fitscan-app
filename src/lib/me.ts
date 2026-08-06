// src/lib/me.ts
// Client for GET /me/adaptive-tdee — the user's blended adaptive TDEE + goal target
// derived from their weight trend and logged intake. The number is advisory: any
// failure here must fall back to the static profile target SILENTLY (the caller
// treats null as "no adaptive signal, keep the profile target").

import { authFetch } from './api';

export interface AdaptiveTdee {
  estimated_tdee: number;        // blended (adaptive + static) maintenance estimate
  adaptive_tdee: number | null;  // pure adaptive estimate; null when there's no trend+intake data
  static_tdee: number;           // Mifflin–St Jeor * activity (the static anchor)
  target_kcal: number;           // goal-adjusted daily target from the blend
  confidence: number;            // 0..1
  window_days: number;
  weigh_in_count: number;
  intake_day_count: number;      // real logged-day count (undiscounted)
}

// Session cache: the adaptive number moves at most once a day, so one fetch per app
// session is plenty and keeps Home snappy. resetAdaptiveTdee() clears it if needed.
let cached: AdaptiveTdee | null = null;
let inflight: Promise<AdaptiveTdee | null> | null = null;

export async function getAdaptiveTdee(): Promise<AdaptiveTdee | null> {
  if (cached) return cached;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const res = await authFetch('/me/adaptive-tdee');
      if (!res.ok) return null; // e.g. 400 (incomplete profile) → silent static fallback
      const json = (await res.json()) as AdaptiveTdee;
      cached = json;
      return json;
    } catch {
      // network / timeout / paywall — never surface; Home keeps the static target.
      return null;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

export function resetAdaptiveTdee(): void {
  cached = null;
}
