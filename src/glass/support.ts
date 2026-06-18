// src/glass/support.ts
// Single, app-wide answer to "can we render real Apple Liquid Glass right now?"
// Both checks matter:
//   - isLiquidGlassAvailable(): the app was compiled with the glass components.
//   - isGlassEffectAPIAvailable(): the runtime device actually exposes the API
//     (some iOS 26 betas ship without it and crash if you touch glass).
// When false, primitives render the intentional tinted fallback instead.
import { Platform } from 'react-native';
import { isLiquidGlassAvailable, isGlassEffectAPIAvailable } from 'expo-glass-effect';

export const GLASS_SUPPORTED =
  Platform.OS === 'ios' && isLiquidGlassAvailable() && isGlassEffectAPIAvailable();

if (__DEV__) {
  // Phase-0 diagnostic: confirm real Apple Liquid Glass is active (not the fallback).
  const ios = Platform.OS === 'ios';
  console.log(
    `[glass] GLASS_SUPPORTED=${GLASS_SUPPORTED} ` +
      `isLiquidGlassAvailable=${ios ? isLiquidGlassAvailable() : 'n/a'} ` +
      `isGlassEffectAPIAvailable=${ios ? isGlassEffectAPIAvailable() : 'n/a'} ` +
      `platform=${Platform.OS} osVersion=${String(Platform.Version)}`,
  );
}
