// src/lib/text-log.ts
// Text food logging via POST /log/text. The backend parses the text, resolves
// each food against the verified registry, and returns provenance-tagged items
// with pre-formatted display strings (display_kcal, total.display) that the UI
// renders VERBATIM — the trust model lives in those strings, so we never reformat
// or round them here.
//
// authFetch attaches the bearer token and throws PaywallError on 402, so callers
// get the same paywall path as every other AI endpoint.

import { authFetch } from './api';

export type Provenance =
  | 'expert_verified'
  | 'verified'
  | 'verified_packaged'
  | 'composed'
  | 'analog_estimate'
  | 'ai_estimate';

export interface TextLogItem {
  name: string;
  qty: number;
  unit: string;
  grams: number | null;
  kcal: number | null;
  protein: number | null;
  carb: number | null;
  fat: number | null;
  fiber: number | null;
  provenance: Provenance | string;
  badge: string;
  confidence: number;
  band: string;
  display_kcal: string;              // already formatted — render verbatim
  canonical_food_id: string | null;
  needs_clarification: boolean;
  modifier_note: string | null;
}

export interface TextLogTotal {
  kcal: number;
  display: string;                   // already formatted — render verbatim
  counted_items: number;
  unverified_items: number;
}

export interface TextLogResponse {
  items: TextLogItem[];
  total: TextLogTotal;
  meal: string;
  logged: boolean;
  food_log_ids?: string[];   // ids of the diary rows written by the backend
}

// The user's local calendar day (not UTC), so the backend writes food_logs.log_date
// to the same day the home calorie ring queries.
function localDate(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Runtime shape guard: the card renders result.items.map / result.total.display
// straight off this response. Confirm those exist before trusting the cast.
function isTextLogResponse(x: unknown): x is TextLogResponse {
  if (!x || typeof x !== 'object') return false;
  const r = x as { items?: unknown; total?: unknown };
  if (!Array.isArray(r.items)) return false;
  const t = r.total as { display?: unknown } | null | undefined;
  return !!t && typeof t.display === 'string';
}

export async function logTextFood(text: string, meal: string): Promise<TextLogResponse> {
  const res = await authFetch('/log/text', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, meal, date: localDate() }),
  });
  if (!res.ok) throw new Error(`log/text failed: ${res.status}`);
  const data = (await res.json()) as unknown;
  // Malformed body → throw so the card's existing catch shows the inline error.
  if (!isTextLogResponse(data)) throw new Error('Malformed /log/text response');
  return data;
}
