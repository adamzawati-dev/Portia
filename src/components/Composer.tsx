// src/components/Composer.tsx
// Bottom composer: a glass text field + an apricot send button (the primary action,
// so signature here is earned). Tokens drive every size/color; the font is wired
// explicitly because TextInput doesn't inherit it.
import React, { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { gradients, palette, radius, spacing, type as typeTokens } from '../../theme/dusk';
import { fontFamilyForWeight } from '../../theme/fonts';
import { GlassSurface } from './GlassSurface';
import { AppText } from './AppText';

export function Composer({ onSend }: { onSend: (text: string) => void }) {
  const [text, setText] = useState('');

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText('');
  };

  const canSend = text.trim().length > 0;

  return (
    <View style={styles.wrap}>
      <GlassSurface radius={radius.lg} lift={false} style={styles.field}>
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
      </GlassSurface>

      <Pressable
        onPress={submit}
        disabled={!canSend}
        accessibilityRole="button"
        accessibilityLabel="Send message"
        style={({ pressed }) => [styles.send, { opacity: !canSend ? 0.4 : pressed ? 0.85 : 1 }]}
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
      </Pressable>
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
