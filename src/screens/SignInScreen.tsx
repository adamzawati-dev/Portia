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
import { Press } from '../components/Press';
import { useSession } from '../auth/session';
import { APPLE_CANCELED } from '../auth/apple';
import { GoogleSignInButton, GOOGLE_ENABLED } from '../auth/GoogleSignInButton';

export function SignInScreen() {
  const insets = useSafeAreaInsets();
  const { signIn, signedOutNotice } = useSession();
  // A local attempt's failure wins; otherwise say why the user was signed out
  // (a deleted account) instead of greeting them with silence.
  const [attemptError, setAttemptError] = useState<string | null>(null);
  const error = attemptError ?? signedOutNotice;

  const handlePress = async () => {
    setAttemptError(null);
    try {
      await signIn();
    } catch (e) {
      const code = (e as { code?: string })?.code;
      if (code === APPLE_CANCELED) return; // user backed out — not an error
      setAttemptError("Couldn't sign in. Check your connection and try again.");
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
          {/* Portia's mark — the same rule that opens her answers. */}
          <View style={styles.rule} />
          <AppText variant="display" color={palette.textPrimary}>
            Portia
          </AppText>
          <AppText variant="body" color={palette.textSecondary} style={styles.tagline}>
            Stop budgeting. I'll tell you what you need to know.
          </AppText>
        </View>

        <View style={styles.actions}>
          {error ? (
            <View style={styles.errorRow}>
              <AppText variant="caption" color={palette.attention} style={styles.error}>
                {error}
              </AppText>
              <Press
                onPress={handlePress}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Try signing in again"
              >
                <AppText variant="caption" color={palette.signature}>
                  Try again
                </AppText>
              </Press>
            </View>
          ) : null}
          {/* Provider stack. One provider today; "Continue with Google" slots in
              directly below Apple when its auth lands — same height, same radius,
              same gap. Never fake a provider before it works. */}
          <View style={styles.providers}>
            {GOOGLE_ENABLED ? <GoogleSignInButton onError={setAttemptError} /> : null}
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
              cornerRadius={radius.button}
              onPress={handlePress}
              style={styles.providerButton}
            />
          </View>
          <AppText variant="caption" color={palette.textTertiary} style={styles.fineprint}>
            No password. Read-only access to your accounts.
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
  rule: {
    width: 22,
    height: 2,
    borderRadius: 1,
    backgroundColor: palette.signature,
    marginBottom: spacing.lg,
  },
  tagline: {
    marginTop: spacing.md,
    maxWidth: 300,
  },
  actions: {
    gap: spacing.md,
  },
  providers: {
    gap: spacing.md,
  },
  providerButton: {
    height: 52,
    width: '100%',
  },
  error: {
    textAlign: 'center',
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  fineprint: {
    textAlign: 'center',
  },
});
