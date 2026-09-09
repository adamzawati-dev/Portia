// src/screens/OnboardingScreen.tsx
// The pre-auth intro: meeting Portia, not reading about her. Three beats:
//   1. She speaks -- her apricot rule draws itself in, then her opening line
//      arrives word by word, like speech, with a beat of timing before the
//      second sentence. The same mark and voice as every chat answer.
//   2. She works -- a miniature chat exchange assembles: a user question, her
//      real thinking states (the same step labels the product streams), then
//      her reply typing in, the figure igniting apricot as it lands.
//   3. She's trusted -- motion stops (restraint scales with stakes): one static
//      statement, then Get started into the sign-in surface.
// Continue and Skip are available at all times; nothing waits on the animation.
//
// Accessibility: each beat is one VoiceOver label (the full plain text -- the
// word-reveal is visual pacing, not content), progress reads "Step n of 3", and
// under Reduce Motion every beat renders complete and static instantly.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { palette, radius, spacing, surface } from '../../theme/dusk';
import { haptic } from '../../theme/haptics';
import { Background } from '../components/Background';
import { AppText } from '../components/AppText';
import { PrimaryButton } from '../components/PrimaryButton';
import { ProgressDots } from '../components/ProgressDots';
import { Press } from '../components/Press';
import { Surface } from '../components/Surface';
import { useMotion } from '../hooks/useMotion';

const BEAT_COUNT = 3;
const WORD_MS = 110; // ~9 words/sec -- speech pace, not teleprompter
const SENTENCE_PAUSE_MS = 400;
const THINK_STEP_MS = 900;
// The statements reserve a fixed 38pt leading (so the word-reveal never reflows);
// past this Dynamic Type scale the lines would collide. Callers can only lower
// AppText's cap, never raise it.
const STATEMENT_MAX_SCALE = 1.35;

// The demo exchange in beat two. Illustrative (the overline says so); the step
// labels are the REAL progress strings the backend streams while she works.
const DEMO_QUESTION = 'Can I afford a $400 flight to Lisbon?';
const DEMO_STEPS = ['Checking balances', 'Scanning transactions'];
const DEMO_REPLY = {
  before: "Yes, and it won't touch rent. You're ",
  accent: '$612 clear',
  after: ' over the next two weeks. Book it.',
};
const DEMO_REPLY_PLAIN = DEMO_REPLY.before + DEMO_REPLY.accent + DEMO_REPLY.after;

const BEAT_PLAIN = [
  "Most money apps make you feel bad about your money. I don't do that.",
  `What talking to me looks like. You: ${DEMO_QUESTION} Portia: ${DEMO_REPLY_PLAIN}`,
  'Read-only. I never move a cent, and I never guess a number. Everything I tell you is real.',
];

// Reveals `text` word by word once `active` flips true. Under Reduce Motion (or
// before activation on a finished beat) it returns the full text immediately.
function useWordReveal(text: string, active: boolean, reduced: boolean) {
  const words = useMemo(() => text.split(' '), [text]);
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (!active) return;
    if (reduced) {
      setShown(words.length);
      return;
    }
    setShown(0);
    const t = setInterval(
      () => setShown((n) => (n >= words.length ? n : n + 1)),
      WORD_MS,
    );
    return () => clearInterval(t);
  }, [active, reduced, words.length]);
  return { text: words.slice(0, shown).join(' '), done: shown >= words.length };
}

