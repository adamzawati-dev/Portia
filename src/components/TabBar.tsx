// src/components/TabBar.tsx
// The app's two top-level surfaces, as an inset floating glass capsule — chrome,
// so it's the one place glass belongs. Two tabs only (Chat / Overview); MainTabs
// holds the active key and crossfades the content. A soft capsule highlight
// slides between the tabs on the fast duration, and each tab's apricot state
// crossfades in place (stacked color layers — text metrics identical, so the
// overlay is exact) instead of snapping. Each tab is a <Press> (light haptic +
// UI-thread dip). Reduce Motion collapses every transition to instant.
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import type { SFSymbol } from 'expo-symbols';
import { glass, palette, radius, spacing } from '../../theme/dusk';
import { Glass } from './Glass';
import { AppText } from './AppText';
import { Press } from './Press';
import { useMotion } from '../hooks/useMotion';

export type TabKey = 'chat' | 'overview';

const TABS: { key: TabKey; label: string; icon: SFSymbol }[] = [
  { key: 'chat', label: 'Chat', icon: 'bubble.left.fill' },
  { key: 'overview', label: 'Overview', icon: 'chart.pie.fill' },
];

export function TabBar({ active, onChange }: { active: TabKey; onChange: (key: TabKey) => void }) {
  const insets = useSafeAreaInsets();
  const { durations } = useMotion();
  const [barW, setBarW] = useState(0);

  // 0 = first tab, 1 = second. Drives the highlight capsule's slide.
  const pos = useSharedValue(active === 'chat' ? 0 : 1);
  useEffect(() => {
    pos.value = withTiming(active === 'chat' ? 0 : 1, { duration: durations.fast });
  }, [active, durations, pos]);

  const half = barW / 2;
  const highlightStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: pos.value * half }],
  }));

  return (
    <View style={[styles.wrap, { paddingBottom: insets.bottom || spacing.md }]}>
      <Glass.Chrome
        radius={radius.chip}
        style={styles.bar}
        onLayout={(e) => setBarW(e.nativeEvent.layout.width)}
      >
        {barW > 0 ? (
          <Animated.View
            pointerEvents="none"
            style={[styles.highlight, { width: half - spacing.xs * 2 }, highlightStyle]}
          />
        ) : null}
        {TABS.map((t) => (
          <TabItem key={t.key} tab={t} on={t.key === active} onPress={() => onChange(t.key)} />
        ))}
      </Glass.Chrome>
    </View>
  );
}

function TabItem({
  tab,
  on,
  onPress,
}: {
  tab: { key: TabKey; label: string; icon: SFSymbol };
  on: boolean;
  onPress: () => void;
}) {
  const { durations } = useMotion();
  const activeAmount = useSharedValue(on ? 1 : 0);
  useEffect(() => {
    activeAmount.value = withTiming(on ? 1 : 0, { duration: durations.fast });
  }, [on, durations, activeAmount]);

  const activeLayer = useAnimatedStyle(() => ({ opacity: activeAmount.value }));
  const inactiveLayer = useAnimatedStyle(() => ({ opacity: 1 - activeAmount.value }));

  return (
    <Press
      onPress={onPress}
      style={styles.tab}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      accessibilityLabel={tab.label}
    >
      <Animated.View style={[styles.layer, inactiveLayer]}>
        <SymbolView name={tab.icon} size={22} tintColor={palette.textTertiary} weight="regular" />
        <AppText variant="caption" color={palette.textTertiary}>
          {tab.label}
        </AppText>
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, styles.layer, activeLayer]}>
        <SymbolView name={tab.icon} size={22} tintColor={palette.signature} weight="semibold" />
        <AppText variant="caption" color={palette.signature}>
          {tab.label}
        </AppText>
      </Animated.View>
    </Press>
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
  highlight: {
    position: 'absolute',
    left: spacing.xs,
    top: spacing.xs,
    bottom: spacing.xs,
    borderRadius: radius.chip,
    backgroundColor: glass.tintFrom,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  layer: {
    alignItems: 'center',
    gap: 3,
  },
});
