import { type ReactNode, useEffect } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

/**
 * Wraps skeleton content in a soft, looping opacity pulse (0.5 → 1) so loading
 * placeholders breathe instead of sitting as static gray.
 */
export function SkeletonPulse({ style, children }: { style?: StyleProp<ViewStyle>; children?: ReactNode }) {
  const o = useSharedValue(0.5);

  useEffect(() => {
    o.value = withRepeat(
      withTiming(1, { duration: 550, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [o]);

  const a = useAnimatedStyle(() => ({ opacity: o.value }));

  return <Animated.View style={[style, a]}>{children}</Animated.View>;
}
