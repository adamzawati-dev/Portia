// src/screens/MainTabs.tsx
// The signed-in app: the two top-level surfaces with a glass capsule tab bar
// floating over them. Both screens stay MOUNTED — a tab switch crossfades
// between them (fast duration, UI thread) instead of unmounting, so flipping
// back never refetches or re-skeletons. The tab bar and gear are an overlay
// that fades and slides out over the FIRST 30% of the keyboard's rise, driven
// by the same UI-thread keyboard progress the composer rides — no jump-cuts.
// Screens reserve TAB_BAR_SPACE at the bottom so content clears the bar.
import React, { Suspense, useEffect, useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { palette, spacing } from '../../theme/dusk';
import { ChatScreen } from './ChatScreen';
import { BalancesScreen } from './BalancesScreen';

// Lazy like App.tsx's route: the reveal is a once-ever surface and stays out of
// the main bundle until the invite is accepted.
const DiagnosticScreen = React.lazy(() =>
  import('./DiagnosticScreen').then((m) => ({ default: m.DiagnosticScreen })),
);
import { TabBar, TabKey } from '../components/TabBar';
import { SettingsButton } from '../components/SettingsButton';
import { SettingsSheet } from '../components/SettingsSheet';
import { SyncChip } from '../components/SyncChip';
import { useKeyboardVisible } from '../hooks/useKeyboardVisible';
import { useMotion } from '../hooks/useMotion';
import { useSyncStatus } from '../hooks/useSyncStatus';

export function MainTabs() {
  const [tab, setTab] = useState<TabKey>('chat');
  const [settingsOpen, setSettingsOpen] = useState(false);
  // Onboarding sync streams in around the live app instead of blocking it: the
  // chip shows real per-institution progress, and the reveal opens as a modal
  // when the user accepts the invite (cold-open 'ready' is routed by session).
  const sync = useSyncStatus();
  const [revealOpen, setRevealOpen] = useState(false);
  const insets = useSafeAreaInsets();
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
        {sync.active && (
          <View
            pointerEvents="box-none"
            style={[styles.chipSlot, { top: insets.top + spacing.md }]}
          >
            <SyncChip status={sync} onOpenReveal={() => setRevealOpen(true)} />
          </View>
        )}
        <View style={styles.tabBarSlot} pointerEvents="box-none">
          {/* Overview has no composer; the nav floats alone — lift it a step. */}
          <TabBar active={tab} onChange={setTab} prominent={tab === 'overview'} />
        </View>
      </Animated.View>

      {/* The day-one reveal, presented (not imposed) when the invite is accepted.
          Its own finish/skip closes the modal; refetch flips the chip off. */}
      <Modal visible={revealOpen} animationType="fade" onRequestClose={() => setRevealOpen(false)}>
        <Suspense fallback={<View style={styles.root} />}>
          <DiagnosticScreen
            onDone={() => {
              setRevealOpen(false);
              sync.refetch();
            }}
          />
        </Suspense>
      </Modal>

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
  chipSlot: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
});
