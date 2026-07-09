import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

const AP = Animated.createAnimatedComponent(Pressable);

type Props = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
  /** Scale applied on press-in. Default 0.98 (app-wide micro-press). */
  pressedScale?: number;
};

/**
 * Drop-in Pressable with a calm, consistent press feel: scale + opacity dip on
 * press-in, ease-out release. Style is a plain ViewStyle (no function form) so
 * the press feedback comes entirely from the animation, not a pressed flag.
 */
export function AnimatedPressable({
  style,
  pressedScale = 0.98,
  onPressIn,
  onPressOut,
  ...rest
}: Props) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const aStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <AP
      onPressIn={(e) => {
        scale.value = withTiming(pressedScale, { duration: 120, easing: Easing.out(Easing.quad) });
        opacity.value = withTiming(0.92, { duration: 120, easing: Easing.out(Easing.quad) });
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withTiming(1, { duration: 160, easing: Easing.out(Easing.quad) });
        opacity.value = withTiming(1, { duration: 160, easing: Easing.out(Easing.quad) });
        onPressOut?.(e);
      }}
      style={[style, aStyle]}
      {...rest}
    />
  );
}
