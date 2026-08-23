// src/components/Composer.tsx
// Bottom composer: a glass pill (chrome — it floats over the thread) + an
// apricot action button. The pill grows to four lines, focuses from a tap
// anywhere inside it, and wears a 1px apricot hairline while focused (fading
// on the fast duration). The send button springs up from its 40% rest the
// moment text exists; while a reply is generating it becomes Stop. Send is a
// light tap — completion carries the success haptic. Tokens drive every
// size/color; the font is wired explicitly because TextInput doesn't inherit.
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { SymbolView } from 'expo-symbols';
import { palette, radius, spacing, type as typeTokens } from '../../theme/dusk';
import { fontFamilyForWeight } from '../../theme/fonts';
import { Glass } from './Glass';
import { AppText } from './AppText';
import { Press } from './Press';
import { useMotion } from '../hooks/useMotion';

const MAX_LINES = 4;

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
  const { durations, springs } = useMotion();
  const [text, setText] = useState('');
  const inputRef = useRef<TextInput>(null);

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;
    onSend(trimmed);
    setText('');
  };

  const canSend = text.trim().length > 0 && !streaming;

  // Focus ring: 1px apricot hairline, faded on the fast duration.
  const ring = useSharedValue(0);
  const ringStyle = useAnimatedStyle(() => ({ opacity: ring.value }));

  // Send button springs between its 40% rest and full presence.
  const presence = useSharedValue(canSend || streaming ? 1 : 0);
  useEffect(() => {
    presence.value = withSpring(canSend || streaming ? 1 : 0, springs.press);
  }, [canSend, streaming, springs, presence]);
  const sendStyle = useAnimatedStyle(() => ({
    opacity: 0.4 + presence.value * 0.6,
    transform: [{ scale: 0.9 + presence.value * 0.1 }],
  }));

  return (
    <View style={styles.wrap}>
      {/* The whole pill is a touch target for focusing the input. */}
      <Press
        scaleTo={1}
        onPress={() => inputRef.current?.focus()}
        accessibilityLabel="Message input"
        style={styles.fieldWrap}
      >
        <Glass.Chrome radius={radius.card} style={styles.field}>
          <TextInput
            ref={inputRef}
            style={styles.input}
            maxFontSizeMultiplier={1.4}
            value={text}
            onChangeText={setText}
            onFocus={() => {
              ring.value = withTiming(1, { duration: durations.fast });
            }}
            onBlur={() => {
              ring.value = withTiming(0, { duration: durations.fast });
            }}
            multiline
            keyboardAppearance="dark"
            selectionColor={palette.signature}
            returnKeyType="send"
            blurOnSubmit
            onSubmitEditing={submit}
          />
          {text.length === 0 ? (
            /* Placeholder at the light weight — TextInput can't style its own
               placeholder's family, so this overlay is the placeholder. */
            <View pointerEvents="none" style={styles.placeholder}>
              <AppText variant="body" color={palette.textTertiary} style={styles.placeholderText}>
                Ask Portia
              </AppText>
            </View>
          ) : null}
        </Glass.Chrome>
        <Animated.View pointerEvents="none" style={[styles.ring, ringStyle]} />
      </Press>

      <Animated.View style={sendStyle}>
        {streaming ? (
          <Press
            onPress={onStop}
            accessibilityRole="button"
            accessibilityLabel="Stop generating"
            style={styles.send}
          >
            <SymbolView name="stop.fill" size={16} tintColor={palette.onSignature} weight="semibold" />
          </Press>
        ) : (
          <Press
            onPress={submit}
            disabled={!canSend}
            accessibilityRole="button"
            accessibilityLabel="Send message"
            style={styles.send}
          >
            <SymbolView name="arrow.up" size={18} tintColor={palette.onSignature} weight="bold" />
          </Press>
        )}
      </Animated.View>
    </View>
  );
}

const SEND_SIZE = 44;

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.xl, // the gutter both tabs' content sits on
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  fieldWrap: {
    flex: 1,
  },
  field: {
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    minHeight: SEND_SIZE,
  },
  ring: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: palette.signature,
  },
  input: {
    fontFamily: fontFamilyForWeight(typeTokens.scale.body.weight),
    fontSize: typeTokens.scale.body.size,
    lineHeight: typeTokens.scale.body.lineHeight,
    color: palette.textPrimary,
    paddingTop: 0,
    paddingBottom: 0,
    maxHeight: typeTokens.scale.body.lineHeight * MAX_LINES,
  },
  send: {
    width: SEND_SIZE,
    height: SEND_SIZE,
    borderRadius: SEND_SIZE / 2,
    // Solid apricot: the single most saturated element on screen.
    backgroundColor: palette.signature,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholder: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  placeholderText: {
    fontFamily: fontFamilyForWeight('300'),
  },
});
