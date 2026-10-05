// src/lib/account-delete.ts
// Permanent account deletion (AUDIT_PRODUCTION.md B4), client half.
//
// The server (DELETE /me) answers with what actually happened, and this module
// keeps those answers apart all the way to the screen. Deleting an account is
// the one action where "probably worked" is not an acceptable thing to say:
//
//   deleted  — the account and its data are gone
//   failed   — the server refused; NOTHING was deleted
//   unknown  — we never heard back, so we do not know. Retrying is safe.
//   partial  — the account is gone but some rows could not be removed. Cannot
//              happen with migration_026 applied; if it ever does, the user is
//              told, not reassured.
//
// Only after 'deleted' (or 'partial') is anything on the device cleared.

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

import { authFetch } from './api';
import { deleteAllPhotos } from './progress-photos';
import { ensureSession, supabase } from './supabase';

export type DeleteOutcome =
  | { kind: 'deleted' }
  | { kind: 'failed'; message: string }
  | { kind: 'unknown'; message: string }
  | { kind: 'partial'; message: string };

const MSG_FAILED =
  "We couldn't delete your account. Nothing was deleted — your account and logs are unchanged. Please try again.";
const MSG_UNKNOWN =
  "We couldn't confirm whether your account was deleted. Check your connection and try again — trying again is safe.";
const MSG_PARTIAL =
  'Your account was deleted, but some of its data could not be removed automatically. Please contact support so we can remove it.';

function serverMessage(body: unknown, fallback: string): string {
  if (body && typeof body === 'object') {
    const m = (body as { message?: unknown }).message;
    if (typeof m === 'string' && m.trim()) return m;
  }
  return fallback;
}

/**
 * A 401 on this call has two very different causes: an ordinary expired token,
 * or an account that an earlier attempt already deleted (its token can no longer
 * be refreshed). Ask Supabase which. Returns true only when it says the user
 * does not exist.
 */
async function accountIsGone(): Promise<boolean> {
  try {
    const { error } = await supabase.auth.getUser();
    if (!error) return false;
    const msg = (error.message ?? '').toLowerCase();
    return (
      error.status === 403 ||
      error.status === 404 ||
      msg.includes('does not exist') ||
      msg.includes('user not found')
    );
  } catch {
    return false;
  }
}

export async function deleteAccount(): Promise<DeleteOutcome> {
  let res: Response;
  try {
    res = await authFetch('/me', { method: 'DELETE' });
  } catch {
    // Timeout or no network: the request may or may not have landed.
    return { kind: 'unknown', message: MSG_UNKNOWN };
  }

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  const deleted =
    body && typeof body === 'object' ? (body as { deleted?: unknown }).deleted : undefined;
  const dataRemoved =
    body && typeof body === 'object' ? (body as { data_removed?: unknown }).data_removed : undefined;

  if (res.status === 200 && deleted === true) return { kind: 'deleted' };
  if (deleted === true && dataRemoved === false) {
    return { kind: 'partial', message: serverMessage(body, MSG_PARTIAL) };
  }
  if (res.status === 401) {
    return (await accountIsGone())
      ? { kind: 'deleted' }
      : { kind: 'unknown', message: MSG_UNKNOWN };
  }
  if (deleted === false) return { kind: 'failed', message: serverMessage(body, MSG_FAILED) };
  // 503 unconfirmed, or any answer that does not say which way it went.
  return { kind: 'unknown', message: serverMessage(body, MSG_UNKNOWN) };
}

/**
 * After a confirmed deletion: remove what this phone still holds for the old
 * account, then start a fresh anonymous session. Each step is independent — a
 * failure in one must not leave the rest behind — and none of them can turn a
 * completed deletion into an error.
 */
export async function resetDeviceAfterDeletion(): Promise<void> {
  // Progress photos never left the device, so the server-side delete did not
  // touch them. "Every log, permanently" includes these.
  try {
    await deleteAllPhotos();
  } catch {
    // best-effort
  }
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {
    // best-effort
  }
  // The server-side session died with the account, so only the local copy needs
  // dropping; a global sign-out would just fail against a user that is gone.
  try {
    await supabase.auth.signOut({ scope: 'local' });
  } catch {
    // best-effort
  }
  // Cached plan, reminder settings and preferences belonged to the old account.
  try {
    await AsyncStorage.clear();
  } catch {
    // best-effort
  }
  try {
    await ensureSession();
  } catch {
    // Offline right after deleting: the next request creates the session.
  }
}
