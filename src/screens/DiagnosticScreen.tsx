// src/screens/DiagnosticScreen.tsx
// The day-one Diagnostic — the screenshottable hero moment. Portia has read your
// history and drops it one truth at a time: a full-screen card per segment, a huge
// apricot figure that counts up, one line of voice. Auto-advances (~2.8s) with
// tap-to-skip; the last card is the hook + a CTA into the app. Runs once, and is
// only ever entered when the read is READY: either the cold-open route (an
// unviewed reveal plays first -- see src/auth/session) or the in-app SyncChip
// invite (presented as a modal from MainTabs). Syncing never blocks on this
// screen anymore; that wait lives in the app as streamed progress.
//
// Boundary: every figure and line come from GET /diagnostic. The count-up only
// animates toward the real value; nothing here is invented. All motion is
// Reanimated on the UI thread; Reduce Motion collapses it to instant, static
// cards (immediate springs + zero stagger via useMotion).
import React, { useCallback, useEffect, useState } from 'react';
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
import { palette, spacing } from '../../theme/dusk';
import { haptic } from '../../theme/haptics';
import { Background } from '../components/Background';
import { AppText } from '../components/AppText';
import { Money } from '../components/Money';
import { PrimaryButton } from '../components/PrimaryButton';
import { ProgressDots } from '../components/ProgressDots';
import { Press } from '../components/Press';
import { useMotion, Motion } from '../hooks/useMotion';
import { useCountUp } from '../hooks/useCountUp';
import { api, Diagnostic, DiagnosticSegment } from '../api/client';

const AUTO_MS = 2800;

// Generation lands ~10-30s after the history backfill finishes, but the backfill
// itself takes minutes — poll quickly at first, then relax, for up to POLL_MAX_MS
// before offering the escape hatch. 'ready' persists server-side, so a user who
// leaves gets the reveal on their next cold open (session routes 'ready' back here).
const POLL_STEPS_MS = [2000, 3000, 5000, 5000, 8000, 10000];
const POLL_MAX_MS = 180_000;
// Consecutive fetch failures (no payload at all) before the screen stops calling
// it "pending" and says the connection is the problem. A real 'pending' resets it.
const UNREACHABLE_AFTER = 3;

