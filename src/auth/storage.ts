// src/auth/storage.ts
// The session token lives in the iOS Keychain (expo-secure-store), never in plain
// storage — it's the credential that binds every request to this user. These three
// functions are the only places it's read or written; each also syncs the in-memory
// copy the API client attaches to requests (setSessionToken).
import * as SecureStore from 'expo-secure-store';
import { setSessionToken } from '../api/client';

const KEY = 'portia.sessionToken';

/** Read the persisted token on launch and prime the API client. */
export async function loadToken(): Promise<string | null> {
  const token = await SecureStore.getItemAsync(KEY);
  setSessionToken(token);
  return token;
}

/** Persist a freshly minted token and prime the API client. */
export async function saveToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(KEY, token, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED,
  });
  setSessionToken(token);
}

/** Wipe the token (sign-out, or a rejected/expired session). */
export async function clearToken(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY);
  setSessionToken(null);
}
