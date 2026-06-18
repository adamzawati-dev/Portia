// src/components/Background.tsx
// The Dusk environment: warm-ink base gradient (aubergine -> wine) + two soft radial
// glow blooms (magenta upper, warm lower) + a subtle grain overlay. Never a cold
// black, never one flat gradient — the blooms give it depth. The bloom sprite is a
// white radial-falloff PNG recoloured per-bloom via `tintColor`, so each bloom's
// strength is exactly its token alpha (gradients.glowMagenta / glowWarm). Children
// render above every environment layer.
import React from 'react';
import { Image, StyleSheet, useWindowDimensions, View, ViewProps } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { gradients, palette } from '../../theme/dusk';

// Grain is a presentation-only tuning value (no design token exists for it).
const GRAIN_OPACITY = 0.06;

const bloomSprite = require('../../assets/bloom.png');

export function Background({ style, children, ...rest }: ViewProps) {
  const { width, height } = useWindowDimensions();
  const size = Math.max(width, height) * 1.6;

  // Bloom centres as fractions of the screen, converted to top-left offsets.
  const magenta = { left: width * 0.28 - size / 2, top: height * 0.14 - size / 2 };
  const warm = { left: width * 0.82 - size / 2, top: height * 0.8 - size / 2 };

  return (
    <View style={[styles.root, style]} {...rest}>
      {/* Base environment gradient */}
      <LinearGradient
        colors={gradients.environment.colors}
        locations={gradients.environment.locations}
        style={StyleSheet.absoluteFill}
      />

      {/* Decorative, non-interactive environment layers */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {/* Magenta bloom — upper field */}
        <Image
          source={bloomSprite}
          style={[styles.bloom, { width: size, height: size, left: magenta.left, top: magenta.top, tintColor: gradients.glowMagenta }]}
        />
        {/* Warm bloom — lower field */}
        <Image
          source={bloomSprite}
          style={[styles.bloom, { width: size, height: size, left: warm.left, top: warm.top, tintColor: gradients.glowWarm }]}
        />
        {/* Subtle grain overlay */}
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
  },
});
