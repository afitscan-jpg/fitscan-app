import { useEffect, useRef } from 'react';
import { View, type StyleProp, type TextStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

const CB_OUT = Easing.bezier(0.2, 0.7, 0.2, 1);

// v2 "odometer roll": on change the number rolls in from the direction of travel
// (up when it grows, down when it shrinks), clipped to `height`. RELEASE-FRAGILITY:
// useAnimatedStyle on transform/opacity only. Reduced-motion → cross-fade, no
// translate. Pairs with an existing tick haptic at the call site — adds none.
export function Odometer({
  value,
  height,
  style,
}: {
  value: number;
  height: number;
  style?: StyleProp<TextStyle>;
}) {
  const prev = useRef(value);
  const y = useSharedValue(0);
  const o = useSharedValue(1);
  const reduce = useReducedMotion();

  useEffect(() => {
    const dir = value >= prev.current ? 1 : -1;
    prev.current = value;
    if (reduce) {
      o.value = 0;
      o.value = withTiming(1, { duration: 180, easing: CB_OUT });
      return;
    }
    y.value = dir * (height * 0.5);
    o.value = 0.25;
    y.value = withTiming(0, { duration: 240, easing: CB_OUT });
    o.value = withTiming(1, { duration: 240, easing: CB_OUT });
  }, [value, reduce, height, y, o]);

  const aStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: reduce ? 0 : y.value }],
    opacity: o.value,
  }));

  return (
    <View style={{ height, overflow: 'hidden', justifyContent: 'center' }}>
      <Animated.Text style={[style, aStyle]}>{value}</Animated.Text>
    </View>
  );
}
