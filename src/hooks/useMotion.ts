// src/hooks/useMotion.ts
// The one way animation code reads the motion tokens. Returns the Dusk motion
// tokens as-is normally; under Reduce Motion every duration is 0 and every
// spring is immediate (a heavily overdamped spring that settles in a frame or
// two), so animated code paths need no branching — the same withTiming /
// withSpring calls simply land instantly.
import { useMemo } from 'react';
import { motion } from '../../theme/dusk';
import { useReducedMotion } from './useReducedMotion';

type SpringToken = { damping: number; stiffness: number; mass: number };
type Springs = Record<keyof typeof motion.springs, SpringToken>;
type Durations = Record<keyof typeof motion.durations, number>;

export type Motion = {
  reduced: boolean;
  durations: Durations;
  springs: Springs;
  revealStagger: number;
};

// Settles within ~1 frame: springs become a snap, not a glide.
const IMMEDIATE: SpringToken = { damping: 300, stiffness: 4000, mass: 1 };

const ZERO_DURATIONS: Durations = { instant: 0, fast: 0, base: 0, slow: 0 };
const IMMEDIATE_SPRINGS: Springs = { press: IMMEDIATE, sheet: IMMEDIATE, layout: IMMEDIATE };

export function useMotion(): Motion {
  const reduced = useReducedMotion();
  return useMemo(
    () =>
      reduced
        ? { reduced, durations: ZERO_DURATIONS, springs: IMMEDIATE_SPRINGS, revealStagger: 0 }
        : { reduced, durations: motion.durations, springs: motion.springs, revealStagger: motion.revealStagger },
    [reduced],
  );
}