export function DiagnosticScreen({ onDone }: { onDone: () => void }) {
  const motion = useMotion();
  const [diag, setDiag] = useState<Diagnostic | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  // The last several attempts returned no payload (network / ApiError): a
  // different truth from a real 'pending', and it gets its own line and a Retry.
  const [unreachable, setUnreachable] = useState(false);
  // Bumped by Retry to restart the poll from scratch.
  const [attempt, setAttempt] = useState(0);
  const [index, setIndex] = useState(0);

  // Poll with backoff until the diagnostic is ready or POLL_MAX_MS passes. A
  // genuine 'pending' payload keeps polling toward the timeout view; repeated
  // fetch failures stop and say so instead. Polling GET /diagnostic also lets the
  // backend retry a crashed generation (the pull-based kick).
  useEffect(() => {
    let active = true;
    let elapsed = 0;
    let step = 0;
    let failures = 0;

    const schedule = () => {
      const delay = POLL_STEPS_MS[Math.min(step, POLL_STEPS_MS.length - 1)];
      step += 1;
      elapsed += delay;
      if (elapsed > POLL_MAX_MS) {
        setTimedOut(true);
        return;
      }
      setTimeout(() => active && load(), delay);
    };

    const load = () => {
      api
        .getDiagnostic()
        .then((d) => {
          if (!active) return;
          failures = 0;
          setDiag(d);
          if (d.state === 'pending') schedule();
        })
        .catch(() => {
          if (!active) return;
          failures += 1;
          if (failures >= UNREACHABLE_AFTER) setUnreachable(true);
          else schedule();
        });
    };

    load();
    return () => {
      active = false;
    };
  }, [attempt]);

  const retry = () => {
    setUnreachable(false);
    setTimedOut(false);
    setAttempt((n) => n + 1);
  };

  const segments = diag?.segments ?? [];
  const ready = !!diag && (diag.state === 'ready' || diag.state === 'done') && segments.length > 0;
  const isLast = index >= segments.length - 1;

  // A non-pending state with nothing to show ('none', or a legacy done-with-empty
  // row). Never silently skip — say something, then let them in.
  const empty = !!diag && diag.state !== 'pending' && segments.length === 0;

  // Each card landing is a commit — a truth dropped. The first card fires here;
  // manual advances get their commit from the full-screen <Press commit>; the
  // auto-advance timer fires its own (below). The three never double up.
  useEffect(() => {
    if (ready) haptic.commit();
  }, [ready]);

  // Card-to-card: the old card fades out fast, then the next mounts and runs
  // its own staggered entrance — no hard cut. Instant under Reduce Motion.
  const cardAlpha = useSharedValue(1);
  const advanceTo = useCallback(
    (next: number) => {
      if (motion.reduced) {
        setIndex(next);
        return;
      }
      cardAlpha.value = withTiming(0, { duration: motion.durations.instant }, (finished) => {
        'worklet';
        if (finished) runOnJS(setIndex)(next);
      });
    },
    [motion, cardAlpha],
  );
  useEffect(() => {
    cardAlpha.value = 1; // the new card's children start hidden; snap the shell back
  }, [index, cardAlpha]);
  const cardShell = useAnimatedStyle(() => ({ opacity: cardAlpha.value, flex: 1 }));

  // Auto-advance, except on the last card (which waits on the CTA).
  useEffect(() => {
    if (!ready || isLast) return;
    const t = setTimeout(() => {
      haptic.commit();
      advanceTo(index + 1);
    }, AUTO_MS);
    return () => clearTimeout(t);
  }, [ready, index, isLast, advanceTo]);

  const advance = () => {
    if (!ready) return;
    advanceTo(Math.min(index + 1, segments.length - 1));
  };

  const finish = () => {
    // The CTA's <Press commit> supplies the haptic. Fire-and-forget: seeds
    // Portia's opening line server-side so the chat continues what the reveal
    // started. Never blocks this transition — the chat screen's first history
    // fetch collects it (with a brief empty-thread re-check).
    api.continueDiagnostic().catch(() => {});
    onDone();
  };

  if (!ready) {
    // Terminal non-reveal states get a line and a door -- never a silent skip and
    // never a frozen screen. Unreachable also gets a Retry that restarts polling.
    if (empty || timedOut || unreachable) {
      return (
        <Background>
          <View style={styles.centerWrap}>
            <AppText variant="title" color={palette.textSecondary} style={styles.loading}>
              {unreachable
                ? "Couldn't reach Portia. Check your connection."
                : empty
                  ? "Your read-through isn't ready to show. I'll bring what I found into our chat."
                  : "Still building your first read. I'll have it next time you're here."}
            </AppText>
            {unreachable ? (
              <Press
                onPress={retry}
                hitSlop={spacing.xs}
                accessibilityRole="button"
                accessibilityLabel="Retry"
                style={styles.retry}
              >
                <AppText variant="title" color={palette.signature}>
                  Retry
                </AppText>
              </Press>
            ) : null}
            <View style={styles.escape}>
              <PrimaryButton label="Into the app" icon="arrow.right" onPress={onDone} />
            </View>
          </View>
        </Background>
      );
    }

    // Normally a sub-second fetch: this screen is only ever entered when the read
    // is ready (cold-open route or the chip invite). Skip is present from the first
    // frame -- never a screen the user can't leave.
    return (
      <Background>
        <View style={styles.centerWrap}>
          <AppText variant="title" color={palette.textSecondary} style={styles.loading}>
            One second, pulling it up.
          </AppText>
        </View>
        <SkipButton onSkip={onDone} />
      </Background>
    );
  }

  const segment = segments[index];
  return (
    <Background>
      <Press
        commit
        scaleTo={1}
        style={styles.flex}
        onPress={isLast ? undefined : advance}
        accessibilityRole="button"
      >
        <View style={styles.flex}>
          <Progress count={segments.length} index={index} />
          <Animated.View style={cardShell}>
            <DiagnosticCard key={segment.id} segment={segment} motion={motion} />
          </Animated.View>
          <Footer isLast={isLast} onDone={finish} />
        </View>
      </Press>
      {/* The reveal is skippable — same door as finishing, without the tour. */}
      <SkipButton onSkip={finish} />
    </Background>
  );
}

