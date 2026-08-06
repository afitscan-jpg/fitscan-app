// src/lib/reminders.ts
// LOCAL notifications for FitScan — reminders at moments of likely need, never
// accusations of absence. No push infra, no backend; everything is scheduled
// on-device with expo-notifications.
//
// Anti-guilt is a hard rule here: copy is invitational and forward-looking, never
// references what the user missed, and a user who ignores a reminder type 3 times
// in a row has that type auto-paused silently (nagging is churn dressed as
// retention). Silence is an acceptable outcome.
//
// Design:
//  • One-shot occurrences scheduled over a rolling HORIZON_DAYS window (not repeating
//    triggers) so suppression can skip an occurrence the user has already satisfied.
//  • Reschedule (cancel-all → recompute) on app-active and after a log; that also
//    re-derives every fire time in the current local timezone, so a tz change is
//    absorbed on the next sync.
//  • Auto-pause is inferred from elapsed app-opens: while the app is closed nothing
//    is suppressed, so the fire instants reconstructable from a type's schedule in
//    the (lastAppOpen → now] gap ARE the fires that happened. Opening within 4h of a
//    fire counts as engagement and resets that type's strikes.

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { getTodayLog, getWeekTotals } from './db';
import { getWeightLogs } from './weight';

// Show reminders as banners while the app is foregrounded; never a badge or sound.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export type ReminderType = 'meals' | 'weighIn' | 'weeklyInsight';

export interface ReminderSettings {
  meals: { enabled: boolean; lunch: string; dinner: string }; // "HH:MM" 24h
  weighIn: { enabled: boolean; days: number[]; time: string }; // days: 0=Sun … 6=Sat
  weeklyInsight: { enabled: boolean };
}

export interface ReminderMeta {
  permissionRequested: boolean;             // have we ever shown the OS prompt?
  nudgeDismissed: boolean;                  // user dismissed the 3rd-day Home nudge
  strikes: Record<ReminderType, number>;    // consecutive ignores
  paused: Record<ReminderType, boolean>;    // auto-paused types
  lastAppOpen: number | null;               // ms epoch of the previous app-active
  loggedDays: string[];                     // distinct local dates with ≥1 log (for the 3rd-day prompt)
}

const SETTINGS_KEY = 'reminders.settings.v1';
const META_KEY = 'reminders.meta.v1';
const CHANNEL_ID = 'reminders';

const IGNORE_WINDOW_MS = 4 * 60 * 60 * 1000; // "no app-open within 4h" = an ignore
const STRIKE_LIMIT = 3;                       // 3 consecutive ignores → auto-pause
const HORIZON_DAYS = 7;                        // schedule this many days ahead
const WEEKLY_MIN_DAYS = 4;                     // weekly insight only if ≥4 days logged

export const DEFAULT_SETTINGS: ReminderSettings = {
  meals: { enabled: true, lunch: '13:00', dinner: '20:30' },
  weighIn: { enabled: false, days: [1], time: '08:00' }, // Monday morning
  weeklyInsight: { enabled: false },
};

const DEFAULT_META: ReminderMeta = {
  permissionRequested: false,
  nudgeDismissed: false,
  strikes: { meals: 0, weighIn: 0, weeklyInsight: 0 },
  paused: { meals: false, weighIn: false, weeklyInsight: false },
  lastAppOpen: null,
  loggedDays: [],
};

// Copy — invitational, forward-looking. Never "you didn't…", never shame.
const COPY: Record<'lunch' | 'dinner' | 'weighIn' | 'weekly', { title: string; body: string }> = {
  lunch:   { title: 'Lunchtime 🥗',       body: 'Log it while it’s fresh?' },
  dinner:  { title: 'Evening check-in 🌙', body: 'How did today go? Log dinner while it’s fresh.' },
  weighIn: { title: 'Weigh-in day 🌱',     body: 'Morning weigh-in — trends beat single days.' },
  weekly:  { title: 'Your week in review', body: 'Your week in review is ready.' },
};

// ── Storage ───────────────────────────────────────────────────────────────────

