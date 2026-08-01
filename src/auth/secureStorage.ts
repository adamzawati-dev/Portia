// src/auth/secureStorage.ts
// A Supabase auth-storage adapter backed entirely by the iOS Keychain
// (expo-secure-store). The session — access JWT + refresh token + user — is the
// credential that binds the app to this user, so it never touches plain storage.
//
// expo-secure-store caps a single value at ~2KB, and a Supabase session exceeds
// that. So we chunk: the value is split into <=CHUNK-byte slices stored under
// `${key}.0…N`, with a small manifest at `${key}` recording the chunk count. The
// whole record stays in the Keychain — no AsyncStorage, no app-held crypto.
import * as SecureStore from 'expo-secure-store';

// SecureStore's documented per-value ceiling is 2048 bytes; stay well under it.
const CHUNK = 1800;

const opts: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED,
};

type Manifest = { chunks: number };

async function clearChunks(key: string, count: number): Promise<void> {
  const deletes: Promise<void>[] = [];
  for (let i = 0; i < count; i++) deletes.push(SecureStore.deleteItemAsync(`${key}.${i}`, opts));
  await Promise.all(deletes);
}

async function readManifest(key: string): Promise<Manifest | null> {
  const raw = await SecureStore.getItemAsync(key, opts);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Manifest;
  } catch {
    return null;
  }
}

/**
 * Supabase's storage interface: getItem/setItem/removeItem, all async. Supabase
 * passes a single namespaced key (e.g. `sb-<ref>-auth-token`); the chunk suffixes
 * we add use only Keychain-legal characters.
 */
export const chunkedSecureStore = {
  async getItem(key: string): Promise<string | null> {
    const manifest = await readManifest(key);
    if (!manifest) return null;
    const parts: string[] = [];
    for (let i = 0; i < manifest.chunks; i++) {
      const part = await SecureStore.getItemAsync(`${key}.${i}`, opts);
      // A missing chunk means a corrupt/partial write — treat the record as absent.
      if (part == null) return null;
      parts.push(part);
    }
    return parts.join('');
  },

  async setItem(key: string, value: string): Promise<void> {
    // Drop any chunks left by a previous, longer value before rewriting.
    const prev = await readManifest(key);
    if (prev) await clearChunks(key, prev.chunks);

    const chunks: string[] = [];
    for (let i = 0; i < value.length; i += CHUNK) chunks.push(value.slice(i, i + CHUNK));

    await Promise.all(
      chunks.map((part, i) => SecureStore.setItemAsync(`${key}.${i}`, part, opts)),
    );
    await SecureStore.setItemAsync(key, JSON.stringify({ chunks: chunks.length } as Manifest), opts);
  },

  async removeItem(key: string): Promise<void> {
    const manifest = await readManifest(key);
    if (manifest) await clearChunks(key, manifest.chunks);
    await SecureStore.deleteItemAsync(key, opts);
  },
};
