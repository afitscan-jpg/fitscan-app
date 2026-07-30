// src/lib/db.ts
// All reads/writes the app needs. RLS guarantees a user only ever touches
// their own rows, so we never filter by user manually on reads.

import { supabase } from './supabase';

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export type LogSource = 'scan' | 'search' | 'ai_estimate' | 'quick_add' | 'manual';
export type Verdict = 'good' | 'ok' | 'avoid';
export type Goal = 'lose' | 'maintain' | 'gain' | 'build_muscle' | 'recomp';
export type Sex = 'male' | 'female' | 'other';
export type DietPreference = 'veg' | 'eggetarian' | 'non_veg' | 'vegan';

export interface Profile {
  id: string;
  language: string;
  units: string;
  sex: Sex | null;
  birth_year: number | null;
  height_cm: number | null;
  weight_kg: number | null;
  activity_factor: number;
  goal: Goal;
  bmr_kcal: number | null;
  maintenance_kcal: number | null;
  daily_target_kcal: number | null;
  water_goal_glasses: number;
  onboarded: boolean;
  country?: string;
  diet_preference?: string;
  target_weight_kg?: number | null;
}

export interface FoodEntry {
  name: string;
  meal_type?: MealType;
  source?: LogSource;
  product_id?: string | null;
  quantity?: number | null;
  unit?: string | null;
  kcal: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
  sugar_g?: number;
  verdict?: Verdict | null;
  ai_raw_input?: string | null;
}

export interface DailyTotals {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  sugar_g: number;
  items: number;
}

/**
 * Best-guess meal slot from the local clock, for logs where the user didn't
 * pick one (AI parse, barcode scan): 05–11 breakfast, 11–16 lunch,
 * 16–19 snack, 19–24 dinner, otherwise snack.
 */
export function mealTypeForNow(d = new Date()): MealType {
  const h = d.getHours();
  if (h >= 5 && h < 11)  return 'breakfast';
  if (h >= 11 && h < 16) return 'lunch';
  if (h >= 16 && h < 19) return 'snack';
  if (h >= 19 && h < 24) return 'dinner';
  return 'snack';
}

// local YYYY-MM-DD (the user's calendar day, not UTC)
function localDate(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

async function currentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error('Not signed in — call ensureSession() first');
  return data.user.id;
}

// ---------------------------------------------------------------- profile
export async function getProfile(): Promise<Profile | null> {
  const { data, error } = await supabase.from('profiles').select('*').maybeSingle();
  if (error) throw error;
  return data as Profile | null;
}

/**
 * Update the maintenance-calc inputs (and language, etc).
 * The DB trigger recomputes bmr_kcal / maintenance_kcal / daily_target_kcal,
 * so the returned row already has the fresh numbers — feed them to the ring.
 */
