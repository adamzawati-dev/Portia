// src/components/MessageRow.tsx
// Chat turns are full-width rows, not bubbles, and never glass. Portia speaks
// on a subtle flat tint panel (content = flat, per the design system); the
// user's turns are plain warm-white text, right-aligned — the thread reads as
// a conversation, not a card stack. Committed rows are memoized so a streaming
// footer re-render never touches them. A failed user turn carries its inline
// Retry right where the message sits.
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { glass, palette, radius, spacing } from '../../theme/dusk';
import { AppText } from './AppText';
import { Press } from './Press';
import { MessageText } from '../chat/markdown';
import { Message } from '../chat/types';
import { useMotion } from '../hooks/useMotion';

export const MessageRow = React.memo(function MessageRow({
  message,
  onRetry,
}: {
  message: Message;
  onRetry?: (message: Message) => void;
}) {
  if (message.sender === 'portia') {
    return (
      <View style={styles.portiaRow}>
        <MessageText text={message.text} color={palette.textPrimary} />
      </View>
    );
  }
  return (
    <View style={styles.userRow}>
      <AppText variant="body" color={palette.textPrimary} style={styles.userText}>
        {message.text}
      </AppText>
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

/** The reply-in-flight panel: same shell as a Portia row, plus the caret. */
export function StreamingRow({ text, caretOn }: { text: string; caretOn: boolean }) {
  return (
    <View style={styles.portiaRow}>
      <MessageText text={caretOn ? `${text}▍` : text} color={palette.textPrimary} />
    </View>
  );
}

/** Pre-first-token: one small breathing dot where Portia's reply will land. */
export function WaitingDot() {
  const { reduced, durations } = useMotion();
  const pulse = useSharedValue(1);
  useEffect(() => {
    if (reduced) return;
    pulse.value = withRepeat(
      withTiming(0.3, { duration: durations.slow, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [reduced, durations, pulse]);
  const breathing = useAnimatedStyle(() => ({
    opacity: pulse.value,
    transform: [{ scale: 0.8 + pulse.value * 0.2 }],
  }));
  return (
    <View style={styles.dotRow} accessibilityLabel="Portia is replying">
      <Animated.View style={[styles.dot, breathing]} />
    </View>
  );
}

const styles = StyleSheet.create({
  portiaRow: {
    backgroundColor: glass.tintFrom,
    borderRadius: radius.card,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginVertical: spacing.xs,
  },
  userRow: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
    maxWidth: '85%',
    marginVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
    gap: spacing.xs,
  },
  userText: {
    textAlign: 'right',
  },
  dotRow: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginVertical: spacing.xs,
    alignItems: 'flex-start',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: palette.signature,
  },
});
