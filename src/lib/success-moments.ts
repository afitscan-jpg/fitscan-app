// src/lib/success-moments.ts
// The two places Sprint 3 asks "did something good just happen?":
//   • a log landed            → afterLogSuccess()
//   • a weekly insight showed → afterWeeklyInsight()
// Each refreshes the home-screen widget (a log changed today's numbers) and
// gives the review prompt its chance, under review-prompt.ts's rules. Callers
// invoke these ONLY on the success path — never from a button, never in a
// catch block — which is what keeps "never after an error" true by construction.

import Constants from 'expo-constants';

import { getDataFootprint, getDailyTotals, getProfile, getTodayLog } from './db';
import { maybePromptReview } from './review-prompt';
import { refreshTodayWidget } from './widget';

function appVersion(): string {
  return Constants.expoConfig?.version ?? '0.0.0';
}

function localDate(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const countLogs = async () => (await getDataFootprint()).foodLogs;

/** Push today's totals to the widget. Safe anywhere; never throws. */
export async function syncWidgetFromDiary(): Promise<void> {
  try {
    const [totals, profile, log] = await Promise.all([getDailyTotals(), getProfile(), getTodayLog()]);
    await refreshTodayWidget({
      eatenKcal: totals.kcal,
      targetKcal: profile?.daily_target_kcal ?? null,
      items: totals.items,
      hasEstimate: log.some((i) => i.provenance === 'ai_estimate' || i.provenance === 'analog_estimate'),
      date: localDate(),
    });
  } catch {
    // widget is best-effort
  }
}

/** A log just landed. Widget first (fast, visible), then the review chance,
 *  after a short beat so the prompt never lands on top of the success tick. */
export async function afterLogSuccess(): Promise<void> {
  await syncWidgetFromDiary();
  setTimeout(() => { void maybePromptReview('log_success', countLogs, appVersion()); }, 1500);
}

/** A fresh weekly insight was just shown. */
export async function afterWeeklyInsight(): Promise<void> {
  setTimeout(() => { void maybePromptReview('weekly_insight', countLogs, appVersion()); }, 2500);
}
