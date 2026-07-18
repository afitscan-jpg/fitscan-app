// src/lib/entitlement.ts
// The user's plan/metering state, from the authenticated GET /me/entitlement.
// Drives the Home trial banner / usage chip / Premium badge and the Settings
// "Plan" row. This endpoint is NOT metered, so it never 402s.

import { authFetch } from './api';

export type PlanStatus = 'trial' | 'free' | 'premium';

export interface Entitlement {
  status: PlanStatus;
  trial_ends: string | null;   // YYYY-MM-DD
  ai_used_today: number;
  ai_limit: number;
  is_premium: boolean;
}

/** Fetch the caller's entitlement, or null on any failure (never throws). */
export async function getEntitlement(): Promise<Entitlement | null> {
  try {
    const res = await authFetch('/me/entitlement');
    if (!res.ok) return null;
    const json: Record<string, unknown> = await res.json();
    const status = json.status;
    return {
      status: status === 'trial' || status === 'premium' ? status : 'free',
      trial_ends: typeof json.trial_ends === 'string' ? json.trial_ends : null,
      ai_used_today: typeof json.ai_used_today === 'number' ? json.ai_used_today : 0,
      ai_limit: typeof json.ai_limit === 'number' ? json.ai_limit : 3,
      is_premium: json.is_premium === true,
    };
  } catch {
    return null;
  }
}

/** Whole days from today until the trial ends (0 once it's over). */
export function trialDaysLeft(trialEnds: string | null): number {
  if (!trialEnds) return 0;
  const [y, m, d] = trialEnds.split('-').map(Number);
  if (!y || !m || !d) return 0;
  const end = new Date(y, m - 1, d);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(0, Math.ceil((end.getTime() - today.getTime()) / 86_400_000));
}
