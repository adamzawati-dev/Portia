// src/components/SyncChip.tsx
// The non-blocking replacement for the old full-screen diagnostic wait: one quiet
// pill of REAL state (which institution, how many transactions so far) floating in
// the top chrome while the backfill runs, flipping to the apricot invite when the
// first read is ready. Concrete state beats reassuring copy. Tapping while the
// engine is analyzing is a safe retry kick (GET /diagnostic while 'pending' never
// marks anything seen); tapping the invite opens the reveal.
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { glass, palette, radius, spacing } from '../../theme/dusk';
import { AppText } from './AppText';
import { Press } from './Press';
import { api } from '../api/client';
import type { SyncStatus } from '../hooks/useSyncStatus';

export function SyncChip({ status, onOpenReveal }: { status: SyncStatus; onOpenReveal: () => void }) {
  const { items, diagnosticState, stalled } = status;
  const syncing = items.filter((i) => !i.historicalUpdateComplete);

  let label: string;
  let ready = false;
  if (diagnosticState === 'ready') {
    label = 'Your first read is ready';
    ready = true;
  } else if (syncing.length > 0) {
    const first = syncing[0];
    const name = first.institutionName ?? 'your bank';
    label = stalled
      ? `${name} is syncing slowly. I'll tell you when it lands.`
      : `Reading ${name} · ${first.transactionCount.toLocaleString('en-US')} transactions so far`;
  } else if (diagnosticState === 'pending') {
    label = 'Analyzing. Building your first read.';
  } else {
    return null;
  }

  const onPress = ready ? onOpenReveal : () => api.getDiagnostic().catch(() => {});

  return (
    <View pointerEvents="box-none" style={styles.slot}>
      <Press
        onPress={onPress}
        commit={ready}
        accessibilityRole="button"
        accessibilityLabel={ready ? 'Your first read is ready. Open it.' : label}
        style={[styles.chip, ready && styles.chipReady]}
      >
        {ready && <View style={styles.dot} />}
        <AppText variant="caption" color={ready ? palette.signature : palette.textSecondary}>
          {label}
        </AppText>
      </Press>
    </View>
  );
}

const styles = StyleSheet.create({
  slot: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.chip,
    backgroundColor: glass.fallbackFill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: glass.border,
    maxWidth: 320,
  },
  chipReady: {
    borderColor: palette.signature,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: palette.signature,
  },
});
