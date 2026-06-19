// src/components/PrimaryButton.tsx
// The one primary action on a screen — the apricot CTA gradient. Signature is
// earned here, so it's never more than one per screen (the design system's
// restraint rule). Optional leading SF Symbol. Tokens drive every value.
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SymbolView } from 'expo-symbols';
import type { SFSymbol } from 'expo-symbols';
import { gradients, palette, radius, spacing } from '../../theme/dusk';
import { AppText } from './AppText';

export type PrimaryButtonProps = {
  label: string;
  onPress: () => void;
  icon?: SFSymbol;
  disabled?: boolean;
  loading?: boolean;
};

export function PrimaryButton({ label, onPress, icon, disabled, loading }: PrimaryButtonProps) {
  const inactive = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      style={({ pressed }) => [styles.btn, { opacity: inactive ? 0.5 : pressed ? 0.9 : 1 }]}
    >
      <LinearGradient
        colors={gradients.cta.colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
      {loading ? (
        <ActivityIndicator color={palette.onSignature} />
      ) : (
        <View style={styles.content}>
          {icon ? (
            <SymbolView name={icon} size={18} tintColor={palette.onSignature} weight="semibold" />
          ) : null}
          <AppText variant="title" color={palette.onSignature}>
            {label}
          </AppText>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    height: 54,
    borderRadius: radius.md,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
});
