// src/screens/BalancesScreen.tsx
// The balances/overview moment — a surface the chat can't give you. Numbers are
// the hero: one big apricot figure ("here's what's yours" — signature earned),
// then the accounts beneath in a calm ledger of flat cards. Every figure comes
// from GET /accounts; the app sums nothing (the hero total is computed by the
// backend, per the contract).
//
// Cached-first: the last-known overview paints instantly (memory on tab
// switches, Keychain on cold start) while a silent refresh runs. Fresh data
// re-animates the hero from the old figure to the new one — a delta, never a
// green/red flash. Only stale data earns an "updated x ago" caption; fresh data
// shows the backend's own window line. The skeleton appears only on a true
// first run, and a refresh failure with a cache on screen stays silent — the
// staleness caption tells that story.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { InteractionManager, RefreshControl, StyleSheet, View } from 'react-native';
import Animated, {
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { FlashList } from '@shopify/flash-list';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { glass, gradients, palette, radius, spacing } from '../../theme/dusk';
import { haptic } from '../../theme/haptics';
import { Background } from '../components/Background';
import { AppText } from '../components/AppText';
import { Surface } from '../components/Surface';
import { Money } from '../components/Money';
import { Press } from '../components/Press';
import { PrimaryButton } from '../components/PrimaryButton';
import { OverviewSkeleton } from '../components/Skeleton';
import { useMotion } from '../hooks/useMotion';
import { useCountUp } from '../hooks/useCountUp';
import { api, AccountsOverview, Account, ApiError } from '../api/client';
import { getAccountsCacheSync, loadAccountsCache, saveAccountsCache } from '../api/accountsCache';
import { connectBank, PlaidCanceled } from '../plaid/link';

type Institution = AccountsOverview['institutions'][number];

// Data older than this earns the "updated x ago" caption.
const STALE_MS = 5 * 60_000;

// Fixed row heights — FlashList recycles against these, so scroll never measures.
const ACCOUNT_ROW_H = 56;
const PROJECTED_ROW_H = 30;

function ago(fetchedAt: number, now: number): string {
  const mins = Math.round((now - fetchedAt) / 60_000);
  if (mins < 60) return `${Math.max(mins, 1)}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function BalancesScreen() {
  const insets = useSafeAreaInsets();
  const { reduced, durations, cardStagger } = useMotion();

  const initial = getAccountsCacheSync();
  const [data, setData] = useState<AccountsOverview | null>(initial?.data ?? null);
  const [fetchedAt, setFetchedAt] = useState<number | null>(initial?.fetchedAt ?? null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  const alive = useRef(true);
  const dataRef = useRef(data);
  dataRef.current = data;
  const networkLanded = useRef(false);
  // Cards stagger once, on their first appearance; refreshes update in place.
  const staggered = useRef(false);
  useEffect(() => {
    if (data) staggered.current = true;
  }, [data]);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const load = useCallback(async (viaPull: boolean) => {
    try {
      const d = await api.getAccounts();
      networkLanded.current = true;
      saveAccountsCache(d);
      if (!alive.current) return;
      setData(d);
      setFetchedAt(Date.now());
      setError(null);
      if (viaPull) haptic.success();
    } catch (e) {
      if (!alive.current) return;
      // With a last-known overview on screen the failure stays silent — the
      // staleness caption carries it. With nothing to show, say what happened.
      if (!dataRef.current) {
        setError(e instanceof ApiError ? e.message : "Couldn't load your accounts just now.");
      }
    } finally {
      if (alive.current) setRefreshing(false);
    }
  }, []);

  // Mount: hydrate from the Keychain if memory was empty (cold start), then
  // refresh silently either way. Deferred past first paint (InteractionManager)
  // so cold start reaches pixels before any network or Keychain work runs —
  // the sync memory-cache read above already painted last-known figures.
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      (async () => {
        if (!getAccountsCacheSync()) {
          const cached = await loadAccountsCache();
          if (alive.current && cached && !networkLanded.current) {
            setData(cached.data);
            setFetchedAt(cached.fetchedAt);
          }
        }
        load(false);
      })();
    });
    return () => task.cancel();
  }, [load]);

  const onRefresh = useCallback(() => {
    haptic.tick();
    setRefreshing(true);
    load(true);
  }, [load]);

  // Keeps the "updated x ago" caption honest while the screen sits open.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  const stale = fetchedAt != null && now - fetchedAt > STALE_MS;

  // The freshness line pulses once when fresh figures land from the network.
  const captionPulse = useSharedValue(1);
  useEffect(() => {
    if (fetchedAt == null || !networkLanded.current || reduced) return;
    captionPulse.value = withSequence(
      withTiming(0.35, { duration: durations.fast }),
      withTiming(1, { duration: durations.slow }),
    );
  }, [fetchedAt, reduced, durations, captionPulse]);
  const captionStyle = useAnimatedStyle(() => ({ opacity: captionPulse.value }));

  // Hero figure: counts up from 0 on first appearance, and from the old figure
  // to the new one when a refresh changes it. Always the backend's number.
  const heroValue = useCountUp(
    data?.summary.cashAvailable ?? 0,
    durations.base,
    !reduced && data != null,
  );

  const linkBank = useCallback(async () => {
    setLinkError(null);
    setConnecting(true);
    try {
      const result = await connectBank();
      if (result.duplicate) {
        setLinkError('That bank was already connected — nothing changed.');
      } else {
        await load(false);
      }
    } catch (e) {
      if (!(e instanceof PlaidCanceled)) setLinkError("Couldn't connect that bank. Try again.");
    } finally {
      if (alive.current) setConnecting(false);
    }
  }, [load]);

  const contentPad = {
    paddingTop: insets.top + spacing.xxl,
    paddingBottom: insets.bottom + spacing.xl,
  };

  // ---- No data at all ----------------------------------------------------

  if (!data) {
    return (
      <Background>
        <View style={[styles.static, contentPad]}>
          {error ? (
            <View style={styles.hero}>
              <AppText variant="overline" color={palette.textTertiary}>
                AVAILABLE CASH
              </AppText>
              <AppText variant="body" color={palette.textSecondary} style={styles.heroGap}>
                {error}
              </AppText>
              <Press
                onPress={() => {
                  setError(null);
                  load(false);
                }}
                accessibilityRole="button"
                accessibilityLabel="Try again"
                style={styles.tryAgain}
              >
                <AppText variant="title" color={palette.signature}>
                  Try again
                </AppText>
              </Press>
            </View>
          ) : (
            <OverviewSkeleton />
          )}
        </View>
      </Background>
    );
  }

  // ---- Linked but no accounts (empty state) ------------------------------

  if (data.institutions.length === 0) {
    return (
      <Background>
        <View style={[styles.static, contentPad, styles.emptyWrap]}>
          <AppText variant="title" color={palette.textSecondary} style={styles.emptyLine}>
            Nothing here yet — connect a bank and I'll show you the real picture.
          </AppText>
          {linkError ? (
            <AppText variant="caption" color={palette.attention} style={styles.linkError}>
              {linkError}
            </AppText>
          ) : null}
          <View style={styles.emptyCta}>
            <PrimaryButton
              label="Connect a bank"
              icon="building.columns.fill"
              onPress={linkBank}
              loading={connecting}
            />
          </View>
        </View>
      </Background>
    );
  }

  // ---- The ledger --------------------------------------------------------

  const header = (
    <View style={styles.hero}>
      <AppText variant="overline" color={palette.textTertiary}>
        AVAILABLE CASH
      </AppText>
      <Money value={heroValue} variant="numXL" color={palette.signature} style={styles.heroGap} />
      <Animated.View style={captionStyle}>
        <AppText variant="caption" color={palette.textTertiary}>
          {stale && fetchedAt != null ? `updated ${ago(fetchedAt, now)}` : data.summary.window}
        </AppText>
      </Animated.View>
    </View>
  );

  const fadeH = insets.top + gradients.headerFade.tail;

  return (
    <Background>
      <FlashList
        data={data.institutions}
        keyExtractor={(inst: Institution) => inst.institutionName}
        renderItem={({ item, index }: { item: Institution; index: number }) => (
          <Animated.View
            entering={
              reduced || staggered.current
                ? undefined
                : FadeInUp.duration(durations.fast).delay(index * cardStagger)
            }
          >
            <InstitutionCard inst={item} />
          </Animated.View>
        )}
        ListHeaderComponent={header}
        contentContainerStyle={{ paddingHorizontal: spacing.xl, ...contentPad }}
        bounces
        indicatorStyle="white"
        scrollIndicatorInsets={{ top: insets.top, bottom: spacing.sm }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={palette.textTertiary}
          />
        }
      />
      {/* Content dissolves under the status-bar zone instead of clipping. */}
      <LinearGradient
        pointerEvents="none"
        colors={gradients.headerFade.colors}
        locations={[0, insets.top / fadeH, 1]}
        style={[styles.topFade, { height: fadeH }]}
      />
    </Background>
  );
}

function InstitutionCard({ inst }: { inst: Institution }) {
  return (
    <Surface radius={radius.card} style={styles.card}>
      {/* Institution as a quiet label — the figures own the card. */}
      <AppText variant="overline" color={palette.textTertiary} style={styles.instName}>
        {inst.institutionName.toUpperCase()}
      </AppText>
      {inst.accounts.map((acct, i) => (
        <View key={acct.id}>
          {i > 0 ? <View style={styles.divider} /> : null}
          <AccountRow account={acct} />
        </View>
      ))}
    </Surface>
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
        {/* Figures share one right axis; qualifiers hang under them, muted. */}
        <View style={styles.acctRight}>
          <Money value={isCredit ? account.current : account.available} variant="numSM" />
          {isCredit ? (
            <AppText variant="caption" color={palette.textTertiary}>
              owed
            </AppText>
          ) : null}
          {isCredit && account.projected != null ? (
            <View style={styles.projRow}>
              <AppText variant="caption" color={palette.textTertiary}>
                Projected:
              </AppText>
              <Money value={account.projected} variant="numSM" color={palette.textTertiary} />
              <AppText variant="caption" color={palette.textTertiary}>
                once pending clears
              </AppText>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  static: {
    flex: 1,
    paddingHorizontal: spacing.xl,
  },
  topFade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  hero: {
    marginBottom: spacing.xl,
  },
  heroGap: {
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  tryAgain: {
    alignSelf: 'flex-start',
    paddingVertical: spacing.sm,
  },
  emptyWrap: {
    justifyContent: 'center',
  },
  emptyLine: {
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  linkError: {
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  emptyCta: {
    alignSelf: 'stretch',
  },
  card: {
    padding: spacing.xl, // roomier: the ledger breathes
    marginTop: spacing.lg,
  },
  instName: {
    marginBottom: spacing.md,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: glass.border,
  },
  acct: {
    paddingVertical: spacing.xs,
  },
  acctRow: {
    minHeight: ACCOUNT_ROW_H,
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
    gap: 2,
  },
  projRow: {
    minHeight: PROJECTED_ROW_H,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
});
