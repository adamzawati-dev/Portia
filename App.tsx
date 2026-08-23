import React, { Suspense } from 'react';
import { StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { fontAssets } from './theme/fonts';
import { palette, spacing } from './theme/dusk';
import { Background } from './src/components/Background';
import { AppText } from './src/components/AppText';
import { MainTabs } from './src/screens/MainTabs';
import { PreAuth } from './src/screens/PreAuth';
import { SessionProvider, useSession } from './src/auth/session';

// Cold-start diet: the phase screens a returning user never sees load lazily —
// their code (Plaid SDK glue included) stays out of the critical path to the tabs.
const BankConnectScreen = React.lazy(() =>
  import('./src/screens/BankConnectScreen').then((m) => ({ default: m.BankConnectScreen })),
);
const DiagnosticScreen = React.lazy(() =>
  import('./src/screens/DiagnosticScreen').then((m) => ({ default: m.DiagnosticScreen })),
);

// The routing gap right after sign-in (fetching /me): hold the wordmark where
// the sign-in hero just was, instead of a blank environment.
function Holding() {
  return (
    <Background>
      <View style={styles.holding}>
        <AppText variant="display" color={palette.textPrimary}>
          Portia
        </AppText>
      </View>
    </Background>
  );
}

// Routes the user by session phase. No nav library yet — three destinations, no
// back-stack (see src/auth/session for the rationale).
function Root() {
  const { phase, refresh, completeDiagnostic } = useSession();
  switch (phase) {
    case 'loading':
      return <Holding />;
    case 'signedOut':
      // The pre-auth value sequence, then Sign in with Apple.
      return <PreAuth />;
    case 'onboarding':
      // A successful Plaid link re-checks onboarding state and routes onward.
      return (
        <Suspense fallback={<Holding />}>
          <BankConnectScreen onConnected={refresh} />
        </Suspense>
      );
    case 'diagnostic':
      // The day-one reveal, then into the app.
      return (
        <Suspense fallback={<Holding />}>
          <DiagnosticScreen onDone={completeDiagnostic} />
        </Suspense>
      );
    case 'ready':
      return <MainTabs />;
  }
}

export default function App() {
  const [fontsLoaded] = useFonts(fontAssets);

  return (
    <SafeAreaProvider>
      <KeyboardProvider>
        <StatusBar style="light" />
        {/* Bare environment while fonts load — avoids a flash of the wrong font. */}
        {fontsLoaded ? (
          <SessionProvider>
            <Root />
          </SessionProvider>
        ) : (
          <Background />
        )}
      </KeyboardProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  holding: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
});
