// src/screens/OnboardingScreen.tsx
// The pre-auth value sequence: three short beats in Portia's voice before the user
// signs in. Anti-budget, anchored, honest, no verdicts. Each beat is one statement
// on a single flat card (content, so no glass) over the Dusk environment, with a
// Continue and a Skip — the whole thing is skippable at any point. The figure in
// beat two is illustrative (the diagnostic teaser), shown in the apricot
// signature: this is the positive moment the signature is reserved for.
//
// Accessibility is non-negotiable here: each statement is read as one VoiceOver
// label, the progress reads "Step n of 3", Continue/Skip are labelled buttons, and
// the entrance collapses to instant under Reduce Motion (immediate spring via
// useMotion).
import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { palette, radius, spacing } from '../../theme/dusk';
import { Background } from '../components/Background';
import { AppText } from '../components/AppText';
import { Surface } from '../components/Surface';
import { PrimaryButton } from '../components/PrimaryButton';
import { Press } from '../components/Press';
import { useMotion } from '../hooks/useMotion';

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
  const { reduced, durations, springs } = useMotion();
  const [index, setIndex] = useState(0);
  const isLast = index === BEATS.length - 1;
  const beat = BEATS[index];

  // Beat-to-beat: the old statement fades down fast, then the new one rises on
  // the layout spring (the entrance effect below fires on the index change).
  // All UI-thread; under Reduce Motion the swap is instant.
  const enter = useSharedValue(0);
  useEffect(() => {
    enter.value = withSpring(1, springs.layout);
  }, [index, springs, enter]);

  const entranceStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ translateY: (1 - enter.value) * 16 }],
  }));

  // next === null -> leave onboarding entirely.
  const goTo = useCallback(
    (next: number | null) => {
      const apply = () => (next == null ? onDone() : setIndex(next));
      if (reduced) {
        apply();
        return;
      }
      enter.value = withTiming(0, { duration: durations.instant }, (finished) => {
        'worklet';
        if (finished) runOnJS(apply)();
      });
    },
    [reduced, durations, enter, onDone],
  );

  const advance = () => goTo(isLast ? null : index + 1);

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
          <Press
            onPress={() => goTo(null)}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Skip the intro"
          >
            <AppText variant="caption" color={palette.textTertiary}>
              Skip
            </AppText>
          </Press>
        </View>

        <View style={styles.center}>
          <Animated.View style={entranceStyle}>
            <Surface radius={radius.card} style={styles.card}>
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
            </Surface>
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
