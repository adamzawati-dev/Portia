// src/hooks/useCountUp.ts
// Animates a number from 0 up to `target` with an ease-out, for the Diagnostic's
// hero figures. It only ever animates toward the real backend value — it never
// invents a figure. When `enabled` is false (Reduce Motion, or re-renders), it
// snaps straight to the target.
import { useEffect, useRef, useState } from 'react';

export function useCountUp(target: number, durationMs: number, enabled: boolean): number {
  const [value, setValue] = useState(enabled ? 0 : target);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) {
      setValue(target);
      return;
    }
    const start = Date.now();
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      setValue(target * eased);
      if (t < 1) {
        raf.current = requestAnimationFrame(tick);
      } else {
        setValue(target); // land exactly on the real value
      }
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current != null) cancelAnimationFrame(raf.current);
    };
  }, [target, durationMs, enabled]);

  return value;
}
