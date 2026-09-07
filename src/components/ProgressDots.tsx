// src/components/ProgressDots.tsx
// The app's one step indicator (onboarding beats, Diagnostic cards): the
// active dot stretches and warms to apricot instead of snapping; neighbors
// animate in the same beat so the row's total width barely moves. Instant
// under Reduce Motion (durations are zeroed by useMotion).
import React, { useEffect } from 'react';
import { StyleSheet, View, ViewProps } from 'react-native';
import Animated, {
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { palette, spacing } from '../../theme/dusk';
import { useMotion } from '../hooks/useMotion';

export function ProgressDots({
  count,
  index,
  style,
  ...rest
}: ViewProps & { count: number; index: number }) {
  return (
    <View style={[styles.row, style]} {...rest}>
      {Array.from({ length: count }).map((_, i) => (
        <Dot key={i} on={i === index} />
      ))}
    </View>
  );
}

function Dot({ on }: { on: boolean }) {
  const { durations } = useMotion();
  const amount = useSharedValue(on ? 1 : 0);
  useEffect(() => {
    amount.value = withTiming(on ? 1 : 0, { duration: durations.fast });
  }, [on, durations, amount]);
  const animated = useAnimatedStyle(() => ({
    width: interpolate(amount.value, [0, 1], [7, 22]),
    opacity: interpolate(amount.value, [0, 1], [0.5, 1]),
    backgroundColor: interpolateColor(amount.value, [0, 1], [palette.textTertiary, palette.signature]),
  }));
  return <Animated.View style={[styles.dot, animated]} />;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  dot: {
    height: 4,
    borderRadius: 2,
  },
});
