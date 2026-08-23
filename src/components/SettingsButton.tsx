// src/components/SettingsButton.tsx
// The signed-in app's account affordance: a small glass gear (floating chrome),
// top-right. It only opens the SettingsSheet (see SettingsSheet.tsx) — MainTabs
// owns the sheet so it can float over both tabs.
import React from 'react';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import { palette, radius, spacing } from '../../theme/dusk';
import { Glass } from './Glass';
import { Press } from './Press';

export function SettingsButton({ onPress }: { onPress: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <Press
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel="Settings and sign out"
      style={[styles.wrap, { top: insets.top + spacing.xs }]}
    >
      <Glass.Chrome radius={radius.emblem} style={styles.gear}>
        <SymbolView name="gearshape" size={18} tintColor={palette.textSecondary} weight="regular" />
      </Glass.Chrome>
    </Press>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    right: spacing.lg,
    zIndex: 10,
  },
  gear: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
