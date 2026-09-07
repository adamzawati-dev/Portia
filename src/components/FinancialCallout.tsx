// src/components/FinancialCallout.tsx
// "This is the number that matters." — the app's ONE treatment for a major
// financial conclusion, shared wherever a figure earns hero size (chat
// callouts today; anywhere else tomorrow). An amount the backend wrote,
// rendered numXL apricot with an optional overline label beneath. When `live`
// (streaming in) it counts up over the slow duration with a tick at start and
// a commit as it settles; at rest it renders still. Reduce Motion: instant.
// Parsing the amount string is display-only — never math.
import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, ViewProps } from 'react-native';
import { palette, spacing } from '../../theme/dusk';
import { haptic } from '../../theme/haptics';
import { AppText } from './AppText';
import { Money } from './Money';
import { useMotion } from '../hooks/useMotion';
import { useCountUp } from '../hooks/useCountUp';

const amountValue = (amount: string) => Number(amount.replace(/[$,]/g, ''));

export function FinancialCallout({
  amount,
  label,
  live = false,
  style,
  ...rest
}: ViewProps & {
  /** Verbatim backend text, e.g. "$1,867". */
  amount: string;
  /** Short qualifier rendered as an overline beneath ("NET LOSS"). */
  label?: string | null;
  /** Streaming in: count up + haptics. At rest: still. */
  live?: boolean;
}) {
  const { reduced, durations } = useMotion();
  const target = amountValue(amount);
  const animate = live && !reduced;
  const value = useCountUp(target, durations.slow, animate);

  const ticked = useRef(false);
  useEffect(() => {
    if (animate && !ticked.current) {
      ticked.current = true;
      haptic.tick();
    }
  }, [animate]);

  const settled = useRef(false);
  useEffect(() => {
    if (animate && !settled.current && value === target) {
      settled.current = true;
      haptic.commit();
    }
  }, [animate, value, target]);

  return (
    <View style={[styles.wrap, style]} {...rest}>
      <Money value={value} variant="numXL" color={palette.signature} showCents={amount.includes('.')} />
      {label ? (
        <AppText variant="overline" color={palette.textTertiary} style={styles.label}>
          {label.toUpperCase()}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {},
  label: {
    marginTop: spacing.xs,
  },
});
