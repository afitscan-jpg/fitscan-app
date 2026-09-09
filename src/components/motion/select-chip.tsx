import { useEffect, type ReactNode } from 'react';
import { StyleSheet, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { AnimatedPressable } from '@/components/animated-pressable';
import { C } from '@/constants/theme';

const CB_OUT = Easing.bezier(0.2, 0.7, 0.2, 1);

// v2 chip "selection settle": the tint fills from the centre (scale 0→1) instead
// of a hard colour swap. Base `style` carries the UNSELECTED look; the fill layer
// paints the selected tint on top and the caller switches the label colour.
// RELEASE-FRAGILITY: useAnimatedStyle on transform/opacity only. Reduced-motion →
// the tint cross-fades in place (no scale).
export function SelectChip({
  selected,
  onPress,
  disabled,
  style,
  radius = 999,
  tint = C.green,
  children,
  ...rest
}: {
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  radius?: number;
  tint?: string;
  children: ReactNode;
} & Pick<PressableProps, 'accessibilityRole' | 'accessibilityState' | 'accessibilityLabel' | 'hitSlop'>) {
  const p = useSharedValue(selected ? 1 : 0);
  const reduce = useReducedMotion();

  useEffect(() => {
    p.value = withTiming(selected ? 1 : 0, { duration: reduce ? 180 : 260, easing: CB_OUT });
  }, [selected, reduce, p]);

  const fill = useAnimatedStyle(() =>
    reduce
      ? { opacity: p.value }
      : { opacity: 1, transform: [{ scale: p.value }] },
  );

  return (
    <AnimatedPressable style={style} onPress={onPress} disabled={disabled} {...rest}>
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: tint, borderRadius: radius }, fill]}
      />
      {children}
    </AnimatedPressable>
  );
}
