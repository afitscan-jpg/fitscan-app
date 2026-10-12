// src/components/waking-banner.tsx
// "Waking up — a moment" (AUDIT_PRODUCTION.md B3).
//
// Shown only while backend-health says the server is waking from sleep. It is a
// status, not an error: no red, no "check your connection", no retry button —
// there is nothing for the user to do but wait, and the request they made is
// already waiting for them (api.ts gives it the full cold-start budget).
//
// Plain View + conditional render on purpose: no entering/exiting animation, so
// nothing here can add to the release-build animation crashes this app has had.

import { useEffect, useState } from 'react';
import { ActivityIndicator, AppState, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { C, Fonts } from '@/constants/theme';
import {
  getBackendState,
  pingBackend,
  subscribeBackendState,
  type BackendState,
} from '@/lib/backend-health';

export function WakingBanner() {
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<BackendState>(getBackendState());

  useEffect(() => subscribeBackendState(setState), []);

  // Ping on launch and whenever the app comes back to the foreground — the two
  // moments a sleeping server is discovered.
  useEffect(() => {
    void pingBackend();
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') void pingBackend();
    });
    return () => sub.remove();
  }, []);

  if (state !== 'waking') return null;

  return (
    <View
      style={[s.wrap, { top: insets.top + 6 }]}
      pointerEvents="none"
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <View style={s.pill}>
        <ActivityIndicator size="small" color={C.green} />
        <Text style={s.text}>Waking up — a moment…</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 50 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: C.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.line,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  text: { fontFamily: Fonts?.bodyMed ?? 'system', fontSize: 14, color: C.ink },
});
