// src/screens/MainTabs.tsx
// The signed-in app: the two top-level surfaces with a glass tab bar beneath. A
// plain useState switch instead of a nav library — two destinations, no back-stack
// (see src/auth/session for the rationale). The tab bar is a flex sibling below the
// active screen (so screens never sit under it) and hides while the keyboard is up,
// which keeps the chat composer directly above the keyboard.
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { palette } from '../../theme/dusk';
import { ChatScreen } from './ChatScreen';
import { BalancesScreen } from './BalancesScreen';
import { TabBar, TabKey } from '../components/TabBar';
import { useKeyboardVisible } from '../hooks/useKeyboardVisible';

export function MainTabs() {
  const [tab, setTab] = useState<TabKey>('chat');
  const keyboardVisible = useKeyboardVisible();

  return (
    <View style={styles.root}>
      <View style={styles.screen}>{tab === 'chat' ? <ChatScreen /> : <BalancesScreen />}</View>
      {keyboardVisible ? null : <TabBar active={tab} onChange={setTab} />}
    </View>
  );
}

const styles = StyleSheet.create({
  // The dark env base sits behind the glass tab bar's row.
  root: { flex: 1, backgroundColor: palette.envBottom },
  screen: { flex: 1 },
});
