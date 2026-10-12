// src/components/keyboard-sheet.tsx
// The one way a bottom sheet with a text field is shown in this app.
//
// Wraps a Modal and lifts everything inside it by the keyboard's height, so the
// focused field and the sheet's Save button stay on screen. Sheets that size
// themselves (sheet-snap.ts) get the room that is actually left — `maxHeight`
// — through the render prop, so the list inside keeps scrolling rather than
// the sheet growing off the top. See lib/keyboard.ts for why the app-level
// keyboard mode cannot do this for a Modal.
//
//   <KeyboardSheet visible={open} onClose={close} onShown={() => nameRef.current?.focus()}>
//     {({ maxHeight }) => (
//       <Pressable style={s.overlay} onPress={close}>
//         <Pressable style={[s.sheet, { height: Math.min(snapH, maxHeight) }]}>…</Pressable>
//       </Pressable>
//     )}
//   </KeyboardSheet>
//
// The child still draws its own backdrop and sheet (every sheet in the app
// already does), so adopting this is a wrapper change, not a rewrite.

import { type ReactNode } from 'react';
import { Modal, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useKeyboardHeight } from '@/lib/keyboard';

export interface SheetFrame {
  /** Height a sheet may take right now: the window minus the keyboard, the
   *  top inset and a small gap. Cap a snap height with it. */
  maxHeight: number;
  keyboardHeight: number;
}

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Fires after the open animation — the right moment to focus a field. */
  onShown?: () => void;
  animationType?: 'slide' | 'fade' | 'none';
  children: (frame: SheetFrame) => ReactNode;
};

const TOP_GAP = 8;

export function KeyboardSheet({ visible, onClose, onShown, animationType = 'slide', children }: Props) {
  const keyboardHeight = useKeyboardHeight();
  const { height: winH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const maxHeight = Math.max(200, winH - keyboardHeight - insets.top - TOP_GAP);
  return (
    <Modal visible={visible} transparent animationType={animationType} onRequestClose={onClose} onShow={onShown}>
      <View style={[styles.lift, { paddingBottom: keyboardHeight }]}>
        {children({ maxHeight, keyboardHeight })}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // The backdrop colour comes from the child's own overlay; this only lifts.
  lift: { flex: 1 },
});
