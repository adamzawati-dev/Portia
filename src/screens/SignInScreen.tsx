// src/screens/SignInScreen.tsx
// The entry. First impression of a finance app that sees real bank data, so it's
// a trust surface: lots of air, no glow, no pulse — restraint scales with stakes.
// The wordmark and the anti-budget line set the voice; the single action is Sign
// in with Apple (the app's identity, replacing Telegram). Apple's own button is
// used per their guidelines.
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as AppleAuthentication from 'expo-apple-authentication';
import { palette, radius, spacing } from '../../theme/dusk';
import { Background } from '../components/Background';
import { AppText } from '../components/AppText';
import { useSession } from '../auth/session';
import { APPLE_CANCELED } from '../auth/apple';

export function SignInScreen() {
  const insets = useSafeAreaInsets();
  const { signIn } = useSession();
  const [error, setError] = useState<string | null>(null);

  const handlePress = async () => {
    setError(null);
    try {
      await signIn();
    } catch (e) {
      const code = (e as { code?: string })?.code;
      if (code === APPLE_CANCELED) return; // user backed out — not an error
      setError("Couldn't sign in. Check your connection and try again.");
    }
  };

  return (
    <Background>
      <View
        style={[
          styles.root,
          { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.xl },
        ]}
      >
        <View style={styles.hero}>
          <AppText variant="display" color={palette.textPrimary}>
            Portia
          </AppText>
          <AppText variant="body" color={palette.textSecondary} style={styles.tagline}>
            Stop budgeting. I'll tell you what you need to know.
          </AppText>
        </View>

        <View style={styles.actions}>
          {error ? (
            <AppText variant="caption" color={palette.attention} style={styles.error}>
              {error}
            </AppText>
          ) : null}
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
            cornerRadius={radius.md}
            onPress={handlePress}
            style={styles.appleButton}
          />
          <AppText variant="caption" color={palette.textTertiary} style={styles.fineprint}>
            Private by design. Your data is yours, and only yours.
          </AppText>
        </View>
      </View>
    </Background>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    justifyContent: 'space-between',
  },
  hero: {
    flex: 1,
    justifyContent: 'center',
  },
  tagline: {
    marginTop: spacing.md,
    maxWidth: 300,
  },
  actions: {
    gap: spacing.md,
  },
  appleButton: {
    height: 52,
    width: '100%',
  },
  error: {
    textAlign: 'center',
  },
  fineprint: {
    textAlign: 'center',
  },
});
