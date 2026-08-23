// src/screens/BalancesScreen.tsx
// The Overview — an intelligent financial brief, typeset like an editorial
// page, not a card dashboard. Structure is by MONEY TYPE, not institution:
// Cash (what the hero counts), then Credit (owed — clearly outside the hero
// number), each account a flat row with the institution as quiet metadata.
// Hierarchy comes from size, weight, opacity, and spacing — never boxes or
// borders; the only lines are 8% hairlines between rows of one section.
//
// Every figure comes from GET /accounts; the app sums nothing. Grouping rows
// by their contract-declared type and counting rendered rows is display, not
// math. The insight line renders summary.insight verbatim when the backend
// sends it (proposed contract field) and nothing otherwise. A Pending section
// is deliberately absent: the contract carries no pending data yet.
//
// Cached-first: the last-known overview paints instantly (memory on tab
// switches, Keychain on cold start) while a silent refresh runs. Fresh data
// re-animates the hero from the old figure; stale data earns "updated x ago";
// the timestamp pulses once when fresh figures land. Skeleton only on a true
// first run.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import Animated, {
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { FlashList } from '@shopify/flash-list';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { glass, gradients, palette, spacing } from '../../theme/dusk';
import { haptic } from '../../theme/haptics';
import { Background } from '../components/Background';
import { AppText } from '../components/AppText';
import { TAB_BAR_SPACE } from '../components/TabBar';
import { Money } from '../components/Money';
import { Press } from '../components/Press';
import { PrimaryButton } from '../components/PrimaryButton';
import { OverviewSkeleton } from '../components/Skeleton';
import { useMotion } from '../hooks/useMotion';
import { useCountUp } from '../hooks/useCountUp';
import { api, AccountsOverview, Account, ApiError } from '../api/client';
import { getAccountsCacheSync, loadAccountsCache, saveAccountsCache } from '../api/accountsCache';
import { connectBank, PlaidCanceled } from '../plaid/link';

// Data older than this earns the "updated x ago" caption.
const STALE_MS = 5 * 60_000;

// ---------------------------------------------------------------------------
// The brief's line items. Grouped by money type; institution is metadata.
// ---------------------------------------------------------------------------

type Row =
  | { kind: 'section'; key: string; label: string }
  | { kind: 'account'; key: string; account: Account; institution: string; last: boolean }
  | { kind: 'insight'; key: string; text: string };

