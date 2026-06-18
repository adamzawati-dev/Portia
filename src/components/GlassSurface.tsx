// src/components/GlassSurface.tsx
// A single liquid-glass panel. On iOS 26 it uses Apple's real Liquid Glass via the
// expo-glass-effect native bridge. Everywhere else it falls back to an intentional
// frosted/tinted solid — never a broken box. Either way it carries the inset
// specular highlight and the soft lift shadow. Every color/blur/radius is a token.
import React from 'react';
import { StyleSheet, View, ViewProps, ViewStyle } from 'react-native';
import { GlassView, GlassStyle } from 'expo-glass-effect';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { glass, radius as radiusTokens } from '../../theme/dusk';
import { GLASS_SUPPORTED } from '../glass/support';
import { useReducedMotion } from '../hooks/useReducedMotion';

export type GlassSurfaceProps = ViewProps & {
  /** Corner radius token value. Defaults to the glass-card radius. */
  radius?: number;
  /** 'regular' = frosted, 'clear' = minimal tint. */
  glassStyle?: GlassStyle;
  /** Optional tint pushed into the native glass. */
  tintColor?: string;
  /** Hero surfaces only: touch-reactive specular. Auto-disabled under Reduce Motion. */
  interactive?: boolean;
  /** Inset top highlight + top specular rim. On by default. */
  specular?: boolean;
  /** Faint spectral refractive hint along the top edge (hero surfaces). */
  dichroic?: boolean;
  /** Opacity of the dichroic hint. Defaults to a fraction of the token — a hint, not an outline. */
  dichroicOpacity?: number;
  /** Soft lift shadow. On by default. */
  lift?: boolean;
  children?: React.ReactNode;
};

export function GlassSurface({
  radius = radiusTokens.lg,
  glassStyle = 'regular',
  tintColor,
  interactive = false,
  specular = true,
  dichroic = false,
  dichroicOpacity = glass.dichroicOpacity * 0.35,
  lift = true,
  style,
  children,
  ...rest
}: GlassSurfaceProps) {
  const reduceMotion = useReducedMotion();
  const interactiveEffective = interactive && !reduceMotion;

  const liftStyle: ViewStyle | null = lift
    ? {
        shadowColor: glass.lift.color,
        shadowOpacity: 1, // alpha already encoded in the token color
        shadowRadius: glass.lift.radius,
        shadowOffset: { width: 0, height: glass.lift.offsetY },
        // Android: elevation has no token; approximate the lift radius.
        elevation: glass.lift.radius / 2,
      }
    : null;

  return (
    <View style={[{ borderRadius: radius }, liftStyle, style]} {...rest}>
      <View style={[StyleSheet.absoluteFill, { borderRadius: radius, overflow: 'hidden' }]}>
        {GLASS_SUPPORTED ? (
          <GlassView
            style={StyleSheet.absoluteFill}
            glassEffectStyle={glassStyle}
            isInteractive={interactiveEffective}
            tintColor={tintColor}
            colorScheme="dark"
          />
        ) : (
          // Intentional fallback: real blur (where the OS offers it) + tinted solid
          // base + the glass tint gradient. Reads as frosted, not as a flat box.
          <>
            <BlurView
              tint="dark"
              intensity={glass.blurRadius}
              style={StyleSheet.absoluteFill}
            />
            <View style={[StyleSheet.absoluteFill, { backgroundColor: glass.fallbackFill }]} />
            <LinearGradient
              colors={[glass.tintFrom, glass.tintTo]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          </>
        )}

        {specular ? (
          <LinearGradient
            pointerEvents="none"
            colors={[glass.specular, 'transparent', 'transparent']}
            locations={[0, 0.32, 1]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        ) : null}
      </View>

      {/* Top specular rim — a sheen concentrated along the top edge that fades
          toward the sides. Deliberately NOT a full-perimeter outline. */}
      {specular ? (
        <LinearGradient
          pointerEvents="none"
          colors={['transparent', glass.specular, 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.rim, { left: radius * 0.6, right: radius * 0.6 }]}
        />
      ) : null}

      {/* Dichroic refractive hint — a faint spectral edge at the top only, fading at
          the ends. A hint of refraction, never an outline. */}
      {dichroic ? (
        <LinearGradient
          pointerEvents="none"
          colors={['transparent', ...glass.dichroic, 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.dichroic, { left: radius * 0.6, right: radius * 0.6, opacity: dichroicOpacity }]}
        />
      ) : null}

      {/* Content lives in normal flow so it defines the surface size. */}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  rim: {
    position: 'absolute',
    top: 0,
    height: StyleSheet.hairlineWidth * 3,
  },
  dichroic: {
    position: 'absolute',
    top: 0,
    height: StyleSheet.hairlineWidth * 2,
  },
});
