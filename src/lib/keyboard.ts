// src/lib/keyboard.ts
// The soft keyboard's height, as a hook. Used by keyboard-sheet.tsx to lift a
// bottom sheet that lives inside a Modal.
//
// WHY NOT adjustResize / softwareKeyboardLayoutMode. Those act on the app's
// window. A React Native Modal is its own window, and on Android 15+ with
// edge-to-edge (the SDK 56 default) adjustResize is ignored anyway — which is
// exactly the device bug: the sheet stayed put and the keyboard covered the
// name field. The keyboard events still fire with the keyboard's height, on
// both platforms, in any window, so that is what we pad by.

import { useEffect, useState } from 'react';
import { Keyboard, Platform, type KeyboardEvent } from 'react-native';

export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    // iOS announces the final frame before the animation (will*); Android only
    // after (did*). Using will* on Android would never fire.
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvt, (e: KeyboardEvent) => setHeight(Math.max(0, e.endCoordinates?.height ?? 0)));
    const hide = Keyboard.addListener(hideEvt, () => setHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return height;
}
