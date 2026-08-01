// src/components/SettingsButton.tsx
// The signed-in app's account affordance: a small glass gear, top-right, opening a
// native action sheet (Alert) — two settings don't earn a full surface yet. Holds:
// adding another bank (the engine folds it in as its history loads; duplicates are
// detected server-side and nothing changes) and sign out.
import React from 'react';
import { Alert, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import { palette, radius, spacing } from '../../theme/dusk';
import { GlassSurface } from './GlassSurface';
import { useSession } from '../auth/session';
import { connectBank, PlaidCanceled } from '../plaid/link';

export function SettingsButton() {
  const insets = useSafeAreaInsets();
  const { signOut } = useSession();

  const addAccount = async () => {
    try {
      const result = await connectBank();
      if (result.duplicate) {
        Alert.alert('Already connected', 'That bank was already linked — nothing changed.');
        return;
      }
      const name = result.linked[0]?.institutionName ?? 'That account';
      Alert.alert('Connected', `${name} is linked — I’ll fold it in as the history loads.`);
    } catch (e) {
      if (e instanceof PlaidCanceled) return;
      Alert.alert('Couldn’t connect', 'That bank didn’t link. Try again.');
    }
  };

  const openSettings = () => {
    Alert.alert('Settings', undefined, [
      { text: 'Add a bank account', onPress: () => void addAccount() },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: () =>
          Alert.alert('Sign out?', 'You’ll need Sign in with Apple to get back in.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
          ]),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <Pressable
      onPress={openSettings}
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
