// src/components/Glass.tsx
// The ONLY two glass wrappers in the app. Liquid glass is for chrome — the
// layer that floats OVER content — never for content itself (cards, rows,
// bubbles are flat <Surface>s on the Dusk background; see Surface.tsx).
//
//   Glass.Chrome — tab bar, composer field, top controls, floating buttons.
//   Glass.Sheet  — modal sheets / overlays that slide over a screen.
//
// On iOS 26 both use Apple's real Liquid Glass via expo-glass-effect; elsewhere
// they fall back to an intentional frosted/tinted solid — never a broken box.
// Every color/blur/radius is a token from theme/dusk.
import React from 'react';
import { StyleSheet, View, ViewProps, ViewStyle } from 'react-native';
import { GlassView } from 'expo-glass-effect';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { glass, radius as radiusTokens } from '../../theme/dusk';
import { GLASS_SUPPORTED } from '../glass/support';

type GlassProps = ViewProps & {
  /** Corner radius token value. Chrome defaults to card, Sheet to sheet. */
  radius?: number;
  /** Optional tint pushed into the native glass (kept for chrome accents). */
  tintColor?: string;
  /** Soft lift shadow beneath the panel. */
  lift?: boolean;
  children?: React.ReactNode;
};

function GlassBase({ radius, tintColor, lift, style, children, ...rest }: GlassProps & { radius: number; lift: boolean }) {
  const liftStyle: ViewStyle | null = lift
    ? {
        shadowColor: glass.lift.color,
        shadowOpacity: 1, // alpha already encoded in the token color
        shadowRadius: glass.lift.radius,
        shadowOffset: { width: 0, height: glass.lift.offsetY },
        elevation: glass.lift.radius / 2,
      }
    : null;

  return (
    <View style={[{ borderRadius: radius }, liftStyle, style]} {...rest}>
      <View style={[StyleSheet.absoluteFill, { borderRadius: radius, overflow: 'hidden' }]}>
        {GLASS_SUPPORTED ? (
          <GlassView
            style={StyleSheet.absoluteFill}
            glassEffectStyle="regular"
            tintColor={tintColor}
            colorScheme="dark"
          />
        ) : (
          // Intentional fallback: real blur (where the OS offers it) + tinted
          // solid base + the glass tint gradient. Frosted, not a flat box.
          <>
            <BlurView tint="dark" intensity={glass.blurRadius} style={StyleSheet.absoluteFill} />
            <View style={[StyleSheet.absoluteFill, { backgroundColor: glass.fallbackFill }]} />
            <LinearGradient
              colors={[glass.tintFrom, glass.tintTo]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          </>
        )}

        {/* Soft specular sheen along the top edge — glass's one highlight. */}
        <LinearGradient
          pointerEvents="none"
          colors={[glass.specular, 'transparent', 'transparent']}
          locations={[0, 0.32, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </View>

      {/* Content lives in normal flow so it defines the panel size. */}
      {children}
    </View>
  );
}

export const Glass = {
  Chrome: ({ radius = radiusTokens.card, lift = false, ...rest }: GlassProps) => (
    <GlassBase radius={radius} lift={lift} {...rest} />
  ),
  Sheet: ({ radius = radiusTokens.sheet, lift = true, ...rest }: GlassProps) => (
    <GlassBase radius={radius} lift={lift} {...rest} />
  ),
};
