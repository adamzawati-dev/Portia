// src/components/MessageBubble.tsx
// Chat bubbles are CONTENT, so they are flat <Surface>s on the Dusk background —
// never glass (glass is chrome-only; a native glass view per message in a
// scrolling list is also a compositor tax). Portia speaks from the left in plain
// ink; the user's own messages sit right with a faint warm wash ("here's what's
// yours" — kept sparing).
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { palette, radius, spacing } from '../../theme/dusk';
import { Surface } from './Surface';
import { AppText } from './AppText';
import { Message } from '../chat/types';

export function MessageBubble({ message }: { message: Message }) {
  const isPortia = message.sender === 'portia';
  return (
    <View style={[styles.row, isPortia ? styles.rowPortia : styles.rowUser]}>
      <Surface
        radius={radius.card}
        tint={isPortia ? undefined : palette.signatureGlow}
        style={styles.bubble}
      >
        <AppText variant="body" color={palette.textPrimary}>
          {message.text}
        </AppText>
      </Surface>
    </View>
  );
}

// The typing indicator reuses the bubble shell — a static Portia-side bubble, no
// animation (Reduce-Motion safe).
export function TypingBubble() {
  return (
    <View style={[styles.row, styles.rowPortia]}>
      <Surface radius={radius.card} style={styles.bubble}>
        <AppText variant="body" color={palette.textTertiary}>
          Portia is typing…
        </AppText>
      </Surface>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    marginVertical: spacing.xs,
  },
  rowPortia: {
    justifyContent: 'flex-start',
  },
  rowUser: {
    justifyContent: 'flex-end',
  },
  bubble: {
    maxWidth: '82%',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
});
