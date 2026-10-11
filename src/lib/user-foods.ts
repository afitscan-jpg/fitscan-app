// src/lib/user-foods.ts
// The user's own foods and recipes (Sprint 4). All numbers are made or checked
// by the server (foods_router): a custom food's per-100 g is derived there from
// the label values typed per serving, and a recipe's from the registry rows of
// its ingredients. The app sends what the user typed and shows what came back.

import { authFetch, RequestRefusedError } from './api';

export type UserFoodKind = 'entry' | 'recipe';

export interface UserFood {
  id: string;
  kind: UserFoodKind;
  name: string;
  aliases: string[];
  category: string | null;
  kcal_100g: number;
  protein_100g: number;
  carb_100g: number;
  fat_100g: number;
  fiber_100g: number | null;
  default_portions: Record<string, number>;
  source_note: string | null;
  items: { canonical_food_id: string; name: string; grams: number; provenance: string }[] | null;
  total_weight_g: number | null;
  servings: number | null;
  updated_at: string;
}

export interface RegistryFood {
  id: string;
  name: string;
  category: string | null;
  prep_state: string | null;
  default_portions: Record<string, number>;
  kcal_100g: number;
  protein_100g: number;
  carb_100g: number;
  fat_100g: number;
  fiber_100g: number | null;
  provenance: string;
  /** Its grams are the cooked weight (the row is a cooked food). */
  cooked: boolean;
  dish: boolean;
}

/** The server's 4/4/9 check disagreed by 10-25%: it may be saved anyway. */
export class NumbersDisagreeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NumbersDisagreeError';
  }
}

/** Thrown for a 4xx the server explained in words (422 / 409 / 404). `message`
 *  is written for the user and safe to show as-is. */
export class FoodInputError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'FoodInputError';
  }
}

async function detailOf(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { detail?: unknown };
    if (typeof body.detail === 'string' && body.detail.trim()) return body.detail;
    if (body.detail && typeof body.detail === 'object') {
      const m = (body.detail as { message?: unknown }).message;
      if (typeof m === 'string' && m.trim()) return m;
    }
  } catch {
    // non-JSON
  }
  return fallback;
}

async function expectOk<T>(res: Response, fallback: string): Promise<T> {
  if (res.ok) return (await res.json()) as T;
  if (res.status === 422) {
    let body: { detail?: unknown } = {};
    try { body = (await res.clone().json()) as { detail?: unknown }; } catch { /* non-JSON */ }
    const d = body.detail;
    if (d && typeof d === 'object' && (d as { can_force?: unknown }).can_force === true) {
      const m = (d as { message?: unknown }).message;
      throw new NumbersDisagreeError(typeof m === 'string' ? m : 'The numbers don\u2019t quite add up. Save anyway?');
    }
    throw new FoodInputError(422, await detailOf(res, fallback));
  }
  if (res.status === 409 || res.status === 404) {
    throw new FoodInputError(res.status, await detailOf(res, fallback));
  }
  throw new Error(`${fallback} (${res.status})`);
}

export async function listMyFoods(): Promise<UserFood[]> {
  const res = await authFetch('/me/foods');
  const body = await expectOk<{ foods: UserFood[] }>(res, "Couldn't load your foods");
  return body.foods;
}

export async function searchRegistry(q: string, purpose: 'any' | 'recipe' = 'any'): Promise<RegistryFood[]> {
  const term = q.trim();
  if (!term) return [];
  try {
    const res = await authFetch(`/foods/search?q=${encodeURIComponent(term)}&purpose=${purpose}`);
    const body = await expectOk<{ foods: RegistryFood[] }>(res, 'Search failed');
    return body.foods;
  } catch (e) {
    if (e instanceof RequestRefusedError) throw e;
    return [];
  }
}

export interface EntryInput {
  name: string;
  aliases: string[];
  serving_label: string;
  serving_g: number;
  kcal: number;
  protein_g: number;
  carb_g: number;
  fat_g: number;
  fiber_g: number | null;
  source_note: string | null;
  /** Save even though the 4/4/9 check disagrees (only honoured within 25%). */
  force?: boolean;
}

export async function createEntry(input: EntryInput): Promise<{ food: UserFood; warning: string | null }> {
  const res = await authFetch('/me/foods', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
  });
  return expectOk<{ food: UserFood; warning: string | null }>(res, "Couldn't save that food");
}

export interface RecipeInput {
  name: string;
  aliases: string[];
  ingredients: { canonical_food_id: string; grams: number }[];
  total_weight_g: number;
  servings: number;
  serving_label: string;
}

export interface RecipeSaved {
  food: UserFood;
  has_estimate: boolean;
  /** e.g. "Cooked white rice is a cooked row: 150 g is read as the COOKED weight…" */
  warnings: string[];
  /** The server's working, one line per ingredient and a total. */
  arithmetic: string[];
}

export async function createRecipe(input: RecipeInput): Promise<RecipeSaved> {
  const res = await authFetch('/me/recipes', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
  });
  return expectOk<RecipeSaved>(res, "Couldn't save that recipe");
}

export async function deleteMyFood(id: string): Promise<void> {
  const res = await authFetch(`/me/foods/${id}`, { method: 'DELETE' });
  await expectOk<{ deleted: boolean }>(res, "Couldn't delete that");
}

/** kcal for one default serving of a user food, for list rows. */
export function servingKcal(f: UserFood): { label: string; grams: number; kcal: number } | null {
  const entries = Object.entries(f.default_portions || {});
  if (entries.length === 0) return null;
  const [label, grams] = entries.find(([k]) => k !== 'serving') ?? entries[0];
  return { label, grams, kcal: Math.round((f.kcal_100g * grams) / 100) };
}
