// src/screens/MainTabs.tsx
// The signed-in app: the two top-level surfaces with a glass capsule tab bar
// beneath. Both screens stay MOUNTED — a tab switch crossfades between them
// (fast duration, UI thread) instead of unmounting, so flipping back never
// refetches or re-skeletons. The inactive screen is opacity-0 with touches
// disabled. The tab bar and gear hide while the keyboard is up (kept behavior:
// the chat composer owns that space); the settings sheet floats over everything.
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
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
  const keyboardVisible = useKeyboardVisible();
  const { reduced, durations } = useMotion();

  // 1 = chat fully visible; overview is the complement. Snap under Reduce Motion.
  const chatAlpha = useSharedValue(1);
  useEffect(() => {
    const to = tab === 'chat' ? 1 : 0;
    chatAlpha.value = reduced ? to : withTiming(to, { duration: durations.fast });
  }, [tab, reduced, durations, chatAlpha]);

  const chatStyle = useAnimatedStyle(() => ({ opacity: chatAlpha.value }));
  const overviewStyle = useAnimatedStyle(() => ({ opacity: 1 - chatAlpha.value }));

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
      {/* The account gear floats over both surfaces, top-right. Hidden while the
          keyboard is up so it never sits over the composer. */}
      {keyboardVisible ? null : <SettingsButton onPress={() => setSettingsOpen(true)} />}
      {keyboardVisible ? null : <TabBar active={tab} onChange={setTab} />}
      <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  // The dark env base sits behind the glass tab bar's row.
  root: { flex: 1, backgroundColor: palette.envBottom },
  screen: { flex: 1 },
});
