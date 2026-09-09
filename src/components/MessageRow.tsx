// src/components/MessageRow.tsx
// Chat turns, arm's-length readable: numbers first, prose second.
//
// Assistant turns are full-width flat prose on the Dusk background. Each opens
// with a 2px apricot rule that DRAWS in left-to-right, then the text fades up.
// When a reply carries a dollar figure, the key one renders as an
// Overview-hero line (count-up while live). Receipts — hairline uppercase
// chips naming the true sources — stagger in under the finished reply, and a
// barely-there divider closes each turn so long threads keep rhythm.
// User turns are compact right-aligned chips on a subtle flat tint. Never glass.
//
// While Portia works, ThinkingSteps is one glass-edged strip: a pulsing
// apricot dot, the current status line with an apricot shimmer sweeping the
// text (MaskedView), previous lines exiting up. Institution names come from
// the accounts cache — real data, never invented.
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  FadeInUp,
  FadeOutUp,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { glass, palette, radius, spacing, surface } from '../../theme/dusk';
import { haptic } from '../../theme/haptics';
import { AppText } from './AppText';
import { FinancialCallout } from './FinancialCallout';
import { Press } from './Press';
import { MessageProse, extractHero } from '../chat/markdown';
import { Message } from '../chat/types';
import { useMotion } from '../hooks/useMotion';
import { getAccountsCacheSync } from '../api/accountsCache';

// Provenance: one quiet line naming where the figures come from — no pills,
// no borders, just muted metadata ("American Express · Wells Fargo"). The
// contract's replies carry no per-message source list yet, so this names the
// linked institutions from the accounts cache — real names, only what's true.
function Provenance() {
  const names = getAccountsCacheSync()?.data.institutions.map((i) => i.institutionName) ?? [];
  if (names.length === 0) return null;
  return (
    <AppText
      variant="micro"
      color={palette.textTertiary}
      style={styles.provenance}
      accessibilityLabel={`Sources: ${names.join(', ')}`}
    >
      {names.join(' · ')}
    </AppText>
  );
}

