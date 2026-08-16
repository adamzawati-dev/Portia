// src/screens/SmokeScreen.tsx
// Phase-0 smoke test ONLY. No navigation, no real data. It exists to prove the
// system end to end: Background -> Surface (flat content card) -> Money (tabular,
// de-emphasized $) -> apricot CTA via Press. Every value on screen is a
// placeholder, clearly labelled as such.
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { gradients, palette, radius, spacing } from '../../theme/dusk';
import { Background } from '../components/Background';
import { Surface } from '../components/Surface';
import { Money } from '../components/Money';
import { AppText } from '../components/AppText';
import { Press } from '../components/Press';

function CtaButton({ label, onPress }: { label: string; onPress?: () => void }) {
  return (
    <Press commit onPress={onPress} accessibilityRole="button" style={styles.cta}>
      <LinearGradient
        colors={gradients.cta.colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <AppText variant="title" color={palette.onSignature}>
        {label}
      </AppText>
    </Press>
  );
}

export function SmokeScreen() {
  return (
    <Background>
      <View style={styles.screen}>
        <Surface radius={radius.card} style={styles.card}>
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
        </Surface>
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
    borderRadius: radius.button,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
