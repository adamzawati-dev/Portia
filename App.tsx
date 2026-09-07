import React, { Suspense } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
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

// The held frame between states (session hydrating, a lazy screen loading):
// the wordmark breathing in over the environment — never a blank screen, never
// a spinner. The native splash (envBase, app.json) hands off to this, so the
// first second reads as one continuous surface.
function Holding() {
  return (
    <Background>
      <View style={styles.holding}>
        <Animated.View entering={FadeIn.duration(400)}>
          <AppText variant="display" color={palette.textPrimary}>
            Portia
          </AppText>
        </Animated.View>
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
