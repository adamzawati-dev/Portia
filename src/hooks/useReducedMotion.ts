// src/hooks/useReducedMotion.ts
// Reduce Motion is non-negotiable in this design system: when it's on, no ambient
// drift, no pulse, no specular tracking. Every motion-bearing primitive reads this.
import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { useReducedMotion as useReanimatedReducedMotion } from 'react-native-reanimated';

export function useReducedMotion(): boolean {
  // Reanimated reads the native flag synchronously, so the FIRST render is already
  // correct. Starting from `false` and flipping later raced every timer-driven
  // sequence: the intro's beats cleared their own pending timeouts on the flip and
  // never advanced, leaving a Reduce Motion user with no statement text at all.
  // The AccessibilityInfo listener still tracks live changes.
  const initial = useReanimatedReducedMotion();
  const [reduced, setReduced] = useState(initial);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (mounted) setReduced(value);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  return reduced;
}