function buildRows(data: AccountsOverview): { rows: Row[]; cashCount: number; hasCredit: boolean } {
  const cash: { account: Account; institution: string }[] = [];
  const credit: { account: Account; institution: string }[] = [];
  for (const inst of data.institutions) {
    for (const account of inst.accounts) {
      (account.type === 'credit' ? credit : cash).push({
        account,
        institution: inst.institutionName,
      });
    }
  }

  const rows: Row[] = [];
  if (cash.length > 0) {
    rows.push({ kind: 'section', key: 's-cash', label: 'CASH' });
    cash.forEach((c, i) =>
      rows.push({
        kind: 'account',
        key: c.account.id,
        account: c.account,
        institution: c.institution,
        last: i === cash.length - 1,
      }),
    );
  }
  if (credit.length > 0) {
    rows.push({ kind: 'section', key: 's-credit', label: 'CREDIT' });
    credit.forEach((c, i) =>
      rows.push({
        kind: 'account',
        key: c.account.id,
        account: c.account,
        institution: c.institution,
        last: i === credit.length - 1,
      }),
    );
  }
  if (data.summary.insight) {
    rows.push({ kind: 'insight', key: 'insight', text: data.summary.insight });
  }
  return { rows, cashCount: cash.length, hasCredit: credit.length > 0 };
}

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
  // Rows stagger once, on their first appearance; refreshes update in place.
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
  // refresh silently either way — deferred past first paint.
  useEffect(() => {
    let cancelled = false;
    const run = () => {
      if (cancelled) return;
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
    };
    const idle = (globalThis as { requestIdleCallback?: (cb: () => void) => number })
      .requestIdleCallback;
    const handle = idle ? idle(run) : setTimeout(run, 50);
    return () => {
      cancelled = true;
      if (!idle) clearTimeout(handle as ReturnType<typeof setTimeout>);
    };
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

  // The timestamp pulses once when fresh figures land from the network.
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
    // Clears the floating nav and the home indicator.
    paddingBottom: insets.bottom + TAB_BAR_SPACE + spacing.md,
  };

  const shaped = useMemo(() => (data ? buildRows(data) : null), [data]);

  // ---- No data at all ----------------------------------------------------

  if (!data || !shaped) {
    return (
      <Background>
        <View style={[styles.static, contentPad]}>
          {error ? (
            <View>
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

  // ---- The brief ---------------------------------------------------------

  const header = (
    <View style={styles.hero}>
      <AppText variant="overline" color={palette.textTertiary}>
        AVAILABLE CASH
      </AppText>
      <Money value={heroValue} variant="numXL" color={palette.signature} style={styles.heroGap} />
      <Animated.View style={captionStyle}>
        <AppText variant="caption" color={palette.textSecondary}>
          {[
            shaped.cashCount > 0
              ? `Across ${shaped.cashCount} cash account${shaped.cashCount === 1 ? '' : 's'}`
              : null,
            shaped.hasCredit ? 'Credit excluded' : null,
            stale && fetchedAt != null ? `Updated ${ago(fetchedAt, now)}` : data.summary.window,
          ]
            .filter(Boolean)
            .join(' · ')}
        </AppText>
      </Animated.View>
    </View>
  );

  const fadeH = insets.top + gradients.headerFade.tail;
  const maskElement = (
    <View style={styles.flexOne}>
      <LinearGradient
        colors={gradients.headerFade.mask}
        locations={[0, insets.top / fadeH, 1]}
        style={{ height: fadeH }}
      />
      <View style={[styles.flexOne, styles.maskSolid]} />
    </View>
  );

  return (
    <Background>
      <MaskedView style={styles.flexOne} maskElement={maskElement}>
        <FlashList
          data={shaped.rows}
          keyExtractor={(r: Row) => r.key}
          getItemType={(r: Row) => r.kind}
          renderItem={({ item, index }: { item: Row; index: number }) => (
            <Animated.View
              entering={
                reduced || staggered.current
                  ? undefined
                  : FadeInUp.duration(durations.fast).delay(Math.min(index, 6) * cardStagger)
              }
            >
              {item.kind === 'section' ? (
                <SectionHeader label={item.label} />
              ) : item.kind === 'account' ? (
                <AccountRow account={item.account} institution={item.institution} last={item.last} />
              ) : (
                <InsightLine text={item.text} />
              )}
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
      </MaskedView>
    </Background>
  );
}

// Section eyebrow: small, tracked, one step brighter than the hero's eyebrow.
function SectionHeader({ label }: { label: string }) {
  return (
    <View style={styles.section}>
      <AppText variant="overline" color={palette.textSecondary}>
        {label}
      </AppText>
    </View>
  );
}

// One account line: name over metadata on the left, the figure column on the
// right sharing one axis. Credit balances carry their liability state; the
// backend's projected figure hangs beneath, muted. No boxes.
function AccountRow({
  account,
  institution,
  last,
}: {
  account: Account;
  institution: string;
  last: boolean;
}) {
  const isCredit = account.type === 'credit';
  return (
    <View style={[styles.row, !last && styles.rowDivider]}>
      <View style={styles.rowLeft}>
        <AppText variant="body" color={palette.textPrimary}>
          {account.name}
        </AppText>
        <AppText variant="micro" color={palette.textTertiary}>
          {`···· ${account.mask} · ${institution}`}
        </AppText>
      </View>
      <View style={styles.rowRight}>
        <View style={styles.balanceLine}>
          <Money value={isCredit ? account.current : account.available} variant="numSM" />
          {isCredit ? (
            <AppText variant="micro" color={palette.textSecondary}>
              owed
            </AppText>
          ) : null}
        </View>
        {isCredit && account.projected != null ? (
          <View style={styles.projected}>
            <Money value={account.projected} variant="numSM" color={palette.textTertiary} />
            <AppText variant="micro" color={palette.textTertiary}>
              projected after pending
            </AppText>
          </View>
        ) : null}
      </View>
    </View>
  );
}

// The intelligence layer: one Portia-voiced sentence from the backend, under
// the app's apricot rule. Renders only when the contract sends it.
function InsightLine({ text }: { text: string }) {
  return (
    <View style={styles.insight}>
      <View style={styles.insightRule} />
      <AppText variant="body" color={palette.textSecondary}>
        {text}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  flexOne: {
    flex: 1,
  },
  maskSolid: {
    backgroundColor: '#000', // mask alpha only; never rendered to screen
  },
  static: {
    flex: 1,
    paddingHorizontal: spacing.xl,
  },
  hero: {
    marginBottom: spacing.md,
  },
  heroGap: {
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
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
  section: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: glass.divider,
  },
  rowLeft: {
    flex: 1,
    gap: 3,
    paddingRight: spacing.lg,
  },
  rowRight: {
    alignItems: 'flex-end',
    gap: 3,
  },
  balanceLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.xs,
  },
  projected: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.xs,
  },
  insight: {
    marginTop: spacing.xxl * 2,
  },
  insightRule: {
    width: 22,
    height: 2,
    borderRadius: 1,
    backgroundColor: palette.signature,
    marginBottom: spacing.md,
  },
});
