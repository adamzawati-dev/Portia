// src/components/SettingsButton.tsx
// The signed-in app's account affordance: a bare gear glyph, top-right on the
// xl gutter — no halo, no chrome circle. Rests at 60% opacity, snaps to full
// while pressed, with a 44pt hit target. It only opens the SettingsSheet
// (see SettingsSheet.tsx) — MainTabs owns the sheet so it floats over both tabs.
import React from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import { palette, spacing } from '../../theme/dusk';
import { Press } from './Press';
import { useMotion } from '../hooks/useMotion';

const HIT = 44;
const REST_OPACITY = 0.6;

export function SettingsButton({ onPress }: { onPress: () => void }) {
  const insets = useSafeAreaInsets();
  const { durations } = useMotion();
  const emphasis = useSharedValue(REST_OPACITY);
  const glyph = useAnimatedStyle(() => ({ opacity: emphasis.value }));

  return (
    <Press
      onPress={onPress}
      onPressIn={() => {
        emphasis.value = withTiming(1, { duration: durations.instant });
      }}
      onPressOut={() => {
        emphasis.value = withTiming(REST_OPACITY, { duration: durations.fast });
      }}
      accessibilityRole="button"
      accessibilityLabel="Settings and sign out"
      style={[styles.wrap, { top: insets.top + spacing.xs }]}
    >
      <Animated.View style={glyph}>
        <SymbolView name="gearshape" size={20} tintColor={palette.textPrimary} weight="regular" />
      </Animated.View>
    </Press>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    right: spacing.xl - (HIT - 20) / 2, // glyph optically on the xl gutter
    zIndex: 10,
    width: HIT,
    height: HIT,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
