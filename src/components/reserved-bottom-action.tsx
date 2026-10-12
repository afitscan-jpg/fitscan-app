// src/components/reserved-bottom-action.tsx
// Wrap any control that lives at the bottom edge of a screen. While the screen
// is focused, the control's top edge is registered (bottom-right-action.ts) and
// the assistant FAB stacks above it. See that file for why this exists.
//
//   <ReservedBottomAction style={{ right: 22, bottom: 34 }}>
//     <AnimatedPressable …>+</AnimatedPressable>
//   </ReservedBottomAction>
//
// The wrapper is absolutely positioned; pass the position in `style` and keep
// the child's own style free of `position: 'absolute'`. Full-width bars work
// the same way (`left: 0, right: 0, bottom: 0`).

import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';

import { setBottomRightReservation } from '@/lib/bottom-right-action';

type Props = ViewProps & { style?: StyleProp<ViewStyle> };

export function ReservedBottomAction({ style, onLayout, children, ...rest }: Props) {
  const id = useId();
  const ref = useRef<View>(null);
  const [focused, setFocused] = useState(false);

  const measure = useCallback(() => {
    const node = ref.current;
    if (!node) return;
    node.measureInWindow((_x, y, _w, h) => {
      // h === 0 → not laid out yet (or hidden); don't reserve on a guess.
      if (h > 0) setBottomRightReservation(id, y);
    });
  }, [id]);

  // Tab screens stay mounted when they are not on screen, so the reservation
  // follows FOCUS, not mount: register on focus, release on blur.
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      measure();
      return () => {
        setFocused(false);
        setBottomRightReservation(id, null);
      };
    }, [id, measure]),
  );

  // Release on unmount too (a screen that is popped while focused).
  useEffect(() => () => setBottomRightReservation(id, null), [id]);

  return (
    <View
      ref={ref}
      style={[styles.wrap, style]}
      pointerEvents="box-none"
      onLayout={(e) => {
        if (focused) measure();
        onLayout?.(e);
      }}
      {...rest}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute' },
});
