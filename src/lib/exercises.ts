// src/lib/exercises.ts
// Typed access to the exercise catalog + logging backend.
//   listExercises / exerciseFilters → PUBLIC (plain fetch)
//   logExercise / getExerciseLogs   → AUTHENTICATED (authFetch adds the JWT)

import { authFetch } from './api';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';

export type ExerciseType = 'strength' | 'cardio' | 'mobility';

export interface Exercise {
  id: string;
  name: string;
  primary_muscle: string;
  secondary_muscles: string[] | null;
  equipment: string | null;
  difficulty: string | null;
  exercise_type: ExerciseType;
  video_url: string | null;
  thumbnail_url: string | null;
  instructions: string[] | null;
}

export interface ListExercisesParams {
  search?: string;
  muscle?: string;
  equipment?: string;
  limit?: number;
  offset?: number;
}

export async function listExercises(params: ListExercisesParams = {}): Promise<Exercise[]> {
  const q = new URLSearchParams();
  if (params.search?.trim()) q.set('search', params.search.trim());
  if (params.muscle?.trim()) q.set('muscle', params.muscle.trim());
  if (params.equipment?.trim()) q.set('equipment', params.equipment.trim());
  q.set('limit', String(params.limit ?? 30));
  q.set('offset', String(params.offset ?? 0));

  const res = await fetch(`${API_URL}/exercises?${q.toString()}`);
  if (!res.ok) throw new Error(`listExercises failed: ${res.status}`);
  const json: { exercises?: Exercise[] } = await res.json();
  return json.exercises ?? [];
}

export interface ExerciseFilters {
  muscles: string[];
  equipment: string[];
}

export async function exerciseFilters(): Promise<ExerciseFilters> {
  const res = await fetch(`${API_URL}/exercises/filters`);
  if (!res.ok) throw new Error(`exerciseFilters failed: ${res.status}`);
  const json: Partial<ExerciseFilters> = await res.json();
  return { muscles: json.muscles ?? [], equipment: json.equipment ?? [] };
}

export interface LogExerciseBody {
  exercise_id?: string | null;
  exercise_name: string;
  sets?: number | null;
  reps?: number | null;
  weight_kg?: number | null;
  duration_min?: number | null;
  distance_km?: number | null;
  notes?: string | null;
}

export async function logExercise(body: LogExerciseBody): Promise<void> {
  const res = await authFetch('/exercises/log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`logExercise failed: ${res.status}`);
}

export interface ExerciseLog {
  id: string;
  exercise_id: string | null;
  exercise_name: string;
  log_date: string;
  logged_at: string;
  sets: number | null;
  reps: number | null;
  weight_kg: number | null;
  duration_min: number | null;
  distance_km: number | null;
  notes: string | null;
}

export async function getExerciseLogs(date?: string): Promise<ExerciseLog[]> {
  const path = date ? `/exercises/logs?date=${encodeURIComponent(date)}` : '/exercises/logs';
  const res = await authFetch(path);
  if (!res.ok) throw new Error(`getExerciseLogs failed: ${res.status}`);
  const json: { logs?: ExerciseLog[] } = await res.json();
  return json.logs ?? [];
}
