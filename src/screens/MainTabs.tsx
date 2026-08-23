// src/screens/MainTabs.tsx
// The signed-in app: the two top-level surfaces with a glass capsule tab bar
// floating over them. Both screens stay MOUNTED — a tab switch crossfades
// between them (fast duration, UI thread) instead of unmounting, so flipping
// back never refetches or re-skeletons. The tab bar and gear are an overlay
// that fades and slides out over the FIRST 30% of the keyboard's rise, driven
// by the same UI-thread keyboard progress the composer rides — no jump-cuts.
// Screens reserve TAB_BAR_SPACE at the bottom so content clears the bar.
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';
import { palette } from '../../theme/dusk';
import { ChatScreen } from './ChatScreen';
import { BalancesScreen } from './BalancesScreen';
import { TabBar, TabKey } from '../components/TabBar';
import { SettingsButton } from '../components/SettingsButton';
import { SettingsSheet } from '../components/SettingsSheet';
import { useKeyboardVisible } from '../hooks/useKeyboardVisible';
import { useMotion } from '../hooks/useMotion';

export function MainTabs() {
  const [tab, setTab] = useState<TabKey>('chat');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const keyboardVisible = useKeyboardVisible(); // touch routing only; visuals are animated
  const { reduced, durations } = useMotion();

  // 1 = chat fully visible; overview is the complement. Snap under Reduce Motion.
  const chatAlpha = useSharedValue(1);
  useEffect(() => {
    const to = tab === 'chat' ? 1 : 0;
    chatAlpha.value = reduced ? to : withTiming(to, { duration: durations.fast });
  }, [tab, reduced, durations, chatAlpha]);

  const chatStyle = useAnimatedStyle(() => ({ opacity: chatAlpha.value }));
  const overviewStyle = useAnimatedStyle(() => ({ opacity: 1 - chatAlpha.value }));

  // Chrome retreats over the first 30% of the keyboard's rise.
  const { progress } = useReanimatedKeyboardAnimation();
  const chromeStyle = useAnimatedStyle(() => {
    const gone = Math.min(progress.value / 0.3, 1);
    return {
      opacity: 1 - gone,
      transform: [{ translateY: gone * 14 }],
    };
  });

  return (
    <View style={styles.root}>
      <View style={styles.screen}>
        <Animated.View
          style={[StyleSheet.absoluteFill, chatStyle]}
          pointerEvents={tab === 'chat' ? 'auto' : 'none'}
        >
          <ChatScreen />
        </Animated.View>
        <Animated.View
          style={[StyleSheet.absoluteFill, overviewStyle]}
          pointerEvents={tab === 'overview' ? 'auto' : 'none'}
        >
          <BalancesScreen />
        </Animated.View>
      </View>

      {/* Floating chrome: gear top-right, tab bar bottom — over both surfaces. */}
      <Animated.View
        style={[StyleSheet.absoluteFill, chromeStyle]}
        pointerEvents={keyboardVisible ? 'none' : 'box-none'}
      >
        <SettingsButton onPress={() => setSettingsOpen(true)} />
        <View style={styles.tabBarSlot} pointerEvents="box-none">
          {/* Overview has no composer; the nav floats alone — lift it a step. */}
          <TabBar active={tab} onChange={setTab} prominent={tab === 'overview'} />
        </View>
      </Animated.View>

      <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.envBottom },
  screen: { flex: 1 },
  tabBarSlot: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
});
