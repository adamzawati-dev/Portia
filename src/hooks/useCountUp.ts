// src/hooks/useCountUp.ts
// Animates a number from 0 up to `target` with an ease-out, for the Diagnostic's
// hero figures. It only ever animates toward the real backend value — it never
// invents a figure. The clock runs as a Reanimated timing on the UI thread; the
// JS thread is only touched when the WHOLE-DOLLAR value changes (the reaction
// rounds before crossing), which is what the tabular type renders anyway. When
// `enabled` is false (Reduce Motion, or no figure), it snaps straight to target.
import { useEffect, useState } from 'react';
import {
  Easing,
  cancelAnimation,
  runOnJS,
  useAnimatedReaction,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

export function useCountUp(target: number, durationMs: number, enabled: boolean): number {
  const [value, setValue] = useState(enabled ? 0 : target);
  const progress = useSharedValue(enabled ? 0 : target);

  useEffect(() => {
    if (!enabled) {
      progress.value = target;
      setValue(target);
      return;
    }
    progress.value = 0;
    progress.value = withTiming(target, {
      duration: durationMs,
      easing: Easing.out(Easing.cubic),
    });
    return () => cancelAnimation(progress);
  }, [target, durationMs, enabled, progress]);

  useAnimatedReaction(
    () => Math.round(progress.value),
    (current, previous) => {
      if (current !== previous) runOnJS(setValue)(current);
    },
    [],
  );

  return value;
}