export function OnboardingScreen({ onDone }: { onDone: () => void }) {
  const insets = useSafeAreaInsets();
  const { reduced, durations, springs } = useMotion();
  const [index, setIndex] = useState(0);
  const isLast = index === BEAT_COUNT - 1;

  // Beat-to-beat: old content drops fast, the new beat mounts fresh (keyed) and
  // runs its own sequence. Instant under Reduce Motion.
  const enter = useSharedValue(0);
  useEffect(() => {
    enter.value = withSpring(1, springs.layout);
  }, [index, springs, enter]);
  const entranceStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ translateY: (1 - enter.value) * 16 }],
  }));

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
          <ProgressDots
            count={BEAT_COUNT}
            index={index}
            accessibilityRole="text"
            accessibilityLabel={`Step ${index + 1} of ${BEAT_COUNT}`}
          />
          <Press
            onPress={() => goTo(null)}
            hitSlop={14}
            accessibilityRole="button"
            accessibilityLabel="Skip the intro"
          >
            <AppText variant="caption" color={palette.textTertiary}>
              Skip
            </AppText>
          </Press>
        </View>

        <View style={styles.center}>
          <Animated.View
            style={entranceStyle}
            accessible
            accessibilityLabel={BEAT_PLAIN[index]}
          >
            {index === 0 && <BeatSpeak key="b0" reduced={reduced} />}
            {index === 1 && <BeatDemo key="b1" reduced={reduced} />}
            {index === 2 && <BeatTrust key="b2" />}
          </Animated.View>
        </View>

        <View style={styles.footer}>
          <PrimaryButton label={isLast ? 'Get started' : 'Continue'} onPress={advance} />
        </View>
      </View>
    </Background>
  );
}

// Beat 1 -- she speaks. Rule draws in, then two sentences at speech pace with a
// beat of silence between them. The pause IS the personality.
function BeatSpeak({ reduced }: { reduced: boolean }) {
  const [stage, setStage] = useState<'rule' | 'line1' | 'line2'>(reduced ? 'line2' : 'rule');

  const ruleScale = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    // A late flip to Reduce Motion must land on the finished beat, never strand
    // the sequence (the cleanup below cancels the timer that would advance it).
    if (reduced) {
      setStage('line2');
      return;
    }
    ruleScale.value = withDelay(150, withSpring(1, { damping: 18, stiffness: 180 }));
    const t = setTimeout(() => {
      haptic.tick();
      setStage('line1');
    }, 450);
    return () => clearTimeout(t);
  }, [reduced, ruleScale]);
  const ruleStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: ruleScale.value }],
  }));

  const line1 = useWordReveal(
    'Most money apps make you feel bad about your money.',
    stage !== 'rule',
    reduced,
  );
  useEffect(() => {
    if (stage === 'line1' && line1.done) {
      const t = setTimeout(() => setStage('line2'), SENTENCE_PAUSE_MS);
      return () => clearTimeout(t);
    }
  }, [stage, line1.done]);
  const line2 = useWordReveal("I don't do that.", stage === 'line2', reduced);

  return (
    <View>
      <Animated.View style={[styles.rule, ruleStyle]} />
      <AppText variant="display" style={styles.statement} maxFontSizeMultiplier={STATEMENT_MAX_SCALE}>
        {line1.text}
      </AppText>
      <AppText
        variant="display"
        style={[styles.statement, styles.line2]}
        maxFontSizeMultiplier={STATEMENT_MAX_SCALE}
      >
        {line2.text}
      </AppText>
    </View>
  );
}

