import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Reanimated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Gradients } from '@/constants/theme';

/**
 * v3's "morning light" ambient wash: a soft top-anchored cream gradient with two
 * faint wellness-tinted glows (sage + warm sand) approximating the html's organic
 * blobs. Purely decorative — absolutely positioned behind screen content, never
 * intercepts touches. Blob blur is approximated with large translucent radials
 * (soft, low-opacity) since RN has no view blur without a native lib.
 *
 * Fluid layer: the two blobs drift on slow, offset loops (≤8px, 11s / 13s),
 * disabled entirely under reduced motion.
 */
export function AmbientBackground() {
  const reduced = useReducedMotion();
  const t1 = useSharedValue(0);
  const t2 = useSharedValue(0);

  useEffect(() => {
    if (reduced) return;
    t1.value = withRepeat(withTiming(1, { duration: 11000, easing: Easing.inOut(Easing.sin) }), -1, true);
    t2.value = withRepeat(withTiming(1, { duration: 13000, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [reduced, t1, t2]);

  const sageStyle = useAnimatedStyle(() => {
    if (reduced) return {};
    return {
      transform: [
        { translateX: (t1.value - 0.5) * 12 }, // ±6px
        { translateY: (t1.value - 0.5) * -10 }, // ∓5px
        { scale: 1 + t1.value * 0.04 },
      ],
    };
  });
  const sandStyle = useAnimatedStyle(() => {
    if (reduced) return {};
    return {
      transform: [
        { translateX: (0.5 - t2.value) * 14 }, // ±7px, opposite phase
        { translateY: (t2.value - 0.5) * 12 }, // ±6px
        { scale: 1 + (1 - t2.value) * 0.04 },
      ],
    };
  });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient
        colors={Gradients.ambient}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Reanimated.View style={[styles.blobSage, sageStyle]} />
      <Reanimated.View style={[styles.blobSand, sandStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  blobSage: {
    position: 'absolute',
    top: -120,
    right: -90,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(196,214,178,0.28)',
  },
  blobSand: {
    position: 'absolute',
    bottom: 80,
    left: -110,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(233,204,166,0.22)',
  },
});