function AssistantTurn({ text, live = false }: { text: string; live?: boolean }) {
  const { reduced, durations } = useMotion();
  const hero = extractHero(text);

  // Entrance (live turns only): the rule draws left-to-right, then the body
  // fades up 4px. Committed/history rows render at rest.
  const animate = live && !reduced;
  const ruleIn = useSharedValue(animate ? 0 : 1);
  const bodyIn = useSharedValue(animate ? 0 : 1);
  useEffect(() => {
    if (!animate) return;
    ruleIn.value = withTiming(1, { duration: durations.fast, easing: Easing.out(Easing.quad) });
    bodyIn.value = withDelay(durations.fast, withTiming(1, { duration: durations.fast }));
    // Entrance runs once per mounted turn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const ruleStyle = useAnimatedStyle(() => ({ width: 22 * ruleIn.value }));
  const bodyStyle = useAnimatedStyle(() => ({
    opacity: bodyIn.value,
    transform: [{ translateY: (1 - bodyIn.value) * 4 }],
  }));

  return (
    <View style={styles.assistant}>
      <Animated.View style={[styles.rule, ruleStyle]} />
      <Animated.View style={bodyStyle}>
        {hero ? (
          <FinancialCallout amount={hero.amount} label={hero.label} live={live} style={styles.hero} />
        ) : null}
        <MessageProse text={text} color={palette.textPrimary} omitLine={hero?.liftedLine} />
        {live ? null : <Provenance />}
      </Animated.View>
      {/* Turn divider: barely-there rhythm for long threads. */}
      {live ? null : <View style={styles.turnDivider} />}
    </View>
  );
}

export const MessageRow = React.memo(function MessageRow({
  message,
  onRetry,
}: {
  message: Message;
  onRetry?: (message: Message) => void;
}) {
  if (message.sender === 'portia') {
    return <AssistantTurn text={message.text} />;
  }
  return (
    <View style={styles.userRow}>
      <View style={styles.userChip}>
        <AppText variant="body" color={palette.textPrimary}>
          {message.text}
        </AppText>
      </View>
      {message.failed ? (
        <Press
          onPress={() => onRetry?.(message)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Retry sending this message"
        >
          <AppText variant="caption" color={palette.attention}>
            Didn't send. Retry
          </AppText>
        </Press>
      ) : null}
    </View>
  );
});

/** The reply-in-flight: same layout as a finished assistant turn, plus caret. */
export function StreamingRow({ text, caretOn }: { text: string; caretOn: boolean }) {
  return <AssistantTurn text={caretOn ? `${text}▍` : text} live />;
}

// ---------------------------------------------------------------------------
// Thinking strip: one glass-edged capsule — pulsing apricot dot, current
// status line with a shimmer sweeping the text, previous lines exiting up.
// ---------------------------------------------------------------------------

const STEP_MS = 1400;
const SHIMMER_MS = 1800;
const SHIMMER_SWEEP_W = 300;

function buildSteps(): string[] {
  const institutions =
    getAccountsCacheSync()?.data.institutions.map((i) => i.institutionName) ?? [];
  const reading =
    institutions.length > 0
      ? institutions.slice(0, 2).map((name) => `Reading ${name}…`)
      : ['Reading your accounts…'];
  return [...reading, 'Scanning recent transactions…', 'Writing it up…'];
}

export function ThinkingSteps() {
  const { reduced, durations } = useMotion();
  const [steps] = useState(buildSteps);
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (idx >= steps.length - 1) return;
    const t = setTimeout(() => setIdx((i) => i + 1), STEP_MS);
    return () => clearTimeout(t);
  }, [idx, steps.length]);

  return (
    <View style={styles.assistant} accessibilityLabel="Portia is working">
      <View style={styles.thinkStrip}>
        <PulsingDot />
        <View style={styles.thinkSlot}>
          <Animated.View
            key={idx}
            entering={reduced ? undefined : FadeInUp.duration(durations.fast)}
            exiting={reduced ? undefined : FadeOutUp.duration(durations.fast)}
          >
            <ShimmerText text={steps[idx]} />
          </Animated.View>
        </View>
      </View>
    </View>
  );
}

function PulsingDot() {
  const { reduced, durations } = useMotion();
  const pulse = useSharedValue(1);
  useEffect(() => {
    if (reduced) return;
    pulse.value = withRepeat(
      withTiming(0.35, { duration: durations.slow, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [reduced, durations, pulse]);
  const breathing = useAnimatedStyle(() => ({
    opacity: pulse.value,
    transform: [{ scale: 0.85 + pulse.value * 0.15 }],
  }));
  return <Animated.View style={[styles.dot, breathing]} />;
}

/** The status line with a soft apricot band sweeping through the glyphs. */
function ShimmerText({ text }: { text: string }) {
  const { reduced } = useMotion();
  const sweep = useSharedValue(-1);
  useEffect(() => {
    if (reduced) return;
    sweep.value = -1;
    sweep.value = withRepeat(
      withTiming(1, { duration: SHIMMER_MS, easing: Easing.inOut(Easing.quad) }),
      -1,
      false,
    );
  }, [reduced, sweep, text]);
  const sweepStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: sweep.value * SHIMMER_SWEEP_W }],
  }));

  if (reduced) {
    return (
      <AppText variant="caption" color={palette.textSecondary}>
        {text}
      </AppText>
    );
  }
  return (
    <MaskedView
      maskElement={
        <AppText variant="caption" color="#000">
          {text}
        </AppText>
      }
    >
      {/* Invisible twin sizes the mask; layers below show through the glyphs. */}
      <AppText variant="caption" style={styles.sizer}>
        {text}
      </AppText>
      <View style={[StyleSheet.absoluteFill, styles.shimmerBase]} />
      <Animated.View style={[StyleSheet.absoluteFill, sweepStyle]}>
        <LinearGradient
          colors={['transparent', palette.signatureGlow, 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.shimmerBand}
        />
      </Animated.View>
    </MaskedView>
  );
}

const styles = StyleSheet.create({
  assistant: {
    marginVertical: spacing.lg,
  },
  rule: {
    height: 2,
    borderRadius: 1,
    backgroundColor: palette.signature,
    marginBottom: spacing.md,
  },
  hero: {
    marginBottom: spacing.md,
  },
  userRow: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
    maxWidth: '78%', // a one-line message reads compact, never billboard
    marginVertical: spacing.sm,
    gap: spacing.xs,
  },
  userChip: {
    backgroundColor: surface.userMessage,
    borderRadius: radius.card,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  provenance: {
    marginTop: spacing.md,
  },
  turnDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: surface.separator,
    marginTop: spacing.lg,
  },
  thinkStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    alignSelf: 'flex-start',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: glass.border,
    backgroundColor: surface.faint,
    borderRadius: radius.chip,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  thinkSlot: {
    minHeight: 16,
    justifyContent: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: palette.signature,
  },
  sizer: {
    opacity: 0,
  },
  shimmerBase: {
    backgroundColor: palette.textSecondary,
  },
  shimmerBand: {
    width: 140,
    height: '100%',
  },
});