// Beat 2 -- she works. The exchange assembles: question, her real thinking
// states, then the reply typing in; the figure ignites apricot as the sentence
// lands. All figures here are illustrative and the overline owns that.
function BeatDemo({ reduced }: { reduced: boolean }) {
  const [stage, setStage] = useState<'question' | 'thinking' | 'reply'>(
    reduced ? 'reply' : 'question',
  );
  const [step, setStep] = useState(0);

  // Question bubble springs in from the right, then she "thinks".
  const bubbleIn = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (reduced) {
      setStage('reply');
      return;
    }
    bubbleIn.value = withSpring(1, { damping: 20, stiffness: 160 });
    const t = setTimeout(() => setStage('thinking'), 700);
    return () => clearTimeout(t);
  }, [reduced, bubbleIn]);
  const bubbleStyle = useAnimatedStyle(() => ({
    opacity: bubbleIn.value,
    transform: [{ translateX: (1 - bubbleIn.value) * 28 }],
  }));

  // Thinking: cycle the real step labels once each, then the reply starts.
  useEffect(() => {
    if (stage !== 'thinking') return;
    const t = setInterval(() => {
      setStep((s) => {
        if (s + 1 >= DEMO_STEPS.length) {
          clearInterval(t);
          setStage('reply');
          return s;
        }
        return s + 1;
      });
    }, THINK_STEP_MS);
    return () => clearInterval(t);
  }, [stage]);

  const reply = useWordReveal(DEMO_REPLY_PLAIN, stage === 'reply', reduced);
  useEffect(() => {
    if (reply.done && stage === 'reply' && !reduced) haptic.tick();
  }, [reply.done, stage, reduced]);

  // While typing, the reply is plain; when the sentence lands the figure takes
  // the signature. One ignition, not a rainbow.
  const replyContent = reply.done ? (
    <AppText variant="title" style={styles.replyText}>
      {DEMO_REPLY.before}
      <AppText variant="title" color={palette.signature} tabular>
        {DEMO_REPLY.accent}
      </AppText>
      {DEMO_REPLY.after}
    </AppText>
  ) : (
    <AppText variant="title" style={styles.replyText}>
      {reply.text}
    </AppText>
  );

  return (
    <View>
      <AppText variant="overline" color={palette.textTertiary} style={styles.overline}>
        WHAT TALKING TO ME LOOKS LIKE
      </AppText>

      <Animated.View style={[styles.questionRow, bubbleStyle]}>
        <Surface radius={radius.card} tint={surface.userMessage} style={styles.questionBubble}>
          <AppText variant="body">{DEMO_QUESTION}</AppText>
        </Surface>
      </Animated.View>

      {stage === 'thinking' && (
        <View style={styles.replyRow}>
          <View style={styles.replyRule} />
          <AppText variant="caption" color={palette.textTertiary}>
            {DEMO_STEPS[step]}
          </AppText>
        </View>
      )}

      {stage === 'reply' && (
        <View style={styles.replyRow}>
          <View style={styles.replyRule} />
          {replyContent}
        </View>
      )}
    </View>
  );
}

// Beat 3 -- trust. Per the design system, trust surfaces get LESS: no typing, no
// springs, just the mark and the statement, still.
function BeatTrust() {
  return (
    <View>
      <View style={styles.rule} />
      <AppText variant="display" style={styles.statement} maxFontSizeMultiplier={STATEMENT_MAX_SCALE}>
        Read-only. I never move a cent, and I never guess a number. Everything I tell you is real.
      </AppText>
    </View>
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
  center: {
    flex: 1,
    justifyContent: 'center',
  },
  rule: {
    width: 22,
    height: 2,
    borderRadius: 1,
    backgroundColor: palette.signature,
    marginBottom: spacing.lg,
    transformOrigin: 'left',
  },
  statement: {
    // A touch more leading than the display token: this is a paragraph, not a label.
    lineHeight: 38,
    maxWidth: 330,
    // Reserve vertical space so word-reveal doesn't reflow the layout line by line.
    minHeight: 38 * 2,
  },
  line2: {
    marginTop: spacing.sm,
    minHeight: 38,
  },
  overline: {
    marginBottom: spacing.lg,
  },
  questionRow: {
    alignItems: 'flex-end',
    marginBottom: spacing.lg,
  },
  questionBubble: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    maxWidth: 300,
  },
  replyRow: {
    minHeight: 120,
  },
  replyRule: {
    width: 22,
    height: 2,
    borderRadius: 1,
    backgroundColor: palette.signature,
    marginBottom: spacing.md,
  },
  replyText: {
    maxWidth: 320,
    lineHeight: 28,
  },
  footer: {
    paddingTop: spacing.lg,
  },
});
