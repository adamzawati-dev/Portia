// src/api/accountsCache.ts
// Last-known accounts overview, so the Overview tab paints instantly instead of
// skeleton-flashing on every visit. Two layers: a module-level memory copy (sync
// read — instant on tab switches) persisted through chunkedSecureStore (the
// Keychain; balances are financial data, and the chunking clears SecureStore's
// ~2KB per-value cap for users with many accounts). The cache stores exactly what
// GET /accounts returned — nothing derived, nothing computed — plus when it
// arrived. Cleared on sign-out so one user's balances never greet another.
import { chunkedSecureStore } from '../auth/secureStorage';
import type { AccountsOverview } from './types';

const KEY = 'portia.accounts.cache.v1';

export type CachedAccounts = { data: AccountsOverview; fetchedAt: number };

let memory: CachedAccounts | null = null;

/** Sync read of the in-memory copy — instant hydration on remounts. */
export function getAccountsCacheSync(): CachedAccounts | null {
  return memory;
}

/** Cold-start read from the Keychain into memory. Null on miss or corruption. */
export async function loadAccountsCache(): Promise<CachedAccounts | null> {
  if (memory) return memory;
  try {
    const raw = await chunkedSecureStore.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedAccounts;
    if (!parsed?.data?.summary || !Array.isArray(parsed.data.institutions)) return null;
    memory = parsed;
    return memory;
  } catch {
    return null;
  }
}

/** Store a fresh GET /accounts result. Persistence failures degrade to memory-only. */
export function saveAccountsCache(data: AccountsOverview): void {
  memory = { data, fetchedAt: Date.now() };
  chunkedSecureStore.setItem(KEY, JSON.stringify(memory)).catch(() => {});
}

export function clearAccountsCache(): void {
  memory = null;
  chunkedSecureStore.removeItem(KEY).catch(() => {});
}
