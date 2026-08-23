// src/components/MessageRow.tsx
// Chat turns, arm's-length readable: numbers first, prose second.
//
// Assistant turns are full-width flat prose on the Dusk background — no
// container. A 2px apricot rule marks each turn's top-left. When a reply
// carries a dollar figure, the key one (backend flag when the contract grows
// one; first amount until then) renders as an Overview-hero line: the amount
// huge in apricot with its label beneath — the figure line leaves the prose so
// nothing repeats. User turns are compact right-aligned chips on a subtle flat
// tint, so the two voices are unmistakable at a glance. Never glass.
//
// While Portia works, ThinkingSteps shows honest progress lines (institution
// names come from the last-known accounts cache — real data, never invented)
// that the answer replaces when the first token lands.
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { glass, palette, radius, spacing } from '../../theme/dusk';
import { AppText } from './AppText';
import { Money } from './Money';
import { Press } from './Press';
import { MessageProse, extractHero } from '../chat/markdown';
import { Message } from '../chat/types';
import { useMotion } from '../hooks/useMotion';
import { getAccountsCacheSync } from '../api/accountsCache';

// Rendering an amount the backend wrote: parse for display only, never math.
const amountValue = (amount: string) => Number(amount.replace(/[$,]/g, ''));

function AssistantTurn({ text }: { text: string }) {
  const hero = extractHero(text);
  return (
    <View style={styles.assistant}>
      <View style={styles.rule} />
      {hero ? (
        <View style={styles.hero}>
          <Money
            value={amountValue(hero.amount)}
            variant="numXL"
            color={palette.signature}
            showCents={hero.amount.includes('.')}
          />
          {hero.label ? (
            <AppText variant="overline" color={palette.textTertiary} style={styles.heroLabel}>
              {hero.label.toUpperCase()}
            </AppText>
          ) : null}
        </View>
      ) : null}
      <MessageProse text={text} color={palette.textPrimary} omitLine={hero?.liftedLine} />
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
            Didn't send — Retry
          </AppText>
        </Press>
      ) : null}
    </View>
  );
});

/** The reply-in-flight: same layout as a finished assistant turn, plus caret. */
export function StreamingRow({ text, caretOn }: { text: string; caretOn: boolean }) {
  return <AssistantTurn text={caretOn ? `${text}▍` : text} />;
}

// ---------------------------------------------------------------------------
// Thinking state: status lines appear one by one and hold until the answer
// lands. Institution names are read from the accounts cache (real backend
// data); everything else stays generic and honest.
// ---------------------------------------------------------------------------

const STEP_MS = 900;

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
  const [steps] = useState(buildSteps);
  const [shown, setShown] = useState(1);
  useEffect(() => {
    if (shown >= steps.length) return;
    const t = setTimeout(() => setShown((s) => s + 1), STEP_MS);
    return () => clearTimeout(t);
  }, [shown, steps.length]);
  return (
    <View style={styles.assistant} accessibilityLabel="Portia is working">
      <View style={styles.rule} />
      {steps.slice(0, shown).map((step, i) => (
        <ThinkingLine key={step} text={step} dimmed={i < shown - 1} />
      ))}
    </View>
  );
}

function ThinkingLine({ text, dimmed }: { text: string; dimmed: boolean }) {
  const { reduced, durations } = useMotion();
  const enter = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    enter.value = withTiming(1, { duration: durations.base, easing: Easing.out(Easing.quad) });
  }, [enter, durations]);
  const style = useAnimatedStyle(() => ({
    opacity: enter.value * (dimmed ? 0.55 : 1),
    transform: [{ translateY: (1 - enter.value) * 6 }],
  }));
  return (
    <Animated.View style={[styles.thinkingLine, style]}>
      <AppText variant="caption" color={palette.textSecondary}>
        {text}
      </AppText>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  assistant: {
    marginVertical: spacing.lg,
  },
  rule: {
    width: 22,
    height: 2,
    borderRadius: 1,
    backgroundColor: palette.signature,
    marginBottom: spacing.md,
  },
  hero: {
    marginBottom: spacing.md,
  },
  heroLabel: {
    marginTop: spacing.xs,
  },
  userRow: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
    maxWidth: '85%',
    marginVertical: spacing.sm,
    gap: spacing.xs,
  },
  userChip: {
    backgroundColor: glass.tintFrom,
    borderRadius: radius.card,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  thinkingLine: {
    marginBottom: spacing.xs,
  },
});
