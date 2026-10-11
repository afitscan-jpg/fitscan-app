// src/lib/quick-log.ts
// Logging speed (Sprint 3): the fastest log is one you have made before.
//
//   recents        — the last foods logged, de-duplicated by name. Read from
//                    food_logs; nothing to store.
//   favourites     — foods the user starred (favorite_foods, migration_028).
//   saved meals    — named bundles logged as one (saved_meals, migration_028).
//   repeat         — yesterday's (or any day's) rows, logged again today.
//
// Every re-log goes through logEntries(): the same row shape as logFood, so the
// diary, totals and provenance markers see no difference between a food logged
// fresh and one logged again. Nothing here invents a number — a re-logged food
// carries exactly the figures it was logged with.

import { supabase } from './supabase';
import { logFood, mealTypeForNow, type FoodEntry, type LogSource, type MealType } from './db';

/** A food as it was logged once: everything needed to log it again. */
export interface LoggedFood {
  name: string;
  quantity: number | null;
  unit: string | null;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  sugar_g: number;
  source: LogSource | null;
  provenance: string | null;
}

export interface RecentFood extends LoggedFood {
  /** Last time it was logged (ISO). */
  last_logged_at: string;
  meal_type: MealType;
}

export interface FavoriteFood extends LoggedFood {
  id: string;
}

export interface SavedMeal {
  id: string;
  name: string;
  meal_type: MealType | null;
  items: LoggedFood[];
  updated_at: string;
}

const LOG_COLS =
  'id, name, meal_type, source, provenance, kcal, quantity, unit, protein_g, carbs_g, fat_g, sugar_g, logged_at, log_date';

type LogRow = {
  id: string; name: string; meal_type: MealType; source: LogSource | null; provenance: string | null;
  kcal: number; quantity: number | null; unit: string | null;
  protein_g: number; carbs_g: number; fat_g: number; sugar_g: number;
  logged_at: string; log_date: string;
};

export function nameKey(name: string): string {
  return name.trim().toLowerCase();
}

function toLoggedFood(r: Pick<LogRow, keyof LoggedFood>): LoggedFood {
  return {
    name: r.name, quantity: r.quantity == null ? null : Number(r.quantity), unit: r.unit,
    kcal: Number(r.kcal) || 0,
    protein_g: Number(r.protein_g) || 0, carbs_g: Number(r.carbs_g) || 0,
    fat_g: Number(r.fat_g) || 0, sugar_g: Number(r.sugar_g) || 0,
    source: r.source, provenance: r.provenance,
  };
}

function localDate(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function yesterdayDate(now = new Date()): string {
  const d = new Date(now);
  d.setDate(d.getDate() - 1);
  return localDate(d);
}

// ── Log again ────────────────────────────────────────────────────────────────

/** Log several foods as today's rows. Sequential inserts through logFood so each
 *  row is validated the same way; returns the names that FAILED (empty = all
 *  landed), never throwing away the ones that did. */
export async function logEntries(
  foods: LoggedFood[],
  meal: MealType,
  source: LogSource = 'quick_add',
): Promise<string[]> {
  const failed: string[] = [];
  for (const f of foods) {
    const entry: FoodEntry = {
      name: f.name, meal_type: meal,
      // A re-log is still the kind of log it was (scan stays scan) — unless it
      // was never typed, in which case it is a quick add.
      source: f.source ?? source,
      quantity: f.quantity, unit: f.unit,
      kcal: f.kcal, protein_g: f.protein_g, carbs_g: f.carbs_g, fat_g: f.fat_g, sugar_g: f.sugar_g,
      provenance: f.provenance,
    };
    try {
      await logFood(entry);
    } catch {
      failed.push(f.name);
    }
  }
  return failed;
}

// ── Recents ──────────────────────────────────────────────────────────────────

/** Most recently logged foods, one per name, newest first. Scans back through
 *  the last `scan` rows so a heavy logger still gets variety. */
export async function getRecents(limit = 12, scan = 150): Promise<RecentFood[]> {
  const { data, error } = await supabase
    .from('food_logs')
    .select(LOG_COLS)
    .order('logged_at', { ascending: false })
    .limit(scan);
  if (error) throw error;
  const seen = new Set<string>();
  const out: RecentFood[] = [];
  for (const r of (data ?? []) as LogRow[]) {
    const k = nameKey(r.name);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push({ ...toLoggedFood(r), last_logged_at: r.logged_at, meal_type: r.meal_type });
    if (out.length >= limit) break;
  }
  return out;
}

// ── A day's rows (repeat yesterday) ──────────────────────────────────────────

export interface DayFood extends LoggedFood {
  id: string;
  meal_type: MealType;
}

export async function getDayFoods(date: string): Promise<DayFood[]> {
  const { data, error } = await supabase
    .from('food_logs')
    .select(LOG_COLS)
    .eq('log_date', date)
    .order('logged_at', { ascending: true });
  if (error) throw error;
  return ((data ?? []) as LogRow[]).map((r) => ({ ...toLoggedFood(r), id: r.id, meal_type: r.meal_type }));
}

/** Yesterday's rows, for "Repeat yesterday". Each keeps its own meal slot. */
export function getYesterdayFoods(): Promise<DayFood[]> {
  return getDayFoods(yesterdayDate());
}

/** Log a set of day rows again today, each under the meal it had. Returns the
 *  names that failed. */
export async function repeatFoods(foods: DayFood[]): Promise<string[]> {
  const failed: string[] = [];
  const byMeal = new Map<MealType, DayFood[]>();
  for (const f of foods) byMeal.set(f.meal_type, [...(byMeal.get(f.meal_type) ?? []), f]);
  for (const [meal, group] of byMeal) failed.push(...(await logEntries(group, meal)));
  return failed;
}

// ── Favourites ───────────────────────────────────────────────────────────────

async function uid(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error('Not signed in');
  return data.user.id;
}

export async function getFavorites(): Promise<FavoriteFood[]> {
  const { data, error } = await supabase
    .from('favorite_foods')
    .select('id, name, quantity, unit, kcal, protein_g, carbs_g, fat_g, sugar_g, source, provenance')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as (LoggedFood & { id: string })[]).map((r) => ({ ...toLoggedFood(r), id: r.id }));
}

