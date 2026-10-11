// src/lib/review-prompt.ts
// The in-app review prompt (Sprint 3). Pure decision + a thin trigger.
//
// RULES (the product decision, verbatim):
//   • only at a SUCCESS moment: a log just landed, or a weekly insight was just
//     shown — never from a button, never after an error
//   • only once the app has earned it: day 3+ since first open AND 5+ logs
//   • rarely: at most once per 90 days and once per app version, and at most
//     once per app session (a backup against a success-moment loop)
//
// Everything that decides is in shouldPromptReview(), which takes plain values
// and returns a boolean, so it is checked offline (tests/review-prompt.test).
// The trigger wraps it with storage and the store API, and swallows every
// failure: a review prompt that cannot show is not an error anyone should see.

import AsyncStorage from '@react-native-async-storage/async-storage';

export const MIN_DAYS_SINCE_FIRST_OPEN = 3;
export const MIN_LOGS = 5;
export const MIN_DAYS_BETWEEN_PROMPTS = 90;

export type ReviewMoment = 'log_success' | 'weekly_insight';

export interface ReviewState {
  firstOpenAt: string | null;      // ISO
  lastPromptAt: string | null;     // ISO
  lastPromptVersion: string | null;
}

export interface ReviewInput {
  state: ReviewState;
  now: Date;
  totalLogs: number;
  appVersion: string;
  /** The moment this is being asked at. Only success moments ever get here;
   *  the type exists so a caller cannot pass "after error" by accident. */
  moment: ReviewMoment;
  promptedThisSession: boolean;
}

const DAY_MS = 86_400_000;

export function shouldPromptReview(i: ReviewInput): boolean {
  if (i.promptedThisSession) return false;
  if (!i.state.firstOpenAt) return false;
  const first = Date.parse(i.state.firstOpenAt);
  if (!Number.isFinite(first)) return false;
  if (i.now.getTime() - first < MIN_DAYS_SINCE_FIRST_OPEN * DAY_MS) return false;
  if (i.totalLogs < MIN_LOGS) return false;
  if (i.state.lastPromptVersion && i.state.lastPromptVersion === i.appVersion) return false;
  if (i.state.lastPromptAt) {
    const last = Date.parse(i.state.lastPromptAt);
    if (Number.isFinite(last) && i.now.getTime() - last < MIN_DAYS_BETWEEN_PROMPTS * DAY_MS) return false;
  }
  return i.moment === 'log_success' || i.moment === 'weekly_insight';
}

// ── storage ──────────────────────────────────────────────────────────────────

const KEY = 'calibreta:review:v1';

export async function loadReviewState(): Promise<ReviewState> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw) as Partial<ReviewState>;
      return {
        firstOpenAt: typeof s.firstOpenAt === 'string' ? s.firstOpenAt : null,
        lastPromptAt: typeof s.lastPromptAt === 'string' ? s.lastPromptAt : null,
        lastPromptVersion: typeof s.lastPromptVersion === 'string' ? s.lastPromptVersion : null,
      };
    }
  } catch {
    // unreadable → treat as fresh
  }
  return { firstOpenAt: null, lastPromptAt: null, lastPromptVersion: null };
}

async function saveReviewState(s: ReviewState): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // best-effort
  }
}

/** Call once per app start: records the first open if not yet recorded. */
export async function noteAppOpened(now = new Date()): Promise<void> {
  const s = await loadReviewState();
  if (!s.firstOpenAt) await saveReviewState({ ...s, firstOpenAt: now.toISOString() });
}

let promptedThisSession = false;

/**
 * Ask for a review if, and only if, the rules allow it right now. `countLogs`
 * is supplied by the caller so this module stays free of the data layer.
 * Resolves true when the store prompt was requested.
 */
export async function maybePromptReview(
  moment: ReviewMoment,
  countLogs: () => Promise<number>,
  appVersion: string,
  now = new Date(),
): Promise<boolean> {
  try {
    const state = await loadReviewState();
    // Cheap checks first; the log count is a network read.
    if (!shouldPromptReview({ state, now, totalLogs: Number.MAX_SAFE_INTEGER, appVersion, moment, promptedThisSession })) {
      return false;
    }
    const totalLogs = await countLogs();
    if (!shouldPromptReview({ state, now, totalLogs, appVersion, moment, promptedThisSession })) return false;

    const StoreReview = await import('expo-store-review');
    if (!(await StoreReview.isAvailableAsync())) return false;
    promptedThisSession = true;
    await saveReviewState({ ...state, lastPromptAt: now.toISOString(), lastPromptVersion: appVersion });
    await StoreReview.requestReview();
    return true;
  } catch {
    return false;
  }
}