export async function getReminderSettings(): Promise<ReminderSettings> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<ReminderSettings>;
    return {
      meals: { ...DEFAULT_SETTINGS.meals, ...parsed.meals },
      weighIn: { ...DEFAULT_SETTINGS.weighIn, ...parsed.weighIn },
      weeklyInsight: { ...DEFAULT_SETTINGS.weeklyInsight, ...parsed.weeklyInsight },
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

async function writeSettings(s: ReminderSettings): Promise<void> {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

export async function getReminderMeta(): Promise<ReminderMeta> {
  try {
    const raw = await AsyncStorage.getItem(META_KEY);
    if (!raw) return { ...DEFAULT_META };
    const parsed = JSON.parse(raw) as Partial<ReminderMeta>;
    return {
      ...DEFAULT_META,
      ...parsed,
      strikes: { ...DEFAULT_META.strikes, ...parsed.strikes },
      paused: { ...DEFAULT_META.paused, ...parsed.paused },
      loggedDays: parsed.loggedDays ?? [],
    };
  } catch {
    return { ...DEFAULT_META };
  }
}

async function writeMeta(m: ReminderMeta): Promise<void> {
  await AsyncStorage.setItem(META_KEY, JSON.stringify(m));
}

// ── Small date/time helpers (local, mirrors db.ts localDate) ───────────────────

function localDate(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function parseHM(s: string): { h: number; m: number } {
  const [h, m] = s.split(':').map((x) => parseInt(x, 10));
  return { h: Number.isFinite(h) ? h : 0, m: Number.isFinite(m) ? m : 0 };
}

function atTime(base: Date, h: number, m: number): Date {
  const d = new Date(base);
  d.setHours(h, m, 0, 0);
  return d;
}

/** "13:00" → "1:00 PM" for display. */
export function formatTime12(hm: string): string {
  const { h, m } = parseHM(hm);
  const period = h >= 12 ? 'PM' : 'AM';
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}:${String(m).padStart(2, '0')} ${period}`;
}

/** Step a "HH:MM" by minutes, wrapping within a day. */
export function stepTime(hm: string, deltaMin: number): string {
  const { h, m } = parseHM(hm);
  let total = (h * 60 + m + deltaMin) % (24 * 60);
  if (total < 0) total += 24 * 60;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

// The scheduled fire instants of a type on a given calendar day (empty when none).
function instantsOnDay(s: ReminderSettings, type: ReminderType, day: Date): Date[] {
  if (type === 'meals') {
    const l = parseHM(s.meals.lunch);
    const d = parseHM(s.meals.dinner);
    return [atTime(day, l.h, l.m), atTime(day, d.h, d.m)];
  }
  if (type === 'weighIn') {
    if (!s.weighIn.days.includes(day.getDay())) return [];
    const t = parseHM(s.weighIn.time);
    return [atTime(day, t.h, t.m)];
  }
  // weeklyInsight — Sunday 19:00 (the ≥4-day gate is applied at schedule time, not here).
  if (day.getDay() === 0) return [atTime(day, 19, 0)];
  return [];
}

function isTypeEnabled(s: ReminderSettings, type: ReminderType): boolean {
  return type === 'meals' ? s.meals.enabled
    : type === 'weighIn' ? s.weighIn.enabled
    : s.weeklyInsight.enabled;
}

// ── Suppression reads (reuse existing helpers only) ────────────────────────────

async function mealsLoggedToday(): Promise<{ lunch: boolean; dinner: boolean }> {
  try {
    const log = await getTodayLog();
    return {
      lunch: log.some((r) => r.meal_type === 'lunch'),
      dinner: log.some((r) => r.meal_type === 'dinner'),
    };
  } catch {
    return { lunch: false, dinner: false }; // can't confirm → don't suppress
  }
}

async function weightLoggedToday(): Promise<boolean> {
  try {
    const { logs } = await getWeightLogs('week');
    return logs.some((l) => l.log_date === localDate());
  } catch {
    return false;
  }
}

async function loggedDaysThisWeek(): Promise<number> {
  try {
    const week = await getWeekTotals(); // last 7 days incl. today
    const now = new Date();
    const sunday = new Date(now);
    sunday.setDate(now.getDate() - now.getDay());
    const sunStr = localDate(sunday);
    return week.filter((d) => d.items > 0 && d.log_date >= sunStr).length;
  } catch {
    return 0;
  }
}

// ── Permission ─────────────────────────────────────────────────────────────────

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Reminders',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

export async function getPermissionStatus(): Promise<Notifications.NotificationPermissionsStatus> {
  return Notifications.getPermissionsAsync();
}

/**
 * Ask for notification permission (from Settings > Reminders, or the 3rd-day nudge).
 * Marks that we've asked so the 3rd-day nudge never re-appears. On grant it sets up
 * the channel and schedules. Denial is respected — we don't loop the OS prompt.
 */
export async function requestRemindersPermission(): Promise<Notifications.PermissionStatus> {
  const meta = await getReminderMeta();
  const current = await Notifications.getPermissionsAsync();
  let status = current.status;
  if (status !== 'granted' && current.canAskAgain) {
    const req = await Notifications.requestPermissionsAsync();
    status = req.status;
  }
  meta.permissionRequested = true;
  meta.nudgeDismissed = true;
  await writeMeta(meta);
  if (status === 'granted') {
    await ensureAndroidChannel();
    await syncReminders();
  }
  return status;
}

// ── Scheduling ─────────────────────────────────────────────────────────────────

// Serialize reschedules so an app-active sync and an after-log sync can't interleave
// their cancel-all / schedule calls.
let chain: Promise<void> = Promise.resolve();
function serial(fn: () => Promise<void>): Promise<void> {
  chain = chain.then(fn, fn);
  return chain;
}

async function rescheduleAll(): Promise<void> {
  const perm = await Notifications.getPermissionsAsync();
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (perm.status !== 'granted') return; // nothing scheduled until permitted
  await ensureAndroidChannel();

  const [settings, meta] = await Promise.all([getReminderSettings(), getReminderMeta()]);
  const now = new Date();
  const nowMs = now.getTime();

  const jobs: { date: Date; type: ReminderType; title: string; body: string }[] = [];

  // Meals — lunch + dinner over the horizon; today's are suppressed if already logged.
  if (settings.meals.enabled && !meta.paused.meals) {
    const { lunch: lunchLogged, dinner: dinnerLogged } = await mealsLoggedToday();
    const l = parseHM(settings.meals.lunch);
    const d = parseHM(settings.meals.dinner);
    for (let off = 0; off < HORIZON_DAYS; off++) {
      const day = new Date(now);
      day.setDate(now.getDate() + off);
      const isToday = off === 0;
      const lunchAt = atTime(day, l.h, l.m);
      if (lunchAt.getTime() > nowMs && !(isToday && lunchLogged)) {
        jobs.push({ date: lunchAt, type: 'meals', ...COPY.lunch });
      }
      const dinnerAt = atTime(day, d.h, d.m);
      if (dinnerAt.getTime() > nowMs && !(isToday && dinnerLogged)) {
        jobs.push({ date: dinnerAt, type: 'meals', ...COPY.dinner });
      }
    }
  }

  // Weigh-in — chosen weekdays; today's suppressed if already weighed in.
  if (settings.weighIn.enabled && !meta.paused.weighIn && settings.weighIn.days.length > 0) {
    const weighedToday = await weightLoggedToday();
    const t = parseHM(settings.weighIn.time);
    for (let off = 0; off < HORIZON_DAYS; off++) {
      const day = new Date(now);
      day.setDate(now.getDate() + off);
      if (!settings.weighIn.days.includes(day.getDay())) continue;
      const at = atTime(day, t.h, t.m);
      const isToday = off === 0;
      if (at.getTime() > nowMs && !(isToday && weighedToday)) {
        jobs.push({ date: at, type: 'weighIn', ...COPY.weighIn });
      }
    }
  }

  // Weekly insight — upcoming Sunday 19:00, only if the week already has ≥4 logged days.
  if (settings.weeklyInsight.enabled && !meta.paused.weeklyInsight) {
    if ((await loggedDaysThisWeek()) >= WEEKLY_MIN_DAYS) {
      for (let off = 0; off < HORIZON_DAYS; off++) {
        const day = new Date(now);
        day.setDate(now.getDate() + off);
        if (day.getDay() !== 0) continue;
        const at = atTime(day, 19, 0);
        if (at.getTime() > nowMs) { jobs.push({ date: at, type: 'weeklyInsight', ...COPY.weekly }); break; }
      }
    }
  }

  await Promise.all(
    jobs.map((j) =>
      Notifications.scheduleNotificationAsync({
        content: { title: j.title, body: j.body, data: { type: j.type }, sound: false },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: j.date, channelId: CHANNEL_ID },
      }),
    ),
  );
}

/** Reschedule to apply suppression after a log (or any change). Safe to over-call. */
export function syncReminders(): Promise<void> {
  return serial(rescheduleAll);
}

// ── Auto-pause accounting + the app-active entry point ─────────────────────────

function endOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

// Latest fire instant ≤ now (look back 2 days) — for the "opened within 4h" check.
function mostRecentFireBefore(s: ReminderSettings, type: ReminderType, nowMs: number): number | null {
  let best: number | null = null;
  const cur = new Date(nowMs);
  cur.setHours(0, 0, 0, 0);
  for (let i = 0; i <= 2; i++) {
    for (const inst of instantsOnDay(s, type, cur)) {
      const t = inst.getTime();
      if (t <= nowMs && (best === null || t > best)) best = t;
    }
    cur.setDate(cur.getDate() - 1);
  }
  return best;
}

// Count fire instants in (fromMs, toMs], capped at STRIKE_LIMIT (we only need ≥3).
// Bounded lookback of 14 days keeps this cheap for a long-absent user.
function firesBetween(s: ReminderSettings, type: ReminderType, fromMs: number, toMs: number): number {
  let count = 0;
  const cur = new Date(Math.max(fromMs, toMs - 14 * 864e5));
  cur.setHours(0, 0, 0, 0);
  const to = new Date(toMs);
  while (cur <= to && count < STRIKE_LIMIT) {
    for (const inst of instantsOnDay(s, type, cur)) {
      const t = inst.getTime();
      if (t > fromMs && t <= toMs) count++;
    }
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

async function recordLoggedDay(meta: ReminderMeta): Promise<void> {
  try {
    const log = await getTodayLog();
    const today = localDate();
    if (log.length > 0 && !meta.loggedDays.includes(today)) {
      meta.loggedDays.push(today);
      if (meta.loggedDays.length > 10) meta.loggedDays = meta.loggedDays.slice(-10);
    }
  } catch {
    // no signal → leave loggedDays as-is
  }
}

/**
 * Call when the app becomes active (foreground). Resolves ignore strikes / auto-pause,
 * records today's log for the 3rd-day nudge, then reschedules. Never throws.
 */
export async function onRemindersAppActive(): Promise<void> {
  try {
    const [settings, meta] = await Promise.all([getReminderSettings(), getReminderMeta()]);
    const nowMs = Date.now();
    const perm = await Notifications.getPermissionsAsync();

    if (perm.status === 'granted' && meta.lastAppOpen != null) {
      const types: ReminderType[] = ['meals', 'weighIn', 'weeklyInsight'];
      for (const type of types) {
        if (!isTypeEnabled(settings, type) || meta.paused[type]) continue;
        const recent = mostRecentFireBefore(settings, type, nowMs);
        if (recent != null && nowMs - recent <= IGNORE_WINDOW_MS) {
          meta.strikes[type] = 0; // opened within 4h of a fire → engaged; reset
          continue;
        }
        // Exclude the lastAppOpen calendar day (its same-day fires may have been
        // suppressed while the app was open); count only fires on later days.
        const ignores = firesBetween(settings, type, endOfDay(meta.lastAppOpen), nowMs);
        if (ignores > 0) {
          meta.strikes[type] += ignores;
          if (meta.strikes[type] >= STRIKE_LIMIT) meta.paused[type] = true; // quiet auto-pause
        }
      }
    }

    meta.lastAppOpen = nowMs;
    await recordLoggedDay(meta);
    await writeMeta(meta);

    await syncReminders();
  } catch (e) {
    console.warn('[reminders] onActive error', e);
  }
}

// ── Settings-screen API ────────────────────────────────────────────────────────

/** Persist a settings patch and reschedule. */
export async function updateReminderSettings(patch: Partial<ReminderSettings>): Promise<ReminderSettings> {
  const cur = await getReminderSettings();
  const next: ReminderSettings = {
    meals: { ...cur.meals, ...patch.meals },
    weighIn: { ...cur.weighIn, ...patch.weighIn },
    weeklyInsight: { ...cur.weeklyInsight, ...patch.weeklyInsight },
  };
  await writeSettings(next);
  await syncReminders();
  return next;
}

/** Turn a type back on after an auto-pause (clears the pause + its strikes). */
export async function resumeReminderType(type: ReminderType): Promise<ReminderMeta> {
  const meta = await getReminderMeta();
  meta.paused[type] = false;
  meta.strikes[type] = 0;
  await writeMeta(meta);
  await syncReminders();
  return meta;
}

// ── 3rd-day Home nudge ──────────────────────────────────────────────────────────

/** True when we should gently offer reminders on Home: ≥3 logged days, never asked,
 *  never dismissed, and the OS permission is still undetermined. */
export async function shouldOfferRemindersNudge(): Promise<boolean> {
  const meta = await getReminderMeta();
  if (meta.permissionRequested || meta.nudgeDismissed) return false;
  if (meta.loggedDays.length < 3) return false;
  const perm = await Notifications.getPermissionsAsync();
  return perm.status === 'undetermined';
}

/** User tapped "Not now" on the nudge — never auto-offer again (Settings still can). */
export async function dismissRemindersNudge(): Promise<void> {
  const meta = await getReminderMeta();
  meta.nudgeDismissed = true;
  await writeMeta(meta);
}
