// src/screens/BankConnectScreen.tsx
// The trust moment — the highest-stakes screen in the app. A normal person is about
// to connect real bank data, so the design does LESS, not more: generous air, the
// assurances as flat editorial rows directly on the environment (no cards, no
// boxes — the same no-container language as Overview and chat), signature spent
// only on the single CTA, no coral, no pulse. The headline and three short assurances carry the privacy posture —
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
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import type { SFSymbol } from 'expo-symbols';
import { palette, radius, spacing } from '../../theme/dusk';
import { haptic } from '../../theme/haptics';
import { Background } from '../components/Background';
import { AppText } from '../components/AppText';
import { Press } from '../components/Press';
import { PrimaryButton } from '../components/PrimaryButton';
import { OverviewSkeleton } from '../components/Skeleton';
import { api } from '../api/client';
import { connectBank, PlaidCanceled } from '../plaid/link';

type Assurance = { icon: SFSymbol; title: string };

const ASSURANCES: Assurance[] = [
  { icon: 'lock.fill', title: 'Your login never reaches me' },
  { icon: 'eye.fill', title: 'Read-only, always' },
  { icon: 'trash.fill', title: 'Gone when you say so' },
];

// A bank that was already linked (the user came back to this screen after leaving
// before 'Continue', or picked the same bank twice). Not an error: it still counts
// as connected, so the user can continue instead of dead-ending.
const ALREADY_LINKED_LABEL = 'Your bank';

export function BankConnectScreen({ onConnected }: { onConnected: () => Promise<void> }) {
  const insets = useSafeAreaInsets();
  const [connecting, setConnecting] = useState(false);
  // While the exchange or the wrap-up round-trip runs, the screen becomes the
  // Overview's own skeleton with one status line — never a blocking spinner.
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Quiet status (not an error) above the actions, e.g. a duplicate link.
  const [notice, setNotice] = useState<string | null>(null);
  // Institutions linked THIS session — for a first-time user that is everything they
  // have, so no round-trip needed to show "connected so far".
  const [linked, setLinked] = useState<string[]>([]);

  const handleConnect = async () => {
    setError(null);
    setNotice(null);
    setConnecting(true);
    try {
      // The syncing view takes over once the Plaid sheet succeeds and the
      // exchange starts (the sheet covers the screen until then).
      const result = await connectBank(() => setSyncing(true));
      setSyncing(false);
      setConnecting(false);
      const names = result.linked.map((l) => l.institutionName);
      if (result.duplicate) {
        // Already linked server-side. Show it as connected (by name when the
        // response carries one) so 'Continue' is on screen, and say so.
        setLinked((prev) => {
          const fresh = names.filter((n) => !prev.includes(n));
          if (fresh.length > 0) return [...prev, ...fresh];
          return prev.length > 0 ? prev : [ALREADY_LINKED_LABEL];
        });
        setNotice('Already connected.');
        return;
      }
      haptic.success();
      setLinked((prev) => [...prev, ...names]);
    } catch (e) {
      setSyncing(false);
      setConnecting(false);
      if (e instanceof PlaidCanceled) return; // backed out — not an error
      setError("Couldn't connect that bank. Try again.");
    }
  };

  const handleContinue = async () => {
    setError(null);
    setNotice(null);
    setSyncing(true);
    try {
      await api.finishLinking(); // releases the diagnostic hold server-side
      // Routes onward (a /me round-trip); syncing stays on through the unmount.
      // Awaited so a failed route lands in the catch below with a retry, instead
      // of stranding the user on the syncing skeleton with no exit.
      await onConnected();
    } catch {
      setSyncing(false);
      setError("Couldn't wrap that up. Try again.");
    }
  };

  if (syncing) {
    return (
      <Background>
        <View
          style={[
            styles.root,
            { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.xl },
          ]}
        >
          <AppText variant="title" color={palette.textSecondary} style={styles.syncLine}>
            Pulling your accounts…
          </AppText>
          <OverviewSkeleton />
        </View>
      </Background>
    );
  }

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

          <View style={styles.rows}>
            {linked.map((name, i) => (
              <View key={`${name}-${i}`} style={styles.row}>
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
          </View>

          <View style={styles.footer}>
            {error ? (
              <AppText variant="caption" color={palette.attention} style={styles.error}>
                {error}
              </AppText>
            ) : notice ? (
              <AppText variant="caption" color={palette.textSecondary} style={styles.error}>
                {notice}
              </AppText>
            ) : null}
            <Press
              onPress={handleConnect}
              disabled={connecting}
              accessibilityRole="button"
              style={styles.addAnother}
            >
              <SymbolView name="plus.circle" size={16} tintColor={palette.textSecondary} />
              <AppText variant="title" color={palette.textSecondary}>
                {connecting ? 'Opening Plaid…' : 'Add another account'}
              </AppText>
            </Press>
            <PrimaryButton label="Continue" icon="arrow.right" onPress={handleContinue} />
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

        <View style={styles.rows}>
          {ASSURANCES.map((a) => (
            <View key={a.title} style={styles.row}>
              <View style={styles.iconWell}>
                <SymbolView name={a.icon} size={19} tintColor={palette.signature} weight="medium" />
              </View>
              <AppText variant="title" color={palette.textPrimary}>
                {a.title}
              </AppText>
            </View>
          ))}
        </View>

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
  syncLine: {
    marginBottom: spacing.xl,
  },
  subhead: {
    marginTop: spacing.md,
    maxWidth: 320,
  },
  rows: {
    marginTop: spacing.xxl * 2,
    gap: spacing.xl,
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
