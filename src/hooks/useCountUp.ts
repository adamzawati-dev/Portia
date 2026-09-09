// src/hooks/useCountUp.ts
// Animates a number toward `target` with an ease-out. It only ever animates
// toward the real backend value — it never invents a figure. On first mount it
// counts up from 0; when `target` changes later (a refresh) it animates from the
// value currently on screen to the new one — the delta, not a restart. The clock
// runs as a Reanimated timing on the UI thread; the JS thread is only touched
// when the WHOLE-DOLLAR value changes (the reaction rounds before crossing).
// Completion lands exactly on `target` — cents included — so the screen never
// shows a rounded stand-in at rest. When `enabled` is false (Reduce Motion, or
// no figure), it snaps straight to target.
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
    // No reset: the timing starts from wherever the value currently sits.
    progress.value = withTiming(
      target,
      { duration: durationMs, easing: Easing.out(Easing.cubic) },
      (finished) => {
        'worklet';
        if (finished) runOnJS(setValue)(target);
      },
    );
    return () => cancelAnimation(progress);
  }, [target, durationMs, enabled, progress]);

  useAnimatedReaction(
    () => {
      const v = progress.value;
      // The final frame lands exactly on target. Pass it through unrounded: this
      // reaction can run AFTER the completion callback, and a rounded last write
      // would leave the figure at rest without its cents ($12,404.00 for 12404.12).
      return v === target ? v : Math.round(v);
    },
    (current, previous) => {
      if (current !== previous) runOnJS(setValue)(current);
    },
    [target],
  );

  return value;
}
