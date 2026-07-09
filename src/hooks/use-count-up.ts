import { useEffect, useRef, useState } from 'react';
import { Animated, Easing } from 'react-native';

/**
 * Animate a number from its previous value to `value` with an ease-out ramp.
 * The first render is static (no count from zero); only subsequent changes tween.
 * Uses the built-in Animated API so it composes with the calorie ring's driver.
 */
export function useCountUp(value: number, duration = 350): number {
  const anim = useRef(new Animated.Value(value)).current;
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    const id = anim.addListener(({ value: v }) => setDisplay(v));
    const a = Animated.timing(anim, {
      toValue: value,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    a.start();
    return () => {
      a.stop();
      anim.removeListener(id);
    };
  }, [value, duration, anim]);

  return display;
}
