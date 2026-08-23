// src/components/Background.tsx
// The Dusk environment: warm-ink base gradient (aubergine -> wine) + two soft radial
// glow blooms (magenta upper, warm lower) + a subtle grain overlay. Never a cold
// black, never one flat gradient — the blooms give it depth. The bloom sprite is a
// white radial-falloff PNG recoloured per-bloom via `tintColor`, so each bloom's
// strength is exactly its token alpha (gradients.glowMagenta / glowWarm). Children
// render above every environment layer.
import React, { useEffect } from 'react';
import { Image, StyleSheet, useWindowDimensions, View, ViewProps } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { gradients, palette } from '../../theme/dusk';
import { useReducedMotion } from '../hooks/useReducedMotion';

// Presentation-only tuning values (no design tokens exist for these).
const GRAIN_OPACITY = 0.06;
// Ambient drift: the environment breathes over this loop — slow enough to be
// felt, never seen. UI-thread only; parked under Reduce Motion.
const DRIFT_MS = 30_000;
const DRIFT_SCALE = 0.035;
const DRIFT_X = 9;
const DRIFT_Y = -7;

const bloomSprite = require('../../assets/bloom.png');

export function Background({ style, children, ...rest }: ViewProps) {
  const { width, height } = useWindowDimensions();
  const reduced = useReducedMotion();
  const size = Math.max(width, height) * 1.6;

  // Bloom centres as fractions of the screen, converted to top-left offsets.
  const magenta = { left: width * 0.28 - size / 2, top: height * 0.14 - size / 2 };
  const warm = { left: width * 0.82 - size / 2, top: height * 0.8 - size / 2 };

  const drift = useSharedValue(0);
  useEffect(() => {
    if (reduced) {
      drift.value = 0;
      return;
    }
    drift.value = withRepeat(
      withTiming(1, { duration: DRIFT_MS, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [reduced, drift]);

  // Base scale sits above 1 so the drifting env never reveals an edge.
  const drifting = useAnimatedStyle(() => ({
    transform: [
      { scale: 1 + DRIFT_SCALE + drift.value * DRIFT_SCALE * 0.5 },
      { translateX: drift.value * DRIFT_X },
      { translateY: drift.value * DRIFT_Y },
    ],
  }));

  return (
    <View style={[styles.root, style]} {...rest}>
      {/* Environment layers drift together; content above never moves. */}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, drifting]}>
        <LinearGradient
          colors={gradients.environment.colors}
          locations={gradients.environment.locations}
          style={StyleSheet.absoluteFill}
        />
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
      </Animated.View>
      {/* Grain stays fixed — drifting grain reads as video noise. */}
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
  },
});
