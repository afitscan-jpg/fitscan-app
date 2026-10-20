import { type ReactNode, useEffect } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { C } from '@/constants/theme';

// v2 §14 — the one ambient element on an empty screen: whatever it wraps breathes,
// scale 1.0 → 1.04 with a soft sage halo that swells and fades with it, 3 s in /
// 3 s out, looping while `active`.
//
// Amplitude, deliberately: the first port used 1.03 + a 2% opacity breathe, which
// is ~1.8 px on a 60 px mark and could not be seen on a real screen (the same
// class of miss as the skeleton band). 1.04 is ~6 px on the 148 px Home ring,
// inside the ≤ 8 px ambient cap, and the halo gives the eye a second cue.
// RELEASE-FRAGILITY: useAnimatedStyle on transform/opacity of plain Views; the
// child (an SVG ring or mark) is untouched. Reduced motion: static, no loop.
export function Breathe({
  active = true,
  halo = true,
  haloInset = -8,
  haloPeak = 0.16,
  style,
  children,
}: {
  /** Loop while true; settles back to rest (300 ms) when false. */
  active?: boolean;
  /** Draw the sage halo behind the child. */
  halo?: boolean;
  /** Halo margin; negative extends it past the child (a glow around a ring). */
  haloInset?: number;
  /** Halo opacity at full breath. */
  haloPeak?: number;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const t = useSharedValue(0); // 0 = rest, 1 = full breath
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!active || reduce) {
      cancelAnimation(t);
      t.value = withTiming(0, { duration: 300 });
      return;
    }
    t.value = 0;
    t.value = withRepeat(withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.sin) }), -1, true);
    return () => cancelAnimation(t);
  }, [active, reduce, t]);

  const scaleStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 + 0.04 * t.value }] }));
  const haloStyle = useAnimatedStyle(() => ({
    opacity: haloPeak * t.value,
    transform: [{ scale: 1 + 0.08 * t.value }],
  }));

  return (
    <Animated.View style={[style, scaleStyle]}>
      {halo ? <Animated.View pointerEvents="none" style={[st.halo, { margin: haloInset }, haloStyle]} /> : null}
      {children}
    </Animated.View>
  );
}

const st = StyleSheet.create({
  halo: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, borderRadius: 999, backgroundColor: C.green },
});
