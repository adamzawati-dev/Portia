// src/screens/OnboardingScreen.tsx
// The pre-auth value sequence: three short beats in Portia's voice before the user
// signs in. Anti-budget, anchored, honest, no verdicts. Each beat is one statement
// on a single glass card over the Dusk environment, with a Continue and a Skip — the
// whole thing is skippable at any point. The figure in beat two is illustrative
// (the diagnostic teaser), shown in the apricot signature: this is the positive
// moment the signature is reserved for.
//
// Accessibility is non-negotiable here: each statement is read as one VoiceOver
// label, the progress reads "Step n of 3", Continue/Skip are labelled buttons, and
// the entrance animation collapses to instant under Reduce Motion.
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { motion, palette, radius, spacing } from '../../theme/dusk';
import { Background } from '../components/Background';
import { AppText } from '../components/AppText';
import { GlassSurface } from '../components/GlassSurface';
import { PrimaryButton } from '../components/PrimaryButton';
import { useReducedMotion } from '../hooks/useReducedMotion';

// A statement is a run of text segments so one span (a figure) can carry the
// signature colour while the rest stays warm-white. `plain` is what VoiceOver reads.
type Segment = { text: string; accent?: boolean };
type Beat = { segments: Segment[]; plain: string };

const BEATS: Beat[] = [
  {
    plain: "Most money apps make you feel bad about your money. I don't do that.",
    segments: [{ text: "Most money apps make you feel bad about your money. I don't do that." }],
  },
  {
    plain:
      'I read your accounts and show you where the real money is — like the $2,200 a year hiding in your takeout.',
    segments: [
      { text: 'I read your accounts and show you where the real money is — like the ' },
      { text: '$2,200 a year', accent: true },
      { text: ' hiding in your takeout.' },
    ],
  },
  {
    plain: 'Read-only. I never move a cent, and I never guess a number. Everything I tell you is real.',
    segments: [
      { text: 'Read-only. I never move a cent, and I never guess a number. Everything I tell you is real.' },
    ],
  },
];

export function OnboardingScreen({ onDone }: { onDone: () => void }) {
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);
  const isLast = index === BEATS.length - 1;
  const beat = BEATS[index];

  // Re-run the entrance each time the beat changes (instant under Reduce Motion).
  const enter = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  useEffect(() => {
    if (reduced) {
      enter.setValue(1);
      return;
    }
    enter.setValue(0);
    Animated.spring(enter, {
      toValue: 1,
      damping: motion.springSoft.damping,
      stiffness: motion.springSoft.stiffness,
      mass: motion.springSoft.mass,
      useNativeDriver: true,
    }).start();
  }, [index, reduced, enter]);

  const advance = () => (isLast ? onDone() : setIndex((i) => i + 1));

  const entranceStyle = {
    opacity: enter,
    transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
  };

  return (
    <Background>
      <View
        style={[
          styles.root,
          { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.xl },
        ]}
      >
        <View style={styles.topRow}>
          <View
            style={styles.dots}
            accessibilityRole="text"
            accessibilityLabel={`Step ${index + 1} of ${BEATS.length}`}
          >
            {BEATS.map((_, i) => (
              <View key={i} style={[styles.dot, i === index ? styles.dotOn : styles.dotOff]} />
            ))}
          </View>
          <Pressable
            onPress={onDone}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Skip the intro"
          >
            <AppText variant="caption" color={palette.textTertiary}>
              Skip
            </AppText>
          </Pressable>
        </View>

        <View style={styles.center}>
          <Animated.View style={entranceStyle}>
            <GlassSurface radius={radius.xl} style={styles.card}>
              <AppText
                variant="display"
                accessibilityLabel={beat.plain}
                style={styles.statement}
              >
                {beat.segments.map((seg, i) =>
                  seg.accent ? (
                    <AppText key={i} variant="display" color={palette.signature} tabular>
                      {seg.text}
                    </AppText>
                  ) : (
                    seg.text
                  ),
                )}
              </AppText>
            </GlassSurface>
          </Animated.View>
        </View>

        <View style={styles.footer}>
          <PrimaryButton label={isLast ? 'Get started' : 'Continue'} onPress={advance} />
        </View>
      </View>
    </Background>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    justifyContent: 'space-between',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  dots: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  dot: {
    height: 4,
    borderRadius: 2,
  },
  dotOn: { width: 22, backgroundColor: palette.signature },
  dotOff: { width: 7, backgroundColor: palette.textTertiary, opacity: 0.5 },
  center: {
    flex: 1,
    justifyContent: 'center',
  },
  card: {
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xl,
  },
  statement: {
    // A touch more leading than the display token: this is a paragraph, not a label.
    lineHeight: 38,
  },
  footer: {
    paddingTop: spacing.lg,
  },
});
