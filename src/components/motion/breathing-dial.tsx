import { useEffect } from 'react';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { BrandMark } from '@/components/brand/brand-mark';
import { C } from '@/constants/theme';

// v2 §14 — the empty-state breathing dial: the one ambient element on an empty
// screen. The BrandMark scales 1→1.03 (≈1.8px on a 60px mark, < 8px) with a 2%
// opacity breathe — within the ambient caps. RELEASE-FRAGILITY: useAnimatedStyle
// on transform/opacity. Reduced motion: static, ambient OFF entirely.
export function BreathingDial({ size = 60, color = C.green }: { size?: number; color?: string }) {
  const s = useSharedValue(1);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (reduce) return;
    s.value = withRepeat(withTiming(1.03, { duration: 3000, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [reduce, s]);

  const aStyle = useAnimatedStyle(() => ({
    transform: [{ scale: reduce ? 1 : s.value }],
    // opacity 0.98→1 tracks the scale 1→1.03 (2% breathe).
    opacity: reduce ? 1 : 0.98 + ((s.value - 1) / 0.03) * 0.02,
  }));

  return (
    <Animated.View style={aStyle}>
      <BrandMark size={size} color={color} />
    </Animated.View>
  );
}
