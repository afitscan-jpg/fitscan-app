import { type ReactNode, useEffect, useState } from 'react';
import { StyleSheet, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

/**
 * v2 §13 — warm skeleton shimmer. A white highlight band sweeps across the block
 * via translateX (transform only — NOT background-position, which does not
 * animate on native). RELEASE-FRAGILITY: useAnimatedStyle on transform/opacity;
 * the sweep rides a regular native view (expo-linear-gradient), never SVG /
 * useAnimatedProps / entering-exiting. Reduced motion: no sweep — a slow, warm
 * opacity breathe instead. API is unchanged, so every existing skeleton site
 * inherits the sweep with no edit.
 *
 * The animated transform rides a plain Animated.View; the gradient is a static
 * fill inside it (rather than an animated gradient component) — one less native
 * component in the animation path.
 */
export function SkeletonPulse({ style, children }: { style?: StyleProp<ViewStyle>; children?: ReactNode }) {
  const reduce = useReducedMotion();
  const o = useSharedValue(0.6);
  const x = useSharedValue(0);
  const [w, setW] = useState(0);

  useEffect(() => {
    if (reduce) {
      // Warm breathe, no transform.
      o.value = 0.55;
      o.value = withRepeat(withTiming(0.85, { duration: 1800, easing: Easing.inOut(Easing.quad) }), -1, true);
    } else {
      o.value = 1;
      x.value = 0;
      x.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.ease) }), -1, false);
    }
  }, [reduce, o, x]);

  const bandW = w * 0.5;
  const wrapStyle = useAnimatedStyle(() => ({ opacity: reduce ? o.value : 1 }));
  // Sweep from fully-left (-bandW) to fully-right (w), off-screen at both ends.
  const bandStyle = useAnimatedStyle(() => ({ transform: [{ translateX: -bandW + x.value * (w + bandW) }] }));

  const onLayout = (e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width);

  return (
    <Animated.View style={[style, sk.clip, wrapStyle]} onLayout={onLayout}>
      {children}
      {!reduce && w > 0 ? (
        <Animated.View pointerEvents="none" style={[sk.band, { width: bandW }, bandStyle]}>
          <LinearGradient
            // White, not a sage tint: the skeleton fills (#EFEAE1, C.line over cream)
            // sit within ~5/255 of a sage band, which made the sweep invisible on device.
            colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.6)', 'rgba(255,255,255,0)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

const sk = StyleSheet.create({
  clip: { overflow: 'hidden' },
  band: { position: 'absolute', top: 0, bottom: 0, left: 0 },
});
