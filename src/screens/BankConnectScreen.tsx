// src/screens/BankConnectScreen.tsx
// The trust moment — the highest-stakes screen in the app. A normal person is about
// to connect real bank data, so the design does LESS, not more: generous air, plain
// (non-interactive) glass, signature spent only on the single CTA, no coral, no
// pulse. The job is to make the privacy posture VISIBLE — credentials never reach
// us, read-only, deletable — because a loud trust screen reads as a scam.
//
// Phase 3 design pass. The CTA is wired to an `onConnect` prop; the Plaid Link SDK
// flow that fills it lands once this design is approved (see docs/api-contract.md
// /plaid/link-token + /plaid/exchange).
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import type { SFSymbol } from 'expo-symbols';
import { palette, radius, spacing } from '../../theme/dusk';
import { Background } from '../components/Background';
import { AppText } from '../components/AppText';
import { GlassSurface } from '../components/GlassSurface';
import { PrimaryButton } from '../components/PrimaryButton';

type Assurance = { icon: SFSymbol; title: string; detail: string };

const ASSURANCES: Assurance[] = [
  {
    icon: 'lock.fill',
    title: 'Your login never reaches me',
    detail: 'It goes straight to Plaid. I only ever hold an encrypted token — never your password.',
  },
  {
    icon: 'eye.fill',
    title: 'Read-only, always',
    detail: 'I can see your transactions. I can never move, send, or touch a cent.',
  },
  {
    icon: 'trash.fill',
    title: 'Gone when you say so',
    detail: 'One tap wipes everything and disconnects your bank for good.',
  },
];

export function BankConnectScreen({
  onConnect,
  connecting,
}: {
  onConnect: () => void;
  connecting?: boolean;
}) {
  const insets = useSafeAreaInsets();
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
            <View
              key={a.title}
              style={[styles.row, i > 0 && { marginTop: spacing.xl }]}
            >
              <View style={styles.iconWell}>
                <SymbolView
                  name={a.icon}
                  size={19}
                  tintColor={palette.signature}
                  weight="medium"
                />
              </View>
              <View style={styles.rowText}>
                <AppText variant="title" color={palette.textPrimary}>
                  {a.title}
                </AppText>
                <AppText variant="body" color={palette.textSecondary} style={styles.detail}>
                  {a.detail}
                </AppText>
              </View>
            </View>
          ))}
        </GlassSurface>

        <View style={styles.footer}>
          <PrimaryButton
            label="Connect with Plaid"
            icon="building.columns.fill"
            onPress={onConnect}
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
    alignItems: 'flex-start',
  },
  iconWell: {
    width: 30,
    paddingTop: spacing.xs / 2,
  },
  rowText: {
    flex: 1,
  },
  detail: {
    marginTop: spacing.xs,
  },
  footer: {
    marginTop: 'auto',
    gap: spacing.md,
  },
  caption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
});
