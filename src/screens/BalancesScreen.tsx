// src/screens/BalancesScreen.tsx
// The balances/overview moment — a surface the chat can't give you. Numbers are the
// hero: one big apricot figure ("here's what's yours" — signature earned), then the
// accounts beneath in a calm ledger. Every figure comes from GET /accounts; the app
// sums nothing (the hero total is computed by the backend, per the contract).
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { glass, palette, radius, spacing } from '../../theme/dusk';
import { Background } from '../components/Background';
import { AppText } from '../components/AppText';
import { GlassSurface } from '../components/GlassSurface';
import { Money } from '../components/Money';
import { api, AccountsOverview, Account, ApiError } from '../api/client';

export function BalancesScreen() {
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<AccountsOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    api
      .getAccounts()
      .then((d) => active && setData(d))
      .catch((e) => {
        if (!active) return;
        setError(e instanceof ApiError ? e.message : "Couldn't load your accounts just now.");
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <Background>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <AppText variant="overline" color={palette.textTertiary}>
            AVAILABLE CASH
          </AppText>
          {data ? (
            <>
              <Money
                value={data.summary.cashAvailable}
                variant="numXL"
                color={palette.signature}
                style={styles.heroFigure}
              />
              <AppText variant="caption" color={palette.textTertiary}>
                {data.summary.window}
              </AppText>
            </>
          ) : (
            <AppText variant="body" color={palette.textSecondary} style={styles.heroFigure}>
              {error ?? 'Loading…'}
            </AppText>
          )}
        </View>

        {data?.institutions.map((inst) => (
          <GlassSurface key={inst.institutionName} radius={radius.lg} style={styles.card}>
            <AppText variant="title" color={palette.textPrimary} style={styles.instName}>
              {inst.institutionName}
            </AppText>
            {inst.accounts.map((acct, i) => (
              <View key={acct.id}>
                {i > 0 ? <View style={styles.divider} /> : null}
                <AccountRow account={acct} />
              </View>
            ))}
          </GlassSurface>
        ))}
      </ScrollView>
    </Background>
  );
}

function AccountRow({ account }: { account: Account }) {
  const isCredit = account.type === 'credit';
  return (
    <View style={styles.acct}>
      <View style={styles.acctRow}>
        <View style={styles.acctLeft}>
          <AppText variant="body" color={palette.textPrimary}>
            {account.name}
          </AppText>
          <AppText variant="caption" color={palette.textTertiary}>
            ···· {account.mask}
          </AppText>
        </View>
        <View style={styles.acctRight}>
          <Money value={isCredit ? account.current : account.available} variant="numSM" />
          {isCredit ? (
            <AppText variant="caption" color={palette.textTertiary}>
              owed
            </AppText>
          ) : null}
        </View>
      </View>

      {isCredit && account.projected != null ? (
        <View style={styles.projRow}>
          <AppText variant="caption" color={palette.textTertiary}>
            Projected once pending clears
          </AppText>
          <Money value={account.projected} variant="numSM" color={palette.textSecondary} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.xl,
  },
  hero: {
    marginBottom: spacing.xl,
  },
  heroFigure: {
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  card: {
    padding: spacing.lg,
    marginTop: spacing.md,
  },
  instName: {
    marginBottom: spacing.sm,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: glass.border,
    marginVertical: spacing.sm,
  },
  acct: {
    paddingVertical: spacing.xs,
  },
  acctRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  acctLeft: {
    flex: 1,
    gap: 2,
  },
  acctRight: {
    alignItems: 'flex-end',
  },
  projRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    opacity: 0.85,
  },
});
