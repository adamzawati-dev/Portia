// src/components/TabBar.tsx
// A true floating glass capsule, inset from the screen edges and the home
// indicator — the Dusk environment refracts through the clear material.
// Two tabs only (Chat / Overview); MainTabs holds the active key and
// crossfades the content. A glassy capsule highlight (tint gradient + hairline
// edge, not a gray pill) slides between the tabs on the fast duration, and
// each tab's apricot state crossfades in place. On scroll-away the whole bar
// minimizes toward the active tab (spring-driven, iOS-26-bar style) and
// expands again on scroll-back or tap. Reduce Motion snaps everything.
import React, { useEffect } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  interpolate,
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import type { SFSymbol } from 'expo-symbols';
import { glass, palette, radius, spacing } from '../../theme/dusk';
import { Glass } from './Glass';
import { AppText } from './AppText';
import { Press } from './Press';
import { useMotion } from '../hooks/useMotion';

export type TabKey = 'chat' | 'overview';

// Vertical space the floating bar occupies above the safe-area inset — screens
// add this to their bottom padding so content clears the chrome.
export const TAB_BAR_SPACE = 88;

const COMPACT_W = 128;

const TABS: { key: TabKey; label: string; icon: SFSymbol }[] = [
  { key: 'chat', label: 'Chat', icon: 'bubble.left.fill' },
  { key: 'overview', label: 'Overview', icon: 'chart.pie.fill' },
];

export function TabBar({
  active,
  onChange,
  collapse,
  collapsed = false,
  onExpand,
}: {
  active: TabKey;
  onChange: (key: TabKey) => void;
  /** 0 = full bar, 1 = minimized capsule. Driven by scroll (MainTabs). */
  collapse?: SharedValue<number>;
  collapsed?: boolean;
  onExpand?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { durations } = useMotion();
  const { width: screenW } = useWindowDimensions();
  const fullW = screenW - spacing.xxl * 2;

  // 0 = first tab, 1 = second. Drives the highlight capsule's slide.
  const pos = useSharedValue(active === 'chat' ? 0 : 1);
  useEffect(() => {
    pos.value = withTiming(active === 'chat' ? 0 : 1, { duration: durations.fast });
  }, [active, durations, pos]);

  const barStyle = useAnimatedStyle(() => ({
    width: collapse ? interpolate(collapse.value, [0, 1], [fullW, COMPACT_W]) : fullW,
  }));
  const fullContent = useAnimatedStyle(() => ({
    opacity: collapse ? 1 - collapse.value : 1,
  }));
  const compactContent = useAnimatedStyle(() => ({
    opacity: collapse ? collapse.value : 0,
  }));

  const half = fullW / 2;
  const highlightStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: pos.value * half }],
    opacity: collapse ? 1 - collapse.value : 1,
  }));

  const activeTab = TABS.find((t) => t.key === active) ?? TABS[0];

  return (
    <View
      style={[styles.wrap, { paddingBottom: (insets.bottom || spacing.md) + spacing.xs }]}
      pointerEvents="box-none"
    >
      <Animated.View style={barStyle}>
        <Glass.Chrome radius={radius.chip} style={styles.bar}>
          {/* Glassy sliding highlight: tint gradient + hairline, not a gray pill. */}
          <Animated.View
            pointerEvents="none"
            style={[styles.highlight, { width: half - spacing.xs * 2 }, highlightStyle]}
          >
            <View style={styles.highlightFill} />
            <View style={styles.highlightEdge} />
          </Animated.View>

          <Animated.View
            style={[styles.row, fullContent]}
            pointerEvents={collapsed ? 'none' : 'auto'}
          >
            {TABS.map((t) => (
              <TabItem key={t.key} tab={t} on={t.key === active} onPress={() => onChange(t.key)} />
            ))}
          </Animated.View>

          {/* Minimized: just the active tab, tap to expand. */}
          <Animated.View
            style={[StyleSheet.absoluteFill, styles.compact, compactContent]}
            pointerEvents={collapsed ? 'auto' : 'none'}
          >
            <Press
              onPress={onExpand}
              accessibilityRole="button"
              accessibilityLabel={`${activeTab.label} — expand tabs`}
              style={styles.compactPress}
            >
              <SymbolView
                name={activeTab.icon}
                size={22}
                tintColor={palette.signature}
                weight="semibold"
              />
            </Press>
          </Animated.View>
        </Glass.Chrome>
      </Animated.View>
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
    alignItems: 'center',
  },
  bar: {
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    paddingVertical: spacing.sm,
  },
  highlight: {
    position: 'absolute',
    left: spacing.xs,
    top: spacing.xs,
    bottom: spacing.xs,
    borderRadius: radius.chip,
    overflow: 'hidden',
  },
  highlightFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: glass.tintTo,
  },
  highlightEdge: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: radius.chip,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: glass.border,
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
  compact: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactPress: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
