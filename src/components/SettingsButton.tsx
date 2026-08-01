// src/components/SettingsButton.tsx
// The signed-in app's one account affordance: a small glass gear, top-right. This
// phase has a single setting — sign out — so it asks for confirmation directly
// rather than opening a settings surface (that arrives when there's more to hold).
// A glass circle keeps it quiet; it never competes with the screen's content.
import React from 'react';
import { Alert, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import { palette, radius, spacing } from '../../theme/dusk';
import { GlassSurface } from './GlassSurface';
import { useSession } from '../auth/session';

export function SettingsButton() {
  const insets = useSafeAreaInsets();
  const { signOut } = useSession();

  const confirmSignOut = () => {
    Alert.alert('Sign out?', 'You’ll need Sign in with Apple to get back in.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
    ]);
  };

  return (
    <Pressable
      onPress={confirmSignOut}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel="Settings and sign out"
      style={[styles.wrap, { top: insets.top + spacing.xs }]}
    >
      <GlassSurface radius={radius.emblem} style={styles.gear} lift={false}>
        <SymbolView name="gearshape" size={18} tintColor={palette.textSecondary} weight="regular" />
      </GlassSurface>
    </Pressable>
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
