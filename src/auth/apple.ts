// src/auth/apple.ts
// Sign in with Apple — the app's identity, replacing Telegram. The flow is the
// secure nonce variant: we generate a random nonce, hand Apple only its SHA-256
// hash, and send the RAW nonce + the identity token to our backend, which verifies
// SHA-256(raw) matches the token's nonce claim. That defeats replay of a captured
// token. The backend exchanges the Apple identity token for a Portia session
// (see POST /auth/apple in docs/api-contract.md).
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { api, AuthResult } from '../api/client';

/** True only where Sign in with Apple exists (iOS 13+, real device or signed-in sim). */
export const isAppleAuthAvailable = AppleAuthentication.isAvailableAsync;

/** Thrown by signInAsync when the user dismisses the sheet — caller treats as a no-op. */
export const APPLE_CANCELED = 'ERR_REQUEST_CANCELED';

export async function signInWithApple(): Promise<AuthResult> {
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

  return api.authApple({ identityToken: credential.identityToken, nonce: rawNonce });
}
