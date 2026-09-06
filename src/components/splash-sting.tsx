// Calibreta launch sting — plays once over the ready app, then eases into Home.
// The C arc draws (strokeDashoffset), the needle sweeps onto the pivot (spring),
// the wordmark + tagline fade up, then the whole overlay cross-fades away.
// Skippable on tap. Reduced motion → static logo, fade only (no draw/sweep).
//
// The SVG draw/sweep run on legacy RN Animated (release-reliable); the view fades
// (overlay + text) stay on Reanimated useAnimatedStyle. useAnimatedProps on SVG
// does NOT update props in release on this stack (Reanimated 4 + Fabric) — see the
// release-fragility note in the motion implementation map.
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated as RNAnimated, Easing as RNEasing, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, G, Line, Path } from 'react-native-svg';

import {
  BRAND_ARC_D as ARC_D,
  BRAND_ARC_LEN as ARC_LEN,
  BRAND_CX as CX,
  BRAND_CY as CY,
  BRAND_NEEDLE_LEN as NEEDLE_LEN,
} from '@/components/brand/brand-geometry';
import { C, Fonts } from '@/constants/theme';

const AnimatedPath = RNAnimated.createAnimatedComponent(Path);
const AnimatedG = RNAnimated.createAnimatedComponent(G);

// Geometry (viewBox 120) is shared with BrandMark via brand-geometry.ts — the
// sting animates the exact same dial the static mark renders, so they can't drift.

// cb tokens
const cbOut = Easing.bezier(0.2, 0.7, 0.2, 1);

export function SplashSting({ onDone }: { onDone: () => void }) {
  const arcDraw = useRef(new RNAnimated.Value(0)).current;       // 0 → 1 draws the arc
  const needleAngle = useRef(new RNAnimated.Value(-42)).current; // -42° → 0° needle sweep
  const textT = useSharedValue(0);             // wordmark/tagline reveal (Reanimated)
  const overlay = useSharedValue(1);           // whole-screen cross-fade (Reanimated)
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);
  const done = useRef(false);

  const finish = () => {
    if (done.current) return;
    done.current = true;
    onDone();
  };

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then((r) => setReduceMotion(r))
      .catch(() => setReduceMotion(false));
  }, []);

  useEffect(() => {
    if (reduceMotion === null) return; // wait until we know the preference
    if (reduceMotion) {
      // Static fade only: show the finished mark, hold briefly, cross-fade out.
      arcDraw.setValue(1);
      needleAngle.setValue(0);
      textT.value = 1;
      overlay.value = withDelay(500, withTiming(0, { duration: 400 }, (fin) => {
        if (fin) runOnJS(finish)();
      }));
      return;
    }
    // Full sting: SVG draw/sweep on legacy Animated, view fades on Reanimated.
    RNAnimated.timing(arcDraw, { toValue: 1, duration: 800, easing: RNEasing.bezier(0.2, 0.7, 0.2, 1), useNativeDriver: false }).start();
    RNAnimated.spring(needleAngle, { toValue: 0, delay: 750, damping: 14, stiffness: 180, useNativeDriver: false }).start();
    textT.value = withDelay(1050, withTiming(1, { duration: 400, easing: cbOut }));
    overlay.value = withDelay(1500, withTiming(0, { duration: 400, easing: cbOut }, (fin) => {
      if (fin) runOnJS(finish)();
    }));
  }, [reduceMotion, arcDraw, needleAngle, textT, overlay]);

  const skip = () => {
    // Jump the mark to its finished state and fade out fast.
    arcDraw.setValue(1);
    needleAngle.setValue(0);
    textT.value = 1;
    overlay.value = withTiming(0, { duration: 180 }, (fin) => {
      if (fin) runOnJS(finish)();
    });
  };

  const overlayStyle = useAnimatedStyle(() => ({ opacity: overlay.value }));
  const textStyle = useAnimatedStyle(() => ({
    opacity: textT.value,
    transform: [{ translateY: (1 - textT.value) * 12 }],
  }));

  return (
    <Animated.View style={[styles.root, overlayStyle]} pointerEvents="box-none">
      <Pressable style={StyleSheet.absoluteFill} onPress={skip} accessibilityLabel="Skip intro" />
      <View style={styles.center} pointerEvents="none">
        <Svg width={128} height={128} viewBox="0 0 120 120">
          <AnimatedPath
            d={ARC_D}
            stroke={C.green}
            strokeWidth={9}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={ARC_LEN}
            strokeDashoffset={arcDraw.interpolate({ inputRange: [0, 1], outputRange: [ARC_LEN, 0] })}
          />
          <AnimatedG rotation={needleAngle} originX={CX} originY={CY}>
            <Line x1={CX} y1={CY} x2={CX} y2={CY - NEEDLE_LEN} stroke={C.green} strokeWidth={4} strokeLinecap="round" />
          </AnimatedG>
          <Circle cx={CX} cy={CY} r={4} fill={C.green} />
        </Svg>
        <Animated.View style={textStyle}>
          <Text style={styles.wordmark}>Calibreta</Text>
          <Text style={styles.tagline}>calibrated to you — never grading you</Text>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: C.bg,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  center: { alignItems: 'center' },
  wordmark: {
    fontFamily: Fonts?.display ?? 'system',
    fontSize: 30,
    color: C.ink,
    textAlign: 'center',
    letterSpacing: -0.4,
    marginTop: 18,
  },
  tagline: {
    fontFamily: Fonts?.body ?? 'system',
    fontSize: 13.5,
    color: C.inkSoft,
    textAlign: 'center',
    marginTop: 8,
  },
});