export async function updateProfile(patch: Partial<Profile>): Promise<Profile> {
  const id = await currentUserId();
  const { data, error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as Profile;
}

// ---------------------------------------------------------------- food log
export async function logFood(entry: FoodEntry): Promise<void> {
  const user_id = await currentUserId();
  const { error } = await supabase.from('food_logs').insert({
    user_id,
    log_date: localDate(),
    meal_type: entry.meal_type ?? 'snack',
    source: entry.source ?? 'manual',
    product_id: entry.product_id ?? null,
    name: entry.name,
    quantity: entry.quantity ?? null,
    unit: entry.unit ?? null,
    kcal: Math.round(entry.kcal),
    protein_g: entry.protein_g ?? 0,
    carbs_g: entry.carbs_g ?? 0,
    fat_g: entry.fat_g ?? 0,
    sugar_g: entry.sugar_g ?? 0,
    verdict: entry.verdict ?? null,
    ai_raw_input: entry.ai_raw_input ?? null,
  });
  if (error) throw error;
}

export async function deleteFoodLog(id: string): Promise<void> {
  const { error } = await supabase.from('food_logs').delete().eq('id', id);
  if (error) throw error;
}

/** Edit an existing entry (used by the Home "tap a row to edit" sheet). */
export async function updateFoodLog(
  id: string,
  fields: {
    quantity?: number | null;
    unit?: string | null;
    kcal?: number;
    protein_g?: number;
    carbs_g?: number;
    fat_g?: number;
  },
): Promise<void> {
  const patch: Record<string, number | string | null> = {};
  if (fields.quantity !== undefined) patch.quantity = fields.quantity;
  if (fields.unit !== undefined) patch.unit = fields.unit;
  if (fields.kcal !== undefined) patch.kcal = Math.round(fields.kcal);
  if (fields.protein_g !== undefined) patch.protein_g = fields.protein_g;
  if (fields.carbs_g !== undefined) patch.carbs_g = fields.carbs_g;
  if (fields.fat_g !== undefined) patch.fat_g = fields.fat_g;
  const { error } = await supabase.from('food_logs').update(patch).eq('id', id);
  if (error) throw error;
}

/** Convenience: log an item that came from a scan result. */
export function logScannedFood(entry: Omit<FoodEntry, 'source'>): Promise<void> {
  return logFood({ ...entry, source: 'scan' });
}

/** Food-log items for a given local date (YYYY-MM-DD), oldest-first. */
export async function getLogForDate(date: string) {
  const { data, error } = await supabase
    .from('food_logs')
    .select('id, name, meal_type, source, kcal, quantity, unit, protein_g, carbs_g, fat_g, verdict, logged_at')
    .eq('log_date', date)
    .order('logged_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/** The "Today" list on Home. */
export function getTodayLog() {
  return getLogForDate(localDate());
}

export interface DayTotal {
  log_date: string;
  kcal: number;
  items: number;
}

/** Totals for the last 7 calendar days, oldest-first. Missing days get zeros. */
export async function getWeekTotals(): Promise<DayTotal[]> {
  const today = new Date();
  const dates: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    dates.push(localDate(d));
  }
  const { data, error } = await supabase
    .from('daily_intake')
    .select('log_date, kcal, items')
    .in('log_date', dates);
  if (error) throw error;
  const map = new Map<string, DayTotal>(
    (data ?? []).map((r: DayTotal) => [r.log_date, r]),
  );
  return dates.map((date) => map.get(date) ?? { log_date: date, kcal: 0, items: 0 });
}

/** Totals for the calorie ring + macros (from the daily_intake view). */
export async function getDailyTotals(date = localDate()): Promise<DailyTotals> {
  const { data, error } = await supabase
    .from('daily_intake')
    .select('kcal, protein_g, carbs_g, fat_g, sugar_g, items')
    .eq('log_date', date)
    .maybeSingle();
  if (error) throw error;
  return (
    (data as DailyTotals | null) ?? {
      kcal: 0,
      protein_g: 0,
      carbs_g: 0,
      fat_g: 0,
      sugar_g: 0,
      items: 0,
    }
  );
}

// ---------------------------------------------------------------- water
export async function addWater(amountMl = 250): Promise<void> {
  const user_id = await currentUserId();
  const { error } = await supabase
    .from('water_logs')
    .insert({ user_id, log_date: localDate(), amount_ml: amountMl });
  if (error) throw error;
}

export async function getWaterToday(): Promise<{ ml: number; glasses: number }> {
  const { data, error } = await supabase
    .from('water_logs')
    .select('amount_ml')
    .eq('log_date', localDate());
  if (error) throw error;
  const ml = (data ?? []).reduce(
    (sum: number, r: { amount_ml: number | null }) => sum + (r.amount_ml ?? 0),
    0,
  );
  return { ml, glasses: Math.round(ml / 250) };
}

// ---------------------------------------------------------------- data footprint
/**
 * Row counts for the current user (RLS-scoped), used to decide whether there's
 * enough logged data to gently suggest creating an account. Read-only.
 */
export async function getDataFootprint(): Promise<{ foodLogs: number; weightLogs: number }> {
  const [food, weight] = await Promise.all([
    supabase.from('food_logs').select('*', { count: 'exact', head: true }),
    supabase.from('weight_logs').select('*', { count: 'exact', head: true }),
  ]);
  return { foodLogs: food.count ?? 0, weightLogs: weight.count ?? 0 };
}

// notifications deferred — re-add with Firebase config when the reminders feature is built
