// src/screens/SmokeScreen.tsx
// Phase-0 smoke test ONLY. No navigation, no real data. It exists to prove the
// system end to end: Background -> GlassSurface (real glass on iOS 26, intentional
// fallback elsewhere) -> Money (tabular, de-emphasized $) -> apricot CTA. Every
// value on screen is a placeholder, clearly labelled as such.
//
// Note: a lone glass card is NOT wrapped in <GlassContainer> — the native container
// traces a hard merged-glass rectangle around its contents. GlassContainer is for
// grouping MULTIPLE surfaces so their effects merge.
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { gradients, palette, radius, spacing } from '../../theme/dusk';
import { Background } from '../components/Background';
import { GlassSurface } from '../components/GlassSurface';
import { Money } from '../components/Money';
import { AppText } from '../components/AppText';

function CtaButton({ label, onPress }: { label: string; onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.cta, { opacity: pressed ? 0.85 : 1 }]}
    >
      <LinearGradient
        colors={gradients.cta.colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <AppText variant="title" color={palette.onSignature}>
        {label}
      </AppText>
    </Pressable>
  );
}

export function SmokeScreen() {
  return (
    <Background>
      <View style={styles.screen}>
        <GlassSurface radius={radius.xl} interactive style={styles.card}>
          <View style={styles.cardInner}>
            <AppText variant="overline" color={palette.textSecondary}>
              AVAILABLE BALANCE
            </AppText>

            <Money value={4820.57} variant="numXL" color={palette.signature} style={styles.amount} />

            <AppText variant="caption" color={palette.textTertiary}>
              Placeholder figure · as of today
            </AppText>

            <View style={styles.actions}>
              <CtaButton label="Connect an account" />
            </View>
          </View>
        </GlassSurface>
      </View>
    </Background>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  card: {
    width: '100%',
  },
  cardInner: {
    padding: spacing.xxl,
  },
  amount: {
    marginTop: spacing.sm,
  },
  actions: {
    marginTop: spacing.xl,
  },
  cta: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
