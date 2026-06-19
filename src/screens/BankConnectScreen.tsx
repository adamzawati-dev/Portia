// src/screens/BankConnectScreen.tsx
// The trust moment — the highest-stakes screen in the app. A normal person is about
// to connect real bank data, so the design does LESS, not more: generous air, plain
// (non-interactive) glass, signature spent only on the single CTA, no coral, no
// pulse. The headline and three short assurances carry the privacy posture —
// credentials never reach us, read-only, deletable — because a loud trust screen
// reads as a scam.
//
// The CTA runs the native Plaid Link flow (src/plaid/link); on a successful link it
// calls onConnected, which re-checks onboarding state and routes the user onward.
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import type { SFSymbol } from 'expo-symbols';
import { palette, radius, spacing } from '../../theme/dusk';
import { Background } from '../components/Background';
import { AppText } from '../components/AppText';
import { GlassSurface } from '../components/GlassSurface';
import { PrimaryButton } from '../components/PrimaryButton';
import { connectBank, PlaidCanceled } from '../plaid/link';

type Assurance = { icon: SFSymbol; title: string };

const ASSURANCES: Assurance[] = [
  { icon: 'lock.fill', title: 'Your login never reaches me' },
  { icon: 'eye.fill', title: 'Read-only, always' },
  { icon: 'trash.fill', title: 'Gone when you say so' },
];

export function BankConnectScreen({ onConnected }: { onConnected: () => void }) {
  const insets = useSafeAreaInsets();
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async () => {
    setError(null);
    setConnecting(true);
    try {
      await connectBank();
      onConnected(); // routes away; leave `connecting` true through the unmount
    } catch (e) {
      setConnecting(false);
      if (e instanceof PlaidCanceled) return; // backed out — not an error
      setError("Couldn't connect that bank. Try again.");
    }
  };

  return (
    <Background>
      <View
        style={[
          styles.root,
          { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.xl },
        ]}
      >
        <View style={styles.hero}>
          <AppText variant="display" color={palette.textPrimary}>
            Connect your bank.
          </AppText>
          <AppText variant="body" color={palette.textSecondary} style={styles.subhead}>
            I'll read it, keep it current, and only speak up when something matters. You do
            nothing after this.
          </AppText>
        </View>

        <GlassSurface radius={radius.lg} style={styles.card}>
          {ASSURANCES.map((a, i) => (
            <View key={a.title} style={[styles.row, i > 0 && { marginTop: spacing.lg }]}>
              <View style={styles.iconWell}>
                <SymbolView name={a.icon} size={19} tintColor={palette.signature} weight="medium" />
              </View>
              <AppText variant="title" color={palette.textPrimary}>
                {a.title}
              </AppText>
            </View>
          ))}
        </GlassSurface>

        <View style={styles.footer}>
          {error ? (
            <AppText variant="caption" color={palette.attention} style={styles.error}>
              {error}
            </AppText>
          ) : null}
          <PrimaryButton
            label="Connect with Plaid"
            icon="building.columns.fill"
            onPress={handleConnect}
            loading={connecting}
          />
          <View style={styles.caption}>
            <SymbolView name="lock.fill" size={11} tintColor={palette.textTertiary} />
            <AppText variant="caption" color={palette.textTertiary}>
              Bank-grade encryption · Powered by Plaid
            </AppText>
          </View>
        </View>
      </View>
    </Background>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: spacing.xl,
  },
  hero: {
    marginTop: spacing.xl,
  },
  subhead: {
    marginTop: spacing.md,
    maxWidth: 320,
  },
  card: {
    marginTop: spacing.xxl,
    padding: spacing.xl,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconWell: {
    width: 30,
  },
  footer: {
    marginTop: 'auto',
    gap: spacing.md,
  },
  error: {
    textAlign: 'center',
  },
  caption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
});