function SkipButton({ onSkip }: { onSkip: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <Press
      onPress={onSkip}
      hitSlop={14}
      accessibilityRole="button"
      accessibilityLabel="Skip to the app"
      style={[styles.skip, { top: insets.top + spacing.md }]}
    >
      <AppText variant="caption" color={palette.textTertiary}>
        Skip
      </AppText>
    </Press>
  );
}

function DiagnosticCard({ segment, motion }: { segment: DiagnosticSegment; motion: Motion }) {
  const hasFigure = segment.figure != null;
  const figure = useCountUp(segment.figure ?? 0, motion.durations.base, !motion.reduced && hasFigure);

  // Staggered entrance: label, figure, caption rise + fade in turn. The card
  // remounts per segment (keyed by id), so this runs once per card. Zero stagger
  // + immediate springs under Reduce Motion.
  const label = useSharedValue(0);
  const fig = useSharedValue(0);
  const caption = useSharedValue(0);
  useEffect(() => {
    const { revealStagger, springs } = motion;
    label.value = withSpring(1, springs.layout);
    fig.value = withDelay(revealStagger, withSpring(1, springs.layout));
    caption.value = withDelay(revealStagger * 2, withSpring(1, springs.layout));
  }, [motion, label, fig, caption]);

  const labelRise = useAnimatedStyle(() => ({
    opacity: label.value,
    transform: [{ translateY: (1 - label.value) * 14 }],
  }));
  const figRise = useAnimatedStyle(() => ({
    opacity: fig.value,
    transform: [{ translateY: (1 - fig.value) * 14 }],
  }));
  const captionRise = useAnimatedStyle(() => ({
    opacity: caption.value,
    transform: [{ translateY: (1 - caption.value) * 14 }],
  }));

  return (
    <View style={styles.cardWrap}>
      <Animated.View style={labelRise}>
        <AppText
          variant="overline"
          color={palette.textTertiary}
          style={styles.label}
          maxFontSizeMultiplier={1.35}
        >
          {segment.label}
        </AppText>
      </Animated.View>

      {hasFigure ? (
        <Animated.View style={[styles.figure, figRise]}>
          <Money value={figure} variant="numHero" color={palette.signature} showCents={false} />
        </Animated.View>
      ) : null}

      <Animated.View style={captionRise}>
        <AppText
          variant="title"
          color={palette.textSecondary}
          style={styles.caption}
          maxFontSizeMultiplier={1.35}
        >
          {segment.caption}
        </AppText>
      </Animated.View>
    </View>
  );
}

function Progress({ count, index }: { count: number; index: number }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.progress, { paddingTop: insets.top + spacing.md }]}>
      <ProgressDots count={count} index={index} />
    </View>
  );
}

function Footer({ isLast, onDone }: { isLast: boolean; onDone: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.xl }]}>
      {isLast ? (
        <PrimaryButton label="See the rest" icon="arrow.right" onPress={onDone} />
      ) : (
        <AppText variant="caption" color={palette.textTertiary} style={styles.hint}>
          Tap to continue
        </AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl },
  loading: { textAlign: 'center' },
  retry: { marginTop: spacing.lg, paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  escape: { marginTop: spacing.xxl, alignSelf: 'stretch' },
  cardWrap: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  label: {
    textTransform: 'uppercase',
    marginBottom: spacing.lg,
  },
  figure: {
    marginBottom: spacing.lg,
  },
  caption: {
    maxWidth: 320,
    lineHeight: 28,
  },
  progress: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.xl,
  },
  footer: {
    paddingHorizontal: spacing.xl,
    minHeight: 80,
    justifyContent: 'flex-end',
  },
  hint: {
    textAlign: 'center',
  },
  skip: {
    position: 'absolute',
    right: spacing.xl,
    zIndex: 5,
  },
});
