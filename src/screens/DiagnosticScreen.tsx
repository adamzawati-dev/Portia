// src/screens/DiagnosticScreen.tsx
// The day-one Diagnostic — the screenshottable hero moment. Portia has read your
// history and drops it one truth at a time: a full-screen card per segment, a huge
// apricot figure that counts up, one line of voice. Auto-advances (~2.8s) with
// tap-to-skip; the last card is the hook + a CTA into the app. Runs once, between
// bank-link and the tabs (see the 'diagnostic' phase in src/auth/session).
//
// Boundary: every figure and line come from GET /diagnostic. The count-up only
// animates toward the real value; nothing here is invented. Reduce Motion collapses
// the whole thing to instant, static cards.
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { motion, palette, spacing } from '../../theme/dusk';
import { Background } from '../components/Background';
import { AppText } from '../components/AppText';
import { Money } from '../components/Money';
import { PrimaryButton } from '../components/PrimaryButton';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useCountUp } from '../hooks/useCountUp';
import { api, Diagnostic, DiagnosticSegment } from '../api/client';

const AUTO_MS = 2800;

// Generation lands ~10-30s after the history backfill finishes, but the backfill
// itself takes minutes — poll quickly at first, then relax, for up to POLL_MAX_MS
// before offering the escape hatch. 'ready' persists server-side, so a user who
// leaves gets the reveal on their next cold open (session routes 'ready' back here).
const POLL_STEPS_MS = [2000, 3000, 5000, 5000, 8000, 10000];
const POLL_MAX_MS = 180_000;

// Portia-voiced waiting copy, rotated while the engine reads the history.
const WAIT_LINES = [
  'Reading your last two years…',
  'Every transaction. Every pattern. Give me a minute.',
  'Almost there. This part is worth the wait.',
];
const WAIT_LINE_MS = 8000;

export function DiagnosticScreen({ onDone }: { onDone: () => void }) {
  const reduced = useReducedMotion();
  const [diag, setDiag] = useState<Diagnostic | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const [waitLine, setWaitLine] = useState(0);
  const [index, setIndex] = useState(0);

  // Poll with backoff until the diagnostic is ready or POLL_MAX_MS passes. Fetch
  // errors are treated as pending (transient network) — the timeout view is the
  // honest end state either way. Polling GET /diagnostic also lets the backend
  // retry a crashed generation (the pull-based kick).
  useEffect(() => {
    let active = true;
    let elapsed = 0;
    let step = 0;

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
          setDiag(d);
          if (d.state === 'pending') schedule();
        })
        .catch(() => active && schedule());
    };

    load();
    return () => {
      active = false;
    };
  }, []);

  // Rotate the waiting copy so the screen reads as alive, not stuck.
  useEffect(() => {
    const t = setInterval(() => setWaitLine((i) => (i + 1) % WAIT_LINES.length), WAIT_LINE_MS);
    return () => clearInterval(t);
  }, []);

  const segments = diag?.segments ?? [];
  const ready = !!diag && (diag.state === 'ready' || diag.state === 'done') && segments.length > 0;
  const isLast = index >= segments.length - 1;

  // A non-pending state with nothing to show ('none', or a legacy done-with-empty
  // row). Never silently skip — say something, then let them in.
  const empty = !!diag && diag.state !== 'pending' && segments.length === 0;

  // A light tap each time a card lands (the first card included). .catch keeps it a
  // no-op if the native module isn't present (e.g. an older build).
  useEffect(() => {
    if (!ready) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, [ready, index]);

  // Auto-advance, except on the last card (which waits on the CTA).
  useEffect(() => {
    if (!ready || isLast) return;
    const t = setTimeout(() => setIndex((i) => i + 1), AUTO_MS);
    return () => clearTimeout(t);
  }, [ready, index, isLast]);

  const advance = () => {
    if (!ready) return;
    setIndex((i) => Math.min(i + 1, segments.length - 1));
  };

  const finish = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    onDone();
  };

  if (!ready) {
    // Terminal non-reveal states get a line and a door — never a silent skip and
    // never a frozen screen.
    if (empty || timedOut) {
      return (
        <Background>
          <View style={styles.centerWrap}>
            <AppText variant="title" color={palette.textSecondary} style={styles.loading}>
              {empty
                ? "Your read-through isn't ready to show. I'll bring what I found into our chat."
                : "Your history is bigger than most — I'm still reading. I'll have the full picture next time you're here."}
            </AppText>
            <View style={styles.escape}>
              <PrimaryButton label="Into the app" icon="arrow.right" onPress={onDone} />
            </View>
          </View>
        </Background>
      );
    }

    return (
      <Background>
        <View style={styles.centerWrap}>
          <AppText variant="title" color={palette.textSecondary} style={styles.loading}>
            {WAIT_LINES[waitLine]}
          </AppText>
        </View>
      </Background>
    );
  }

  const segment = segments[index];
  return (
    <Background>
      <Pressable style={styles.flex} onPress={isLast ? undefined : advance} accessibilityRole="button">
        <View style={styles.flex}>
          <Progress count={segments.length} index={index} />
          <DiagnosticCard key={segment.id} segment={segment} reduced={reduced} />
          <Footer isLast={isLast} onDone={finish} />
        </View>
      </Pressable>
    </Background>
  );
}

function DiagnosticCard({ segment, reduced }: { segment: DiagnosticSegment; reduced: boolean }) {
  const hasFigure = segment.figure != null;
  const figure = useCountUp(segment.figure ?? 0, 1100, !reduced && hasFigure);

  // Staggered entrance: label, figure, caption rise + fade in turn.
  const anim = useRef([0, 1, 2].map(() => new Animated.Value(reduced ? 1 : 0))).current;
  useEffect(() => {
    if (reduced) return;
    Animated.stagger(
      motion.revealStagger,
      anim.map((v) =>
        Animated.spring(v, {
          toValue: 1,
          damping: motion.springSoft.damping,
          stiffness: motion.springSoft.stiffness,
          mass: motion.springSoft.mass,
          useNativeDriver: true,
        }),
      ),
    ).start();
  }, [anim, reduced]);

  const entrance = (v: Animated.Value) => ({
    opacity: v,
    transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
  });

  return (
    <View style={styles.cardWrap}>
      <Animated.View style={entrance(anim[0])}>
        <AppText variant="overline" color={palette.textTertiary} style={styles.label}>
          {segment.label}
        </AppText>
      </Animated.View>

      {hasFigure ? (
        <Animated.View style={[styles.figure, entrance(anim[1])]}>
          <Money value={figure} variant="numHero" color={palette.signature} showCents={false} />
        </Animated.View>
      ) : null}

      <Animated.View style={entrance(anim[2])}>
        <AppText variant="title" color={palette.textSecondary} style={styles.caption}>
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
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={[styles.dot, i === index ? styles.dotOn : styles.dotOff]}
        />
      ))}
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
  dot: {
    height: 4,
    borderRadius: 2,
  },
  dotOn: {
    width: 22,
    backgroundColor: palette.signature,
  },
  dotOff: {
    width: 7,
    backgroundColor: palette.textTertiary,
    opacity: 0.5,
  },
  footer: {
    paddingHorizontal: spacing.xl,
    minHeight: 80,
    justifyContent: 'flex-end',
  },
  hint: {
    textAlign: 'center',
  },
});
