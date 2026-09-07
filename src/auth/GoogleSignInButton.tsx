// src/auth/GoogleSignInButton.tsx
// "Continue with Google", wired the same way Apple is: the provider hands us
// an ID token, Supabase's signInWithIdToken turns it into the ONE Portia
// session, and the session listener in src/auth/session routes exactly as it
// does for Apple — same Keychain persistence, same restore-on-relaunch, same
// onboarding-vs-returning routing. No second auth universe, no client-side
// identity merging: duplicate-email linking is Supabase's canonical-user
// behavior, configured server-side.
//
// The button renders ONLY when EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID is configured
// (and the Supabase Google provider is enabled to match) — a provider is never
// shown before it can actually sign someone in. expo-auth-session /
// expo-web-browser are required LAZILY inside the component: they carry native
// code that isn't in a dev client until the build after the Google config
// lands, and an eager import would crash today's binaries for a feature that
// is off. No secrets live in the client: the client ID is a public OAuth
// identifier. Never log tokens.
import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { palette, radius, spacing } from '../../theme/dusk';
import { AppText } from './../components/AppText';
import { Press } from './../components/Press';
import { supabase } from './supabase';

export const GOOGLE_ENABLED = !!process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

// Deferred: only touched when GOOGLE_ENABLED is true (see header comment).
const authSession = () =>
  require('expo-auth-session/providers/google') as typeof import('expo-auth-session/providers/google');
const webBrowser = () => require('expo-web-browser') as typeof import('expo-web-browser');

export function GoogleSignInButton({ onError }: { onError: (message: string) => void }) {
  useEffect(() => {
    webBrowser().maybeCompleteAuthSession();
  }, []);

  const [request, response, promptAsync] = authSession().useIdTokenAuthRequest({
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  });

  useEffect(() => {
    if (!response) return;
    // Backing out of the browser sheet is a cancel, not an error.
    if (response.type === 'cancel' || response.type === 'dismiss') return;
    if (response.type === 'error') {
      onError("Couldn't sign in with Google. Try again.");
      return;
    }
    if (response.type === 'success') {
      const idToken = response.params.id_token;
      if (!idToken) {
        onError("Couldn't sign in with Google. Try again.");
        return;
      }
      // Success establishes the Supabase session; the auth listener routes
      // from there, identically to Apple.
      supabase.auth
        .signInWithIdToken({ provider: 'google', token: idToken })
        .then(({ error }) => {
          if (error) onError("Couldn't sign in with Google. Try again.");
        });
    }
  }, [response, onError]);

  return (
    <Press
      onPress={() => void promptAsync()}
      disabled={!request}
      accessibilityRole="button"
      accessibilityLabel="Continue with Google"
      style={[styles.button, !request && styles.buttonDisabled]}
    >
      <AppText variant="title" color="#1F1F1F">
        Continue with Google
      </AppText>
    </Press>
  );
}

const styles = StyleSheet.create({
  // Matches the Apple button's geometry exactly: same height, same radius —
  // one provider stack, two equals. White per Google's light-button spec.
  button: {
    height: 52,
    borderRadius: radius.button,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
