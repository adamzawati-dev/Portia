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
//
// Nonce, mirroring ./apple: a raw nonce is generated per mount, Google is sent
// its SHA-256 hex so the id_token's `nonce` claim is that hash, and the RAW
// nonce goes to Supabase, which re-hashes and compares. Supabase rejects an
// id_token whose nonce claim has no matching `nonce` in the request (and vice
// versa), so the two halves must always travel together -- the auth request is
// only built once the hash exists.
import React, { useEffect, useMemo, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import * as Crypto from 'expo-crypto';
import { radius, spacing } from '../../theme/dusk';
import { Press } from './../components/Press';
import { supabase } from './supabase';

// Google's official "G" (developers.google.com/identity branding asset).
const gLogo = require('../../assets/google-g.png');

export const GOOGLE_ENABLED = !!process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

// Deferred: only touched when GOOGLE_ENABLED is true (see header comment).
const authSession = () =>
  require('expo-auth-session/providers/google') as typeof import('expo-auth-session/providers/google');
const webBrowser = () => require('expo-web-browser') as typeof import('expo-web-browser');

type Nonce = { raw: string; hashed: string };

export function GoogleSignInButton({ onError }: { onError: (message: string) => void }) {
  // Hashing is async, and the auth request is keyed on its params: building it
  // without the nonce and reloading once the hash lands would leave a window
  // where a tap prompts with a nonce-less request while Supabase is handed the
  // raw nonce. So the request-bearing component only mounts once both exist.
  const [nonce, setNonce] = useState<Nonce | null>(null);
  useEffect(() => {
    let live = true;
    const raw = Crypto.randomUUID();
    Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, raw, {
      encoding: Crypto.CryptoEncoding.HEX,
    }).then((hashed) => {
      if (live) setNonce({ raw, hashed });
    });
    return () => {
      live = false;
    };
  }, []);

  if (!nonce) return <GoogleButtonView disabled onPress={() => {}} />;
  return <GoogleAuthButton nonce={nonce} onError={onError} />;
}

function GoogleAuthButton({ nonce, onError }: { nonce: Nonce; onError: (message: string) => void }) {
  useEffect(() => {
    webBrowser().maybeCompleteAuthSession();
  }, []);

  const extraParams = useMemo(() => ({ nonce: nonce.hashed }), [nonce.hashed]);
  const [request, response, promptAsync] = authSession().useIdTokenAuthRequest({
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    extraParams,
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
        .signInWithIdToken({ provider: 'google', token: idToken, nonce: nonce.raw })
        .then(({ error }) => {
          if (error) onError("Couldn't sign in with Google. Try again.");
        });
    }
  }, [response, onError, nonce.raw]);

  return <GoogleButtonView disabled={!request} onPress={() => void promptAsync()} />;
}

function GoogleButtonView({ disabled, onPress }: { disabled: boolean; onPress: () => void }) {
  return (
    <Press
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel="Continue with Google"
      style={[styles.button, disabled && styles.buttonDisabled]}
    >
      <View style={styles.content}>
        <Image source={gLogo} style={styles.logo} />
        {/* System font deliberately (not Hanken): the Apple button beside this
            renders SF, and Google's branding spec wants its standard button
            typography — the provider pair must read as one matched set. */}
        <Text style={styles.label} maxFontSizeMultiplier={1.4}>
          Continue with Google
        </Text>
      </View>
    </Press>
  );
}

const styles = StyleSheet.create({
  // Geometry matches the Apple button exactly — same height, same radius,
  // same white — so the provider stack reads as one set. Colors per Google's
  // light-button spec (#FFFFFF fill, #1F1F1F text, official G mark).
  button: {
    height: 52,
    borderRadius: radius.button,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logo: {
    width: 19,
    height: 19,
    resizeMode: 'contain',
  },
  label: {
    fontSize: 19,
    fontWeight: '600',
    color: '#1F1F1F',
    letterSpacing: -0.2,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
