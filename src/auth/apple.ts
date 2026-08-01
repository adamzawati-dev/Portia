// src/auth/apple.ts
// Sign in with Apple — the app's identity, replacing Telegram. Native ID-token flow
// straight into Supabase Auth:
//
//  1. Generate a random raw nonce; hand Apple only its SHA-256 hash.
//  2. Apple returns an identity token whose `nonce` claim is that hash.
//  3. Pass the identity token + the RAW nonce to Supabase signInWithIdToken; Supabase
//     re-hashes the raw nonce, checks it against the token, and verifies the token's
//     signature/audience against Apple. That defeats replay of a captured token —
//     and we never verify the Apple token ourselves.
//
// First-authorization persistence: Apple includes the user's full name ONLY on the
// very first sign-in for this App ID (every later sign-in returns null). So when it's
// present we immediately write it to the Supabase user's metadata.
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import type { Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from './supabase';

/** True only where Sign in with Apple exists (iOS 13+, real device or signed-in sim). */
export const isAppleAuthAvailable = AppleAuthentication.isAvailableAsync;

/** Thrown by signInAsync when the user dismisses the sheet — caller treats as a no-op. */
export const APPLE_CANCELED = 'ERR_REQUEST_CANCELED';

export async function signInWithApple(): Promise<Session> {
  if (!isSupabaseConfigured) {
    throw new Error('Auth isn’t configured yet — add your Supabase keys to .env.local.');
  }

  const rawNonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    rawNonce,
    { encoding: Crypto.CryptoEncoding.HEX },
  );

  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
    nonce: hashedNonce,
  });

  if (!credential.identityToken) {
    throw new Error('Apple sign-in returned no identity token. Try again.');
  }

  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
    nonce: rawNonce,
  });
  if (error) throw error;
  if (!data.session) throw new Error('Sign-in completed but no session came back. Try again.');

  // First-auth only: persist the name/email Apple just handed us, since it won't again.
  await persistFirstAuthProfile(credential);

  return data.session;
}

async function persistFirstAuthProfile(
  credential: AppleAuthentication.AppleAuthenticationCredential,
): Promise<void> {
  const fullName = [credential.fullName?.givenName, credential.fullName?.familyName]
    .filter(Boolean)
    .join(' ')
    .trim();
  const metadata: Record<string, string> = {};
  if (fullName) metadata.full_name = fullName;
  // Supabase already stores the verified email from the token; we keep Apple's
  // first-auth email too (a private relay address won't be re-sent later).
  if (credential.email) metadata.apple_email = credential.email;

  if (Object.keys(metadata).length === 0) return; // returning user — nothing new to save
  try {
    await supabase.auth.updateUser({ data: metadata });
  } catch {
    // Non-fatal: the user is signed in. Profile metadata can be backfilled later.
  }
}
