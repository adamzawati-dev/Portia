// src/components/TabBar.tsx
// The app's two top-level surfaces, as a floating liquid-glass bar. Two tabs only
// (Chat / Overview) — no nav library; MainTabs holds the active key. Active tab is
// apricot (signature), inactive is tertiary. SF Symbols for the icons.
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import type { SFSymbol } from 'expo-symbols';
import { palette, radius, spacing } from '../../theme/dusk';
import { GlassSurface } from './GlassSurface';
import { AppText } from './AppText';

export type TabKey = 'chat' | 'overview';

const TABS: { key: TabKey; label: string; icon: SFSymbol }[] = [
  { key: 'chat', label: 'Chat', icon: 'bubble.left.fill' },
  { key: 'overview', label: 'Overview', icon: 'chart.pie.fill' },
];

export function TabBar({ active, onChange }: { active: TabKey; onChange: (key: TabKey) => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.wrap, { paddingBottom: insets.bottom || spacing.md }]}>
      <GlassSurface radius={radius.lg} style={styles.bar}>
        {TABS.map((t) => {
          const on = t.key === active;
          const color = on ? palette.signature : palette.textTertiary;
          return (
            <Pressable
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
            </Pressable>
          );
        })}
      </GlassSurface>
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
