// src/components/toast.tsx
// One app-wide, non-blocking way to say "that didn't save".
//
// WHY THIS EXISTS: several optimistic mutations swallowed their errors entirely
// (`catch { /* ignore */ }`), so tapping +250 ml offline moved the UI and then
// silently did nothing — the user's most likely response is to tap again, which
// is exactly wrong for a write. Alert.alert was the only surfacing mechanism in
// the app and it is modal, which is too heavy for "your tap didn't land".
//
// Deliberately plain: it reports a fact, it never blames the user, and it uses
// the amber/ink palette rather than red — a failed save is our problem to state,
// not the user's mistake.

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { C, Fonts, Radius, Shadow } from '@/constants/theme';

type ShowToast = (message: string) => void;

const ToastContext = createContext<ShowToast>(() => {});

/** Show a transient failure message. Safe to call from anywhere under the provider. */
export function useToast(): ShowToast {
  return useContext(ToastContext);
}

const VISIBLE_MS = 3600;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const insets = useSafeAreaInsets();
  const opacity = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback<ShowToast>((next) => {
    setMessage(next);
    // Screen-reader users get nothing from a visual toast appearing.
    AccessibilityInfo.announceForAccessibility?.(next);
  }, []);

  useEffect(() => {
    if (!message) return;
    Animated.timing(opacity, {
      toValue: 1, duration: 180, easing: Easing.out(Easing.quad), useNativeDriver: true,
    }).start();
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0, duration: 220, easing: Easing.in(Easing.quad), useNativeDriver: true,
      }).start(({ finished }) => { if (finished) setMessage(null); });
    }, VISIBLE_MS);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [message, opacity]);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {message ? (
        <Animated.View
          pointerEvents="none"
          style={[s.wrap, { opacity, bottom: insets.bottom + 96 }]}
          accessibilityLiveRegion="polite"
        >
          <View style={s.card}>
            <Text style={s.text}>{message}</Text>
          </View>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

const s = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, alignItems: 'center' },
  card: {
    backgroundColor: C.ink,
    borderRadius: Radius.md,
    paddingHorizontal: 16,
    paddingVertical: 12,
    maxWidth: 520,
    ...Shadow.md,
  },
  text: {
    fontFamily: Fonts?.body ?? 'system',
    fontSize: 13.5,
    lineHeight: 19,
    color: '#fff',
    textAlign: 'center',
  },
});
