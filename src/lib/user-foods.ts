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
  if (res.status === 422 || res.status === 409 || res.status === 404) {
    throw new FoodInputError(res.status, await detailOf(res, fallback));
  }
  throw new Error(`${fallback} (${res.status})`);
}

export async function listMyFoods(): Promise<UserFood[]> {
  const res = await authFetch('/me/foods');
  const body = await expectOk<{ foods: UserFood[] }>(res, "Couldn't load your foods");
  return body.foods;
}

export async function searchRegistry(q: string): Promise<RegistryFood[]> {
  const term = q.trim();
  if (!term) return [];
  try {
    const res = await authFetch(`/foods/search?q=${encodeURIComponent(term)}`);
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
}

export async function createEntry(input: EntryInput): Promise<UserFood> {
  const res = await authFetch('/me/foods', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
  });
  const body = await expectOk<{ food: UserFood }>(res, "Couldn't save that food");
  return body.food;
}

export interface RecipeInput {
  name: string;
  aliases: string[];
  ingredients: { canonical_food_id: string; grams: number }[];
  total_weight_g: number;
  servings: number;
  serving_label: string;
}

export async function createRecipe(input: RecipeInput): Promise<{ food: UserFood; has_estimate: boolean }> {
  const res = await authFetch('/me/recipes', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
  });
  return expectOk<{ food: UserFood; has_estimate: boolean }>(res, "Couldn't save that recipe");
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
