// src/components/Skeleton.tsx
// Loading = the screen's real shape, dimmed — never a spinner. <Skeleton> is one
// shimmering placeholder bar (Reanimated pulse on the UI thread; a static block
// under Reduce Motion). OverviewSkeleton / ChatSkeleton compose it into stand-ins
// that mirror their screens' actual layout, so load resolves in place instead of
// popping from a spinner into content.
import React, { useEffect } from 'react';
import { DimensionValue, StyleSheet, View, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { glass, innerRadius, radius, spacing } from '../../theme/dusk';
import { Surface } from './Surface';
import { useMotion } from '../hooks/useMotion';

export type SkeletonProps = {
  width: DimensionValue;
  height: number;
  /** Corner radius; defaults to a concentric-friendly small round. */
  round?: number;
  style?: ViewStyle;
};

export function Skeleton({ width, height, round = 8, style }: SkeletonProps) {
  const { reduced, durations } = useMotion();
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (reduced) {
      pulse.value = 0.7; // static mid-dim block — present, not animating
      return;
    }
    pulse.value = withRepeat(
      withTiming(0.45, { duration: durations.slow * 2, easing: Easing.inOut(Easing.quad) }),
      -1,
      true, // reverse: breathe 1 -> 0.45 -> 1
    );
  }, [reduced, durations, pulse]);

  const breathing = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <Animated.View
      style={[
        { width, height, borderRadius: round, backgroundColor: glass.tintFrom },
        breathing,
        style,
      ]}
    />
  );
}

// ---------------------------------------------------------------------------
// Per-screen skeletons. These mirror the REAL layouts (same paddings, same
// surface shells) so the swap to live content is a fade-in-place, not a reflow.
// ---------------------------------------------------------------------------

/** Mirrors BalancesScreen: hero figure block, then two institution cards. */
export function OverviewSkeleton() {
  const cardPad = spacing.lg;
  const rowRound = innerRadius(radius.card, cardPad);
  return (
    <View>
      <View style={styles.hero}>
        <Skeleton width={110} height={11} />
        <Skeleton width={230} height={47} round={12} style={styles.heroFigure} />
        <Skeleton width={130} height={12} />
      </View>
      {[2, 1].map((rows, i) => (
        <Surface key={i} style={[styles.card, { padding: cardPad }]}>
          <Skeleton width={120} height={20} round={rowRound} style={styles.cardTitle} />
          {Array.from({ length: rows }).map((_, r) => (
            <View key={r} style={styles.acctRow}>
              <View style={styles.acctLeft}>
                <Skeleton width={150} height={15} />
                <Skeleton width={64} height={12} />
              </View>
              <Skeleton width={84} height={18} />
            </View>
          ))}
        </Surface>
      ))}
    </View>
  );
}

/** Mirrors the chat thread: alternating bubble-shaped blocks. */
export function ChatSkeleton() {
  const bubbles: { mine: boolean; width: DimensionValue; height: number }[] = [
    { mine: false, width: '72%', height: 64 },
    { mine: true, width: '46%', height: 44 },
    { mine: false, width: '64%', height: 44 },
    { mine: true, width: '34%', height: 44 },
    { mine: false, width: '76%', height: 64 },
  ];
  return (
    <View style={styles.chat}>
      {bubbles.map((b, i) => (
        <View key={i} style={[styles.bubbleRow, b.mine ? styles.rowUser : styles.rowPortia]}>
          <Skeleton width={b.width} height={b.height} round={radius.card} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    marginBottom: spacing.xl,
    gap: spacing.xs,
  },
  heroFigure: {
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  card: {
    marginTop: spacing.md,
  },
  cardTitle: {
    marginBottom: spacing.md,
  },
  acctRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  acctLeft: {
    gap: 6,
  },
  chat: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  bubbleRow: {
    flexDirection: 'row',
    marginVertical: spacing.xs,
  },
  rowPortia: { justifyContent: 'flex-start' },
  rowUser: { justifyContent: 'flex-end' },
});
