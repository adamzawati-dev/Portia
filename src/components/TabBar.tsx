// src/components/TabBar.tsx
// Navigation that recedes to almost nothing: no capsule, no card, no glass —
// two quiet labels floating over the Dusk gradient. Active = apricot icon +
// label; inactive = tertiary warm-white. States crossfade in
// place (stacked layers, fast duration) with the shared Press (44pt+ targets,
// light haptic). Color alone carries the active state — no dot, no underline.
// Hierarchy at the bottom of the screen comes from spacing, opacity, and the
// apricot accent — never from outlines.
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import type { SFSymbol } from 'expo-symbols';
import { palette, spacing } from '../../theme/dusk';
import { AppText } from './AppText';
import { Press } from './Press';
import { useMotion } from '../hooks/useMotion';

export type TabKey = 'chat' | 'overview';

// Vertical space the nav occupies above the safe-area inset — screens add this
// to their bottom padding so content clears the chrome.
export const TAB_BAR_SPACE = 72;

const TABS: { key: TabKey; label: string; icon: SFSymbol }[] = [
  { key: 'chat', label: 'Chat', icon: 'bubble.left.fill' },
  { key: 'overview', label: 'Overview', icon: 'chart.pie.fill' },
];

export function TabBar({
  active,
  onChange,
  prominent = false,
}: {
  active: TabKey;
  onChange: (key: TabKey) => void;
  /** Overview floats the nav alone over the gradient — lift it slightly. */
  prominent?: boolean;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[styles.wrap, { paddingBottom: (insets.bottom || spacing.md) + spacing.xs }]}
      pointerEvents="box-none"
    >
      {TABS.map((t) => (
        <TabItem
          key={t.key}
          tab={t}
          on={t.key === active}
          prominent={prominent}
          onPress={() => onChange(t.key)}
        />
      ))}
    </View>
  );
}

function TabItem({
  tab,
  on,
  prominent,
  onPress,
}: {
  tab: { key: TabKey; label: string; icon: SFSymbol };
  on: boolean;
  prominent: boolean;
  onPress: () => void;
}) {
  const { durations } = useMotion();
  const activeAmount = useSharedValue(on ? 1 : 0);
  useEffect(() => {
    activeAmount.value = withTiming(on ? 1 : 0, { duration: durations.fast });
  }, [on, durations, activeAmount]);

  const activeLayer = useAnimatedStyle(() => ({ opacity: activeAmount.value }));
  const inactiveLayer = useAnimatedStyle(() => ({ opacity: 1 - activeAmount.value }));

  // Alone over the gradient (Overview), the quiet state lifts one step.
  const inactiveColor = prominent ? palette.textSecondary : palette.textTertiary;

  return (
    <Press
      onPress={onPress}
      style={styles.tab}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      accessibilityLabel={tab.label}
    >
      <Animated.View style={[styles.layer, inactiveLayer]}>
        <SymbolView name={tab.icon} size={16} tintColor={inactiveColor} weight="regular" />
        <AppText variant="caption" color={inactiveColor} maxFontSizeMultiplier={1.35}>
          {tab.label}
        </AppText>
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, styles.layer, activeLayer]}>
        <SymbolView name={tab.icon} size={16} tintColor={palette.signature} weight="semibold" />
        <AppText variant="caption" color={palette.signature} maxFontSizeMultiplier={1.35}>
          {tab.label}
        </AppText>
      </Animated.View>
    </Press>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xxl * 3,
    paddingTop: spacing.sm,
  },
  tab: {
    minWidth: 64,
    minHeight: 44, // visuals shrink; targets don't
    alignItems: 'center',
    justifyContent: 'center',
  },
  layer: {
    alignItems: 'center',
    gap: 3,
  },
});
