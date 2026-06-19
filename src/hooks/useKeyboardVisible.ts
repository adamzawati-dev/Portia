// src/hooks/useKeyboardVisible.ts
// True while the soft keyboard is on screen. Used to hide the tab bar when the
// chat composer is focused, so the bar doesn't sit between the composer and the
// keyboard and so chat's KeyboardAvoidingView gets the full height it expects.
import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

export function useKeyboardVisible(): boolean {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // iOS fires the `Will` events (smoother, before the animation); Android only
    // reliably fires `Did`.
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvt, () => setVisible(true));
    const hide = Keyboard.addListener(hideEvt, () => setVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return visible;
}
