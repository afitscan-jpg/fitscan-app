// src/lib/auth.ts
// Account auth on top of the anonymous-first Supabase session (see supabase.ts).
//
// The golden rule (auth-defer): a permanent account is an UPGRADE of the current
// anonymous user — same user.id, so all existing rows/RLS keep matching. We never
// route account creation through the "start fresh" wipe (signOut + fresh anon).
//   createAccount → supabase.auth.updateUser  (upgrade in place, data preserved)
//   signIn        → signInWithPassword         (SWITCHES to another account;
//                                               the current anon data is left behind)
//   signOutToAnonymous → signOut + ensureSession (the existing fresh-anon path)

import type { AuthError } from '@supabase/supabase-js';

import { ensureSession, supabase } from './supabase';

export interface AuthState {
  isAnonymous: boolean;
  email: string | null;
}

export type AuthErrorCode = 'email_taken' | 'invalid' | 'weak_password' | 'network' | 'unknown';

export type AuthResult =
  | { ok: true }
  | { ok: false; code: AuthErrorCode; message: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email.trim());
}

/**
 * Current account state. A permanent (upgraded) user has an email and
 * is_anonymous === false; an anonymous user has neither.
 */
export async function getAuthState(): Promise<AuthState> {
  const { data, error } = await supabase.auth.getUser();
  const user = data?.user ?? null;
  if (error || !user) {
    // No verified user yet — treat as anonymous (ensureSession will create one).
    return { isAnonymous: true, email: null };
  }
  const email = user.email ?? null;
  const isAnonymous = typeof user.is_anonymous === 'boolean' ? user.is_anonymous : !email;
  return { isAnonymous, email };
}

/**
 * Upgrade the CURRENT anonymous user into a permanent email account. Because it's
 * an in-place update, user.id is unchanged and every existing log/profile row
 * stays owned by the same user. If the email already belongs to another account
 * we can't merge — the caller should point the user to Sign In instead.
 */
export async function createAccount(email: string, password: string): Promise<AuthResult> {
  const { error } = await supabase.auth.updateUser({ email: email.trim(), password });
  return error ? mapError(error) : { ok: true };
}

/**
 * Sign in to an EXISTING account (e.g. on a new device). This SWITCHES sessions:
 * the current anonymous user's data is abandoned (expected for "I already have an
 * account"). UI copy must warn the user about this.
 */
export async function signIn(email: string, password: string): Promise<AuthResult> {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  return error ? mapError(error) : { ok: true };
}

/**
 * "Log out" — end the current session and start a fresh anonymous one. This is
 * the SAME path Settings' "start fresh" uses; it does NOT preserve data and is
 * only for deliberate sign-out. Never call this as part of account creation.
 */
export async function signOutToAnonymous(): Promise<void> {
  await supabase.auth.signOut();
  await ensureSession();
}

/** Best-effort password reset email (depends on email delivery being configured). */
export async function resetPassword(email: string): Promise<AuthResult> {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
  return error ? mapError(error) : { ok: true };
}

function mapError(error: AuthError): Extract<AuthResult, { ok: false }> {
  const code = error.code ?? '';
  const raw = error.message ?? '';
  const msg = raw.toLowerCase();

  if (code === 'email_exists' || code === 'user_already_exists' || msg.includes('already') || msg.includes('registered')) {
    return {
      ok: false,
      code: 'email_taken',
      message: "That email already has an account. Sign in instead — we can't merge two accounts.",
    };
  }
  if (code === 'weak_password' || msg.includes('password should be') || msg.includes('at least 6')) {
    return { ok: false, code: 'weak_password', message: 'Use a password of at least 6 characters.' };
  }
  if (code === 'invalid_credentials' || msg.includes('invalid login') || msg.includes('invalid credentials')) {
    return { ok: false, code: 'invalid', message: 'Email or password is incorrect.' };
  }
  if (msg.includes('network') || msg.includes('failed to fetch') || msg.includes('fetch')) {
    return { ok: false, code: 'network', message: 'Network error — please check your connection and try again.' };
  }
  return { ok: false, code: 'unknown', message: raw || 'Something went wrong — please try again.' };
}