/** Star a food. Idempotent per (user, name): starring the same name again
 *  updates the stored portion instead of failing. */
export async function addFavorite(food: LoggedFood): Promise<void> {
  const user_id = await uid();
  const row = {
    user_id, name: food.name.trim(), quantity: food.quantity, unit: food.unit,
    kcal: Math.round(food.kcal), protein_g: food.protein_g, carbs_g: food.carbs_g,
    fat_g: food.fat_g, sugar_g: food.sugar_g, source: food.source, provenance: food.provenance,
  };
  const { error } = await supabase.from('favorite_foods').upsert(row, { onConflict: 'user_id,name_key' });
  if (error) throw error;
}

export async function removeFavorite(id: string): Promise<void> {
  const { error } = await supabase.from('favorite_foods').delete().eq('id', id);
  if (error) throw error;
}

/** Is this name starred? (name match, case-insensitive) */
export function isFavorite(favorites: FavoriteFood[], name: string): FavoriteFood | undefined {
  const k = nameKey(name);
  return favorites.find((f) => nameKey(f.name) === k);
}

// ── Saved meals ──────────────────────────────────────────────────────────────

export async function getSavedMeals(): Promise<SavedMeal[]> {
  const { data, error } = await supabase
    .from('saved_meals')
    .select('id, name, meal_type, items, updated_at')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as SavedMeal[]).map((m) => ({
    ...m,
    items: Array.isArray(m.items) ? m.items.map((i) => toLoggedFood(i as LogRow)) : [],
  }));
}

export async function saveMeal(name: string, items: LoggedFood[], meal_type: MealType | null): Promise<SavedMeal> {
  const user_id = await uid();
  const clean = name.trim();
  if (!clean) throw new Error('A saved meal needs a name');
  if (items.length === 0) throw new Error('A saved meal needs at least one food');
  const { data, error } = await supabase
    .from('saved_meals')
    .insert({ user_id, name: clean, meal_type, items })
    .select('id, name, meal_type, items, updated_at')
    .single();
  if (error) throw error;
  return data as SavedMeal;
}

export async function deleteSavedMeal(id: string): Promise<void> {
  const { error } = await supabase.from('saved_meals').delete().eq('id', id);
  if (error) throw error;
}

/** Log every item of a saved meal, under its default slot or the time of day.
 *  Returns the names that failed. */
export function logSavedMeal(meal: SavedMeal, mealOverride?: MealType): Promise<string[]> {
  return logEntries(meal.items, mealOverride ?? meal.meal_type ?? mealTypeForNow());
}

/** Total kcal of a set of foods, for chips and sheets. */
export function sumKcal(items: LoggedFood[]): number {
  return Math.round(items.reduce((n, i) => n + (Number(i.kcal) || 0), 0));
}
