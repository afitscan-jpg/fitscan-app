// src/lib/insights.ts
// Client-side aggregation for the Nutrition Insights screen. Reads the user's own
// data DIRECT under RLS (daily_intake + food_logs + profiles) — no backend, no AI.
// A 7-day window (today + 6 prior) — the honest window, matching what the assistant
// can see. Gaps (unlogged days) are preserved as hasData:false so the chart can
// draw them as a faint absence, never a broken streak.

import { supabase } from './supabase';

const EST_PROVENANCE = new Set(['ai_estimate', 'analog_estimate']);
const MEAL_TYPES = ['breakfast', 'lunch', 'snack', 'dinner'] as const;
export type MealKind = (typeof MEAL_TYPES)[number];

export const WINDOW_DAYS = 7;

export interface InsightDay {
  date: string;        // YYYY-MM-DD (local)
  kcal: number;
  protein_g: number;
  hasData: boolean;    // false → unlogged day, drawn as a faint gap
  est: boolean;        // any estimated item logged that day
}

export interface InsightsData {
  days: InsightDay[];                 // exactly WINDOW_DAYS, oldest → newest
  kcalTarget: number | null;
  proteinTarget: number | null;
  weeklyAvgKcal: number | null;       // averaged over LOGGED days only
  mealSplit: Record<MealKind, number>; // kcal summed per meal over the window
  verifiedPct: number;                // share of items that are verified (0–100)
  estimatedPct: number;               // 100 − verifiedPct
  loggedDays: number;                 // days with any data (for the empty state)
  totalItems: number;
}

function localDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Mirrors backend insights_router._protein_target so the app and server agree.
function proteinTargetFor(weightKg: number | null | undefined, goal: string | null | undefined): number | null {
  if (!weightKg) return null;
  const factor: Record<string, number> = { build_muscle: 2.0, recomp: 2.0, lose: 1.8, gain: 1.6 };
  const f = (goal && factor[goal]) || 1.4;
  return Math.round((weightKg * f) / 5) * 5;
}

export async function getInsights7d(): Promise<InsightsData> {
  const today = new Date();
  const dates: string[] = [];
  for (let i = WINDOW_DAYS - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    dates.push(localDate(d));
  }
  const since = dates[0];

  const [profileRes, intakeRes, logsRes] = await Promise.all([
    supabase.from('profiles').select('daily_target_kcal, weight_kg, goal').maybeSingle(),
    supabase.from('daily_intake').select('log_date, kcal, protein_g').in('log_date', dates),
    supabase.from('food_logs').select('log_date, meal_type, provenance, kcal').gte('log_date', since),
  ]);

  const profile = (profileRes.data ?? {}) as { daily_target_kcal: number | null; weight_kg: number | null; goal: string | null };

  // Per-day totals from the view (only logged days appear).
  type IntakeRow = { log_date: string; kcal: number | null; protein_g: number | null };
  const intakeByDay = new Map<string, IntakeRow>(
    ((intakeRes.data ?? []) as IntakeRow[]).map((r) => [r.log_date, r]),
  );

  // Per-day estimate flag + meal split + provenance share from food_logs.
  type LogRow = { log_date: string; meal_type: MealKind | null; provenance: string | null; kcal: number | null };
  const logs = (logsRes.data ?? []) as LogRow[];
  const estDays = new Set<string>();
  const mealSplit: Record<MealKind, number> = { breakfast: 0, lunch: 0, snack: 0, dinner: 0 };
  let verified = 0;
  let estimated = 0;
  for (const row of logs) {
    if (row.provenance && EST_PROVENANCE.has(row.provenance)) {
      estimated += 1;
      if (row.log_date) estDays.add(row.log_date);
    } else {
      verified += 1;
    }
    const mt = row.meal_type;
    if (mt && mt in mealSplit) mealSplit[mt] += Math.max(0, Math.round(row.kcal ?? 0));
  }
  const totalItems = verified + estimated;
  const verifiedPct = totalItems > 0 ? Math.round((verified / totalItems) * 100) : 0;

  const days: InsightDay[] = dates.map((date) => {
    const row = intakeByDay.get(date);
    return {
      date,
      kcal: Math.max(0, Math.round(row?.kcal ?? 0)),
      protein_g: Math.max(0, Math.round(row?.protein_g ?? 0)),
      hasData: row != null,
      est: estDays.has(date),
    };
  });

  const logged = days.filter((d) => d.hasData);
  const weeklyAvgKcal = logged.length > 0
    ? Math.round(logged.reduce((s, d) => s + d.kcal, 0) / logged.length)
    : null;

  return {
    days,
    kcalTarget: profile.daily_target_kcal ?? null,
    proteinTarget: proteinTargetFor(profile.weight_kg, profile.goal),
    weeklyAvgKcal,
    mealSplit,
    verifiedPct,
    estimatedPct: totalItems > 0 ? 100 - verifiedPct : 0,
    loggedDays: logged.length,
    totalItems,
  };
}
