// src/components/Composer.tsx
// One unified floating object: [ Ask Portia ______________ ↑ ]. The send
// button lives INSIDE the pill, right-inset — not a satellite circle. The fill
// is flat translucent env ink (not glass), the border is a single hairline at
// 8% white, and focus is a slight fill lighten + the apricot caret — no ring.
// Send: an apricot circle that springs from dim to full when text exists,
// dips on press (shared Pressable), light tap haptic — completion carries the
// success haptic. The pill grows to four lines; tapping anywhere focuses.
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { SymbolView } from 'expo-symbols';
import { chrome, palette, radius, spacing, surface, type as typeTokens } from '../../theme/dusk';
import { fontFamilyForWeight } from '../../theme/fonts';
import { AppText } from './AppText';
import { Press } from './Press';
import { useMotion } from '../hooks/useMotion';

const MAX_LINES = 4;
const PILL_MIN_H = 54;
const SEND_SIZE = 38;
const SEND_INSET = 8;

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

  // Focus = slight fill lighten. No ring, ever.
  const focus = useSharedValue(0);
  const fillStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      focus.value,
      [0, 1],
      [surface.input, surface.inputFocus],
    ),
  }));

  // Send springs between its dim rest and full presence.
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
      <Press scaleTo={1} onPress={() => inputRef.current?.focus()} accessibilityLabel="Message input">
        <Animated.View style={[styles.pill, fillStyle]}>
          <TextInput
            ref={inputRef}
            style={styles.input}
            maxFontSizeMultiplier={1.4}
            value={text}
            onChangeText={setText}
            onFocus={() => {
              focus.value = withTiming(1, { duration: durations.fast });
            }}
            onBlur={() => {
              focus.value = withTiming(0, { duration: durations.fast });
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

          {/* The action circle, inside the pill. */}
          <Animated.View style={[styles.sendSlot, sendStyle]}>
            {streaming ? (
              <Press
                onPress={onStop}
                accessibilityRole="button"
                accessibilityLabel="Stop generating"
                style={styles.send}
              >
                <SymbolView name="stop.fill" size={14} tintColor={palette.onSignature} weight="semibold" />
              </Press>
            ) : (
              <Press
                onPress={submit}
                disabled={!canSend}
                accessibilityRole="button"
                accessibilityLabel="Send message"
                style={styles.send}
              >
                <SymbolView name="arrow.up" size={16} tintColor={palette.onSignature} weight="bold" />
              </Press>
            )}
          </Animated.View>
        </Animated.View>
      </Press>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing.xl, // the gutter both tabs' content sits on
    paddingTop: spacing.sm,
  },
  pill: {
    minHeight: PILL_MIN_H,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: chrome.border,
    justifyContent: 'center',
    paddingLeft: spacing.xl,
    // Text never runs under the action circle.
    paddingRight: SEND_SIZE + SEND_INSET * 2 + spacing.xs,
    paddingVertical: spacing.sm,
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
  placeholder: {
    position: 'absolute',
    left: spacing.xl,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  placeholderText: {
    fontFamily: fontFamilyForWeight('300'),
  },
  sendSlot: {
    position: 'absolute',
    right: SEND_INSET,
    bottom: (PILL_MIN_H - SEND_SIZE) / 2,
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
});
