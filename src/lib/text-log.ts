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
  /** The portion is implausibly large ("500 rotis"). The number is real but
   *  UNENDORSED: the backend did NOT write it to the diary. Show the prompt and
   *  let the user confirm or correct — never drop it silently. */
  requires_confirmation?: boolean;
  /** Honest prompt for a held item, e.g. "500 pieces of Roti is about 59,800
   *  kcal — did you mean 5?". Rendered verbatim. */
  clarification?: string | null;
}

export interface TextLogTotal {
  kcal: number;
  /** Already formatted — render VERBATIM. Now a RANGE when any item was an
   *  estimate ("150–230 kcal · 1 estimate"), and carries "N items need
   *  confirming" for held items. Never a bare "≈188" over an estimate. */
  display: string;
  counted_items: number;             // EXCLUDES items awaiting confirmation
  /** Was missing from this interface entirely (audit D-28) — the backend has
   *  always sent it. */
  estimated_items: number;
  unverified_items: number;
  /** How many items are held pending the user's confirmation. */
  needs_confirmation_items?: number;
  /** True when any counted item was estimate-tier, i.e. `display` is a range. */
  has_estimate?: boolean;
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

/** Thrown when /log/confirm refuses a still-absurd quantity (HTTP 409). Carries
 *  the fresh prompt so the sheet can ask again rather than fail. */
export class NeedsConfirmationError extends Error {
  constructor(
    public readonly clarification: string,
    public readonly kcal: number | null,
  ) {
    super(clarification);
    this.name = 'NeedsConfirmationError';
  }
}

/**
 * Write a HELD item to the diary — the user either confirmed the amount or
 * corrected it.
 *
 * This is a dedicated endpoint, NOT a re-POST of /log/text: re-posting would
 * re-run the LLM extraction, costing another AI credit and possibly resolving to
 * something different from what the user is looking at. /log/confirm makes no
 * model call, so it is free and deterministic. The numbers are re-derived
 * server-side from (canonical_food_id, qty, unit) — the client never supplies
 * kcal, so the server stays the only source of numbers.
 *
 * Pass `confirmed: true` for "yes, I really ate that much". Leave it off when
 * the user EDITED the quantity: a corrected amount is then re-checked normally,
 * so 5 just logs and 400 asks again.
 */
export async function confirmLogItem(opts: {
  canonicalFoodId: string;
  qty: number;
  unit: string;
  meal: string;
  confirmed?: boolean;
}): Promise<{ logged: boolean; food_log_ids: string[] }> {
  const res = await authFetch('/log/confirm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      canonical_food_id: opts.canonicalFoodId,
      qty: opts.qty,
      unit: opts.unit,
      meal: opts.meal,
      date: localDate(),
      confirmed: opts.confirmed === true,
    }),
  });
  if (res.status === 409) {
    const body = (await res.json().catch(() => ({}))) as {
      detail?: { clarification?: string; kcal?: number };
    };
    throw new NeedsConfirmationError(
      body.detail?.clarification ?? 'That amount looks unusually large — confirm to log it.',
      body.detail?.kcal ?? null,
    );
  }
  if (!res.ok) throw new Error(`log/confirm failed: ${res.status}`);
  return (await res.json()) as { logged: boolean; food_log_ids: string[] };
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
