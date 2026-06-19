import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { fontAssets } from './theme/fonts';
import { Background } from './src/components/Background';
import { MainTabs } from './src/screens/MainTabs';
import { SignInScreen } from './src/screens/SignInScreen';
import { BankConnectScreen } from './src/screens/BankConnectScreen';
import { DiagnosticScreen } from './src/screens/DiagnosticScreen';
import { SessionProvider, useSession } from './src/auth/session';

// Routes the user by session phase. No nav library yet — three destinations, no
// back-stack (see src/auth/session for the rationale).
function Root() {
  const { phase, refresh, completeDiagnostic } = useSession();
  switch (phase) {
    case 'loading':
      return <Background />;
    case 'signedOut':
      return <SignInScreen />;
    case 'onboarding':
      // A successful Plaid link re-checks onboarding state and routes onward.
      return <BankConnectScreen onConnected={refresh} />;
    case 'diagnostic':
      // The day-one reveal, then into the app.
      return <DiagnosticScreen onDone={completeDiagnostic} />;
    case 'ready':
      return <MainTabs />;
  }
}

export default function App() {
  const [fontsLoaded] = useFonts(fontAssets);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      {/* Bare environment while fonts load — avoids a flash of the wrong font. */}
      {fontsLoaded ? (
        <SessionProvider>
          <Root />
        </SessionProvider>
      ) : (
        <Background />
      )}
    </SafeAreaProvider>
  );
}
