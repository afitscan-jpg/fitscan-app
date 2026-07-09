// src/lib/supabase.ts
// Supabase client for the Expo app.
//
// Add these to your app's .env (next to EXPO_PUBLIC_API_URL):
//   EXPO_PUBLIC_SUPABASE_URL=https://txfpuaxgjdnsepkopsfn.supabase.co
//   EXPO_PUBLIC_SUPABASE_ANON_KEY=<your anon/public key>
//
// Install deps:
//   npx expo install @supabase/supabase-js @react-native-async-storage/async-storage react-native-url-polyfill

import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn(
    '[supabase] Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY — check your .env',
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // not a web-redirect flow
  },
});

// Keep the access token fresh only while the app is in the foreground.
AppState.addEventListener('change', (state) => {
  if (state === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});

/**
 * Call once on app start (e.g. in your root layout).
 * If there's no session, signs the user in ANONYMOUSLY so the feed and
 * logging work with no account. When they later sign up, Supabase upgrades
 * this same anonymous user to a permanent one — their data carries over.
 *
 * Returns the user id.
 */
export async function ensureSession(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session?.user) return session.user.id;

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  return data.user!.id;
}
