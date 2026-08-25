import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Reanimated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { CIcon } from '@/components/CalibretaIcon';
import { C, Radius, Shadow } from '@/constants/theme';

const FRAME_MS = 600;

/**
 * A looping exercise demo. free-exercise-db ships ~2 frames per exercise
 * (start / end position), so when we have ≥2 we cross-fade between the first two
 * on a gentle ping-pong to fake motion. With one image we show it static; with
 * none we show a premium placeholder. Images go through expo-image (disk+memory
 * cache). The animation only runs while mounted and is cancelled on unmount, and
 * it's disabled under Reduce Motion.
 */
export function ExerciseDemo({
  frames,
  thumbnail,
  style,
  height = 240,
  radius = Radius.lg,
}: {
  frames?: string[] | null;
  thumbnail?: string | null;
  style?: StyleProp<ViewStyle>;
  height?: number;
  radius?: number;
}) {
  const [reduceMotion, setReduceMotion] = useState(false);
  const t = useSharedValue(0);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
  }, []);

  // De-duplicated, non-empty frame list. Fall back to the thumbnail.
  const usable = Array.from(
    new Set((frames ?? []).map((f) => (f ?? '').trim()).filter(Boolean)),
  );
  const animate = usable.length >= 2 && !reduceMotion;
  const frameA = usable[0] ?? thumbnail ?? null;
  const frameB = usable[1] ?? null;

  useEffect(() => {
    if (!animate) return;
    t.value = 0;
    t.value = withRepeat(
      withTiming(1, { duration: FRAME_MS, easing: Easing.inOut(Easing.ease) }),
      -1,
      true, // reverse → smooth back-and-forth between the two poses
    );
    return () => cancelAnimation(t);
  }, [animate, t]);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: t.value }));

  return (
    <View style={[styles.card, { height, borderRadius: radius }, style]}>
      {animate && frameA && frameB ? (
        <>
          <Image
            source={{ uri: frameA }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={150}
          />
          <Reanimated.View style={[StyleSheet.absoluteFill, overlayStyle]}>
            <Image
              source={{ uri: frameB }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={150}
            />
          </Reanimated.View>
        </>
      ) : frameA ? (
        <Image
          source={{ uri: frameA }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={200}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.placeholder]}>
          <CIcon name="workout" color={C.inkFaint} size={40} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
    backgroundColor: '#EDEAE2', // warm base so images don't flash white while loading
    borderWidth: 1,
    borderColor: C.cardBorder,
    ...Shadow.md,
  },
  placeholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#EDEAE2' },
});
