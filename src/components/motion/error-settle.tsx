import { type ReactNode, useEffect } from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

// v2 §15 — a gentle error settle. One soft ~4px horizontal settle when an error
// view appears — an "unavailable" gesture, never a violent buzz. Fires once on
// mount (error states mount when the error appears). RELEASE-FRAGILITY:
// useAnimatedStyle on transform only. Reduced motion: a single opacity dip, no
// translate. No haptic — pairs with none.
export function ErrorSettle({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const x = useSharedValue(0);
  const o = useSharedValue(1);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (reduce) {
      o.value = withSequence(withTiming(0.6, { duration: 120 }), withTiming(1, { duration: 200 }));
    } else {
      x.value = withSequence(
        withTiming(-4, { duration: 60 }),
        withTiming(3, { duration: 70 }),
        withTiming(-2, { duration: 70 }),
        withTiming(0, { duration: 80 }),
      );
    }
  }, [reduce, x, o]);

  const aStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: reduce ? 0 : x.value }],
    opacity: o.value,
  }));

  return <Animated.View style={[style, aStyle]}>{children}</Animated.View>;
}
