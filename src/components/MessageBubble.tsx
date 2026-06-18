// src/components/MessageBubble.tsx
// One chat bubble = one <GlassSurface>. Each bubble is its OWN surface — never a
// GlassContainer around a single bubble (that traces a hard merged-glass box).
// Portia speaks from the left in plain glass; the user's own messages sit right
// with a faint warm tint (a glow, "here's what's yours" — kept sparing).
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { palette, radius, spacing } from '../../theme/dusk';
import { GlassSurface } from './GlassSurface';
import { AppText } from './AppText';
import { Message } from '../chat/types';

export function MessageBubble({ message }: { message: Message }) {
  const isPortia = message.sender === 'portia';
  return (
    <View style={[styles.row, isPortia ? styles.rowPortia : styles.rowUser]}>
      <GlassSurface
        radius={radius.lg}
        lift={false}
        tintColor={isPortia ? undefined : palette.signatureGlow}
        style={styles.bubble}
      >
        <AppText variant="body" color={palette.textPrimary}>
          {message.text}
        </AppText>
      </GlassSurface>
    </View>
  );
}

// The typing indicator reuses the bubble shell — a static Portia-side bubble, no
// animation (Reduce-Motion safe).
export function TypingBubble() {
  return (
    <View style={[styles.row, styles.rowPortia]}>
      <GlassSurface radius={radius.lg} lift={false} style={styles.bubble}>
        <AppText variant="body" color={palette.textTertiary}>
          Portia is typing…
        </AppText>
      </GlassSurface>
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
