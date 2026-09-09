import { useEffect } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

const AP = Animated.createAnimatedComponent(Pressable);

// Motion v2 press language. Press-in: compress + darken (cb-out, 150ms floor).
// Release: spring back (cb-spring). RELEASE-FRAGILITY: useAnimatedStyle on
// transform/opacity only — no entering/exiting, no useAnimatedProps.
const CB_OUT = Easing.bezier(0.2, 0.7, 0.2, 1);
const CB_SPRING = { damping: 14, stiffness: 180 };

type Props = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
  /** Scale applied on press-in. Default 0.97 (v2 app-wide press). */
  pressedScale?: number;
  /**
   * Opacity to fade to while `disabled` — animated, never a jump. Default 1
   * (no fade; callers that already style their disabled state opt in by passing
   * e.g. 0.4). This is the v2 "disabled fades, never jumps" rule.
   */
  disabledOpacity?: number;
};

/**
 * Drop-in Pressable with the v2 press feel: scale .97 + opacity dip on press-in,
 * spring back on release. Reduced-motion → no scale, opacity dip only (a fade).
 * Style is a plain ViewStyle (no function form); feedback comes from the worklet.
 */
export function AnimatedPressable({
  style,
  pressedScale = 0.97,
  disabledOpacity = 1,
  disabled,
  onPressIn,
  onPressOut,
  ...rest
}: Props) {
  const scale = useSharedValue(1);
  const press = useSharedValue(1); // press-in opacity dip (the "darken")
  const dim = useSharedValue(disabled ? disabledOpacity : 1);
  const reduce = useReducedMotion();

  useEffect(() => {
    dim.value = withTiming(disabled ? disabledOpacity : 1, { duration: 180, easing: CB_OUT });
  }, [disabled, disabledOpacity, dim]);

  const aStyle = useAnimatedStyle(() => ({
    transform: [{ scale: reduce ? 1 : scale.value }],
    opacity: press.value * dim.value,
  }));

  return (
    <AP
      disabled={disabled}
      onPressIn={(e) => {
        if (!reduce) scale.value = withTiming(pressedScale, { duration: 150, easing: CB_OUT });
        press.value = withTiming(0.9, { duration: 150, easing: CB_OUT });
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        if (!reduce) scale.value = withSpring(1, CB_SPRING);
        press.value = withTiming(1, { duration: 180, easing: CB_OUT });
        onPressOut?.(e);
      }}
      style={[style, aStyle]}
      {...rest}
    />
  );
}
