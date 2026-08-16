// src/components/Composer.tsx
// Bottom composer: a glass text field (chrome — it floats over the thread) + an
// apricot action button. While a reply is generating the button is a Stop
// square; otherwise it sends (light haptic via <Press> — the completion carries
// the success haptic). Tokens drive every size/color; the font is wired
// explicitly because TextInput doesn't inherit it.
import React, { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SymbolView } from 'expo-symbols';
import { gradients, palette, radius, spacing, type as typeTokens } from '../../theme/dusk';
import { fontFamilyForWeight } from '../../theme/fonts';
import { Glass } from './Glass';
import { AppText } from './AppText';
import { Press } from './Press';

export function Composer({
  onSend,
  streaming = false,
  onStop,
}: {
  onSend: (text: string) => void;
  /** A reply is in flight: the action button becomes Stop. */
  streaming?: boolean;
  onStop?: () => void;
}) {
  const [text, setText] = useState('');

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;
    onSend(trimmed);
    setText('');
  };

  const canSend = text.trim().length > 0 && !streaming;

  return (
    <View style={styles.wrap}>
      <Glass.Chrome radius={radius.card} style={styles.field}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Ask Portia"
          placeholderTextColor={palette.textTertiary}
          multiline
          keyboardAppearance="dark"
          selectionColor={palette.signature}
          returnKeyType="send"
          blurOnSubmit
          onSubmitEditing={submit}
        />
      </Glass.Chrome>

      {streaming ? (
        <Press
          onPress={onStop}
          accessibilityRole="button"
          accessibilityLabel="Stop generating"
          style={styles.send}
        >
          <LinearGradient
            colors={gradients.cta.colors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <SymbolView name="stop.fill" size={16} tintColor={palette.onSignature} weight="semibold" />
        </Press>
      ) : (
        <Press
          onPress={submit}
          disabled={!canSend}
          accessibilityRole="button"
          accessibilityLabel="Send message"
          style={[styles.send, { opacity: canSend ? 1 : 0.4 }]}
        >
          <LinearGradient
            colors={gradients.cta.colors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <AppText variant="title" color={palette.onSignature}>
            ↑
          </AppText>
        </Press>
      )}
    </View>
  );
}

const SEND_SIZE = 44;

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  field: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    minHeight: SEND_SIZE,
  },
  input: {
    fontFamily: fontFamilyForWeight(typeTokens.scale.body.weight),
    fontSize: typeTokens.scale.body.size,
    lineHeight: typeTokens.scale.body.lineHeight,
    color: palette.textPrimary,
    paddingTop: 0,
    paddingBottom: 0,
    maxHeight: 120,
  },
  send: {
    width: SEND_SIZE,
    height: SEND_SIZE,
    borderRadius: SEND_SIZE / 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
