// src/components/Press.tsx
// The app's ONE pressable. Every tappable thing renders through this so touch
// feedback is identical everywhere: a 0.97 scale dip on press-in driven by the
// press spring (Reanimated, UI thread), and a haptic on activation — tap for
// ordinary touches, commit when the press changes state (send, connect,
// continue). Under Reduce Motion the dip is immediate (no glide), per useMotion.
import React, { useCallback } from 'react';
import { GestureResponderEvent, Pressable, PressableProps, ViewStyle, StyleProp } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { haptic } from '../../theme/haptics';
import { useMotion } from '../hooks/useMotion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type PressProps = Omit<PressableProps, 'style'> & {
  /** This press commits an action (send, connect, continue): heavier haptic. */
  commit?: boolean;
  /** Dip target. Pass 1 for full-screen touch targets where a dip reads wrong. */
  scaleTo?: number;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
};

export function Press({
  commit = false,
  scaleTo = 0.97,
  onPress,
  onPressIn,
  onPressOut,
  style,
  children,
  ...rest
}: PressProps) {
  const { springs } = useMotion();
  const down = useSharedValue(0);

  const dip = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - down.value * (1 - scaleTo) }],
  }));

  const handleIn = useCallback(
    (e: GestureResponderEvent) => {
      down.value = withSpring(1, springs.press);
      onPressIn?.(e);
    },
    [down, springs, onPressIn],
  );

  const handleOut = useCallback(
    (e: GestureResponderEvent) => {
      down.value = withSpring(0, springs.press);
      onPressOut?.(e);
    },
    [down, springs, onPressOut],
  );

  const handlePress = useCallback(
    (e: GestureResponderEvent) => {
      (commit ? haptic.commit : haptic.tap)();
      onPress?.(e);
    },
    [commit, onPress],
  );

  return (
    <AnimatedPressable
      onPressIn={handleIn}
      onPressOut={handleOut}
      onPress={handlePress}
      style={[style, dip]}
      {...rest}
    >
      {children}
    </AnimatedPressable>
  );
}
