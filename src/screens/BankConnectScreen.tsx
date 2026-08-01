// src/screens/BankConnectScreen.tsx
// The trust moment — the highest-stakes screen in the app. A normal person is about
// to connect real bank data, so the design does LESS, not more: generous air, plain
// (non-interactive) glass, signature spent only on the single CTA, no coral, no
// pulse. The headline and three short assurances carry the privacy posture —
// credentials never reach us, read-only, deletable — because a loud trust screen
// reads as a scam.
//
// The CTA runs the native Plaid Link flow (src/plaid/link). After a successful link
// the screen switches to a "connected so far" view — most people have several
// accounts, and a diagnostic computed from one bank is the wrong-picture failure the
// engine exists to prevent — with "Add another account" looping back into Plaid and
// "Continue" telling the backend the user is done (POST /plaid/linking-done releases
// the diagnostic hold) before onConnected routes onward.
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import type { SFSymbol } from 'expo-symbols';
import { palette, radius, spacing } from '../../theme/dusk';
import { Background } from '../components/Background';
import { AppText } from '../components/AppText';
import { GlassSurface } from '../components/GlassSurface';
import { PrimaryButton } from '../components/PrimaryButton';
import { api } from '../api/client';
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
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Institutions linked THIS session — for a first-time user that is everything they
  // have, so no round-trip needed to show "connected so far".
  const [linked, setLinked] = useState<string[]>([]);

  const handleConnect = async () => {
    setError(null);
    setConnecting(true);
    try {
      const result = await connectBank();
      setConnecting(false);
      if (result.duplicate) {
        setError('That bank was already connected — nothing changed.');
        return;
      }
      setLinked((prev) => [...prev, ...result.linked.map((l) => l.institutionName)]);
    } catch (e) {
      setConnecting(false);
      if (e instanceof PlaidCanceled) return; // backed out — not an error
      setError("Couldn't connect that bank. Try again.");
    }
  };

  const handleContinue = async () => {
    setError(null);
    setFinishing(true);
    try {
      await api.finishLinking(); // releases the diagnostic hold server-side
      onConnected(); // routes away; leave `finishing` true through the unmount
    } catch {
      setFinishing(false);
      setError("Couldn't wrap that up. Try again.");
    }
  };

  if (linked.length > 0) {
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
              Connected.
            </AppText>
            <AppText variant="body" color={palette.textSecondary} style={styles.subhead}>
              The more I can see, the straighter I can talk. Credit cards and savings
              accounts count double.
            </AppText>
          </View>

          <GlassSurface radius={radius.lg} style={styles.card}>
            {linked.map((name, i) => (
              <View key={`${name}-${i}`} style={[styles.row, i > 0 && { marginTop: spacing.lg }]}>
                <View style={styles.iconWell}>
                  <SymbolView
                    name="checkmark.circle.fill"
                    size={19}
                    tintColor={palette.signature}
                    weight="medium"
                  />
                </View>
                <AppText variant="title" color={palette.textPrimary}>
                  {name}
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
            <Pressable
              onPress={handleConnect}
              disabled={connecting || finishing}
              accessibilityRole="button"
              style={styles.addAnother}
            >
              <SymbolView name="plus.circle" size={16} tintColor={palette.textSecondary} />
              <AppText variant="title" color={palette.textSecondary}>
                {connecting ? 'Opening Plaid…' : 'Add another account'}
              </AppText>
            </Pressable>
            <PrimaryButton
              label="Continue"
              icon="arrow.right"
              onPress={handleContinue}
              loading={finishing}
            />
          </View>
        </View>
      </Background>
    );
  }

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
  addAnother: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
});
