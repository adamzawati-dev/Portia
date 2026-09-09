import React, { Suspense, useState } from 'react';
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
import { PrimaryButton } from './src/components/PrimaryButton';
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

// Signed in, but /me could not be reached (offline, backend down, timeout). The
// session is intact; this is a retry surface, not a sign-out. Foregrounding the
// app retries on its own (see src/auth/session); the button is the manual path.
function Unreachable() {
  const { refresh } = useSession();
  const [retrying, setRetrying] = useState(false);
  const tryAgain = async () => {
    setRetrying(true);
    try {
      await refresh(); // success re-routes and unmounts this screen
    } catch {
      // Still unreachable: stay here, ready for the next tap.
    } finally {
      setRetrying(false);
    }
  };
  return (
    <Background>
      <View style={styles.holding}>
        <AppText variant="display" color={palette.textPrimary}>
          Portia
        </AppText>
        <AppText variant="body" color={palette.textSecondary} style={styles.unreachableLine}>
          Couldn't reach Portia. Check your connection and try again.
        </AppText>
        <View style={styles.unreachableAction}>
          <PrimaryButton label="Try again" onPress={() => void tryAgain()} loading={retrying} />
        </View>
      </View>
    </Background>
  );
}

// Routes the user by session phase. No nav library yet — three destinations, no
// back-stack (see src/auth/session for the rationale). Each phase change fades
// in over the shared environment, so launch → auth → onboarding → app reads as
// one continuous surface, not unrelated screens.
function Root() {
  const { phase, refresh, completeDiagnostic } = useSession();
  let screen: React.ReactNode;
  switch (phase) {
    case 'loading':
      screen = <Holding />;
      break;
    case 'signedOut':
      // The pre-auth value sequence, then sign-in.
      screen = <PreAuth />;
      break;
    case 'unreachable':
      screen = <Unreachable />;
      break;
    case 'onboarding':
      // A successful Plaid link re-checks onboarding state and routes onward.
      screen = (
        <Suspense fallback={<Holding />}>
          <BankConnectScreen onConnected={refresh} />
        </Suspense>
      );
      break;
    case 'diagnostic':
      // The day-one reveal, then into the app.
      screen = (
        <Suspense fallback={<Holding />}>
          <DiagnosticScreen onDone={completeDiagnostic} />
        </Suspense>
      );
      break;
    case 'ready':
      screen = <MainTabs />;
      break;
  }
  return (
    <Animated.View key={phase} entering={FadeIn.duration(260)} style={styles.phase}>
      {screen}
    </Animated.View>
  );
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
  unreachableLine: {
    marginTop: spacing.md,
    maxWidth: 320,
  },
  unreachableAction: {
    marginTop: spacing.xxl,
  },
  phase: {
    flex: 1,
  },
});
