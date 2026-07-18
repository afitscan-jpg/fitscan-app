// src/lib/weight.ts
// Body-weight tracking via the authenticated backend (/weight/*). The user id is
// derived server-side from the Supabase JWT that authFetch attaches, so nothing
// here passes a user id. Mirrors the request/response shapes in the backend's
// weight_router.py.

import { authFetch, ApiError } from './api';
import { updateProfile } from './db';

export type WeightPeriod = 'week' | 'month' | 'year' | 'all';

export interface WeightLog {
  id: string;
  weight_kg: number;
  log_date: string;   // YYYY-MM-DD
  logged_at: string;  // ISO timestamp
  note: string | null;
}

export interface WeightLogsResult {
  logs: WeightLog[];
  period: WeightPeriod;
  target_weight_kg: number | null;
}

// PostgREST can serialize numeric(5,2) as either a number or a string depending
// on version; coerce defensively so the chart maths never sees a string.
function toNum(v: unknown): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}

function normalizeLog(raw: WeightLog): WeightLog {
  return { ...raw, weight_kg: toNum(raw.weight_kg) };
}

async function readError(res: Response): Promise<never> {
  const text = await res.text().catch(() => res.statusText);
  throw new ApiError(res.status, text);
}

/** Upsert today's (or a given day's) weight; one entry per day, latest wins. */
export async function logWeight(
  weight_kg: number,
  opts: { log_date?: string; note?: string } = {},
): Promise<WeightLog> {
  const res = await authFetch('/weight/log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ weight_kg, log_date: opts.log_date, note: opts.note ?? null }),
  });
  if (!res.ok) await readError(res);
  const json: { log: WeightLog } = await res.json();
  return normalizeLog(json.log);
}

/** The caller's entries for the period, oldest-first, plus the goal weight. */
export async function getWeightLogs(period: WeightPeriod = 'month'): Promise<WeightLogsResult> {
  const res = await authFetch(`/weight/logs?period=${period}`);
  if (!res.ok) await readError(res);
  const json: WeightLogsResult = await res.json();
  return {
    logs: (json.logs ?? []).map(normalizeLog),
    period: json.period ?? period,
    target_weight_kg: json.target_weight_kg == null ? null : toNum(json.target_weight_kg),
  };
}

/**
 * Set the goal weight (profiles.target_weight_kg). Written through the Supabase
 * client (updateProfile), the same owner-scoped, RLS-protected path used for
 * every other profile field — the /weight backend has no set-target route and
 * doesn't need one. Returns the saved value.
 */
export async function setTargetWeight(kg: number): Promise<number | null> {
  const updated = await updateProfile({ target_weight_kg: kg });
  return updated.target_weight_kg ?? null;
}

/** Delete one of the caller's own entries. */
export async function deleteWeight(id: string): Promise<void> {
  const res = await authFetch(`/weight/${id}`, { method: 'DELETE' });
  if (!res.ok) await readError(res);
}
