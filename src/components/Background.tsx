// src/components/Background.tsx
// The Dusk environment: warm-ink base gradient (aubergine -> wine), two layered glow
// blooms (radial, low alpha), and a subtle grain overlay. Never a cold black. All
// colors come from theme/dusk.ts. Children render above every environment layer.
import React from 'react';
import { Image, StyleSheet, useWindowDimensions, View, ViewProps } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { gradients, palette } from '../../theme/dusk';

// Grain is a presentation-only tuning value (no design token exists for it).
const GRAIN_OPACITY = 0.06;

export function Background({ style, children, ...rest }: ViewProps) {
  const { width, height } = useWindowDimensions();
  const bloom = Math.max(width, height) * 1.1;

  return (
    <View style={[styles.root, style]} {...rest}>
      {/* Base environment gradient */}
      <LinearGradient
        colors={gradients.environment.colors}
        locations={gradients.environment.locations}
        style={StyleSheet.absoluteFill}
      />

      {/* Glow bloom 1 — magenta, upper field */}
      <View
        pointerEvents="none"
        style={[
          styles.bloom,
          { width: bloom, height: bloom, borderRadius: bloom / 2, top: -bloom * 0.32, left: -bloom * 0.22 },
        ]}
      >
        <LinearGradient
          colors={[gradients.glowMagenta, 'transparent']}
          start={{ x: 0.4, y: 0.25 }}
          end={{ x: 0.6, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </View>

      {/* Glow bloom 2 — warm, lower field */}
      <View
        pointerEvents="none"
        style={[
          styles.bloom,
          { width: bloom, height: bloom, borderRadius: bloom / 2, bottom: -bloom * 0.36, right: -bloom * 0.26 },
        ]}
      >
        <LinearGradient
          colors={[gradients.glowWarm, 'transparent']}
          start={{ x: 0.6, y: 0.8 }}
          end={{ x: 0.4, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </View>

      {/* Subtle grain overlay */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Image
          source={require('../../assets/grain.png')}
          resizeMode="repeat"
          style={[StyleSheet.absoluteFill, { opacity: GRAIN_OPACITY }]}
        />
      </View>

      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: palette.envBase,
  },
  bloom: {
    position: 'absolute',
    overflow: 'hidden',
  },
});
