import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { fontAssets } from './theme/fonts';
import { Background } from './src/components/Background';
import { ChatScreen } from './src/screens/ChatScreen';

export default function App() {
  const [fontsLoaded] = useFonts(fontAssets);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      {/* Bare environment while fonts load — avoids a flash of the wrong font. */}
      {fontsLoaded ? <ChatScreen /> : <Background />}
    </SafeAreaProvider>
  );
}
