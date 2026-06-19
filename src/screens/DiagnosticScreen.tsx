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

export function DiagnosticScreen({ onDone }: { onDone: () => void }) {
  const reduced = useReducedMotion();
  const [diag, setDiag] = useState<Diagnostic | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);

  // Load; if the engine is still reading the history ('pending'), poll a few times.
  useEffect(() => {
    let active = true;
    let tries = 0;
    const load = () => {
      api
        .getDiagnostic()
        .then((d) => {
          if (!active) return;
          if (d.state === 'pending' && tries++ < 6) {
            setDiag(d);
            setTimeout(load, 1500);
            return;
          }
          setDiag(d);
        })
        .catch(() => active && setError("I couldn't pull your diagnostic just now."));
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  const segments = diag?.segments ?? [];
  const ready = !!diag && (diag.state === 'ready' || diag.state === 'done') && segments.length > 0;
  const isLast = index >= segments.length - 1;

  // Nothing to show (no diagnostic for this user) — skip straight through.
  useEffect(() => {
    if (diag && diag.state !== 'pending' && !ready && !error) onDone();
  }, [diag, ready, error, onDone]);

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
    return (
      <Background>
        <View style={styles.centerWrap}>
          <AppText variant="title" color={palette.textSecondary} style={styles.loading}>
            {error ?? 'Reading your last two years…'}
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
