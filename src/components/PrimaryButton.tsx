// src/components/PrimaryButton.tsx
// The one primary action on a screen — the apricot CTA gradient. Signature is
// earned here, so it's never more than one per screen (the design system's
// restraint rule). Renders through <Press commit> (medium haptic + UI-thread
// dip). While loading, the label breathes instead of a spinner — the app has no
// spinners; loading is always the shape of the thing, dimmed.
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { SymbolView } from 'expo-symbols';
import type { SFSymbol } from 'expo-symbols';
import { gradients, palette, radius, spacing } from '../../theme/dusk';
import { AppText } from './AppText';
import { Press } from './Press';
import { useMotion } from '../hooks/useMotion';

export type PrimaryButtonProps = {
  label: string;
  onPress: () => void;
  icon?: SFSymbol;
  disabled?: boolean;
  loading?: boolean;
};

export function PrimaryButton({ label, onPress, icon, disabled, loading }: PrimaryButtonProps) {
  const { reduced, durations } = useMotion();
  const inactive = disabled || loading;

  // Loading: the label breathes (Reanimated pulse). Reduce Motion: steady dim.
  const breath = useSharedValue(1);
  useEffect(() => {
    if (!loading || reduced) {
      breath.value = withTiming(1, { duration: durations.fast });
      return;
    }
    breath.value = withRepeat(
      withTiming(0.45, { duration: durations.slow * 2, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [loading, reduced, durations, breath]);

  const breathing = useAnimatedStyle(() => ({ opacity: breath.value }));

  return (
    <Press
      commit
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      style={[styles.btn, { opacity: inactive && !loading ? 0.5 : 1 }]}
    >
      <LinearGradient
        colors={gradients.cta.colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
      <Animated.View style={[styles.content, breathing]}>
        {icon && !loading ? (
          <SymbolView name={icon} size={18} tintColor={palette.onSignature} weight="semibold" />
        ) : null}
        <AppText variant="title" color={palette.onSignature}>
          {label}
        </AppText>
      </Animated.View>
    </Press>
  );
}

const styles = StyleSheet.create({
  btn: {
    height: 54,
    borderRadius: radius.button,
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
