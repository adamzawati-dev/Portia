// src/components/TabBar.tsx
// The app's two top-level surfaces, as an inset floating glass capsule — chrome,
// so it's the one place glass belongs. Two tabs only (Chat / Overview); MainTabs
// holds the active key and crossfades the content. Active tab is apricot
// (signature), inactive is tertiary. Each tab is a <Press> (light haptic +
// UI-thread dip).
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import type { SFSymbol } from 'expo-symbols';
import { palette, radius, spacing } from '../../theme/dusk';
import { Glass } from './Glass';
import { AppText } from './AppText';
import { Press } from './Press';

export type TabKey = 'chat' | 'overview';

const TABS: { key: TabKey; label: string; icon: SFSymbol }[] = [
  { key: 'chat', label: 'Chat', icon: 'bubble.left.fill' },
  { key: 'overview', label: 'Overview', icon: 'chart.pie.fill' },
];

export function TabBar({ active, onChange }: { active: TabKey; onChange: (key: TabKey) => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.wrap, { paddingBottom: insets.bottom || spacing.md }]}>
      <Glass.Chrome radius={radius.chip} style={styles.bar}>
        {TABS.map((t) => {
          const on = t.key === active;
          const color = on ? palette.signature : palette.textTertiary;
          return (
            <Press
              key={t.key}
              onPress={() => onChange(t.key)}
              style={styles.tab}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={t.label}
            >
              <SymbolView name={t.icon} size={22} tintColor={color} weight={on ? 'semibold' : 'regular'} />
              <AppText variant="caption" color={color}>
                {t.label}
              </AppText>
            </Press>
          );
        })}
      </Glass.Chrome>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.sm,
  },
  bar: {
    flexDirection: 'row',
    paddingVertical: spacing.sm,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
    paddingVertical: spacing.xs,
  },
});
