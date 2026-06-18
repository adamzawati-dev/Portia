import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { fontAssets } from './theme/fonts';
import { Background } from './src/components/Background';
import { SmokeScreen } from './src/screens/SmokeScreen';

export default function App() {
  const [fontsLoaded] = useFonts(fontAssets);

  // Show the bare environment while fonts load — avoids a flash of the wrong font.
  if (!fontsLoaded) {
    return <Background />;
  }

  return (
    <>
      <StatusBar style="light" />
      <SmokeScreen />
    </>
  );
}
