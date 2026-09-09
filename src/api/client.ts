// src/api/client.ts
// The single entry point the app uses to reach the backend. `api` is either the
// real HTTP client or the in-process mock, chosen by USE_MOCK (see config). Every
// screen imports `api` and the contract types from here — nothing else knows
// whether the seam is live. The app does no arithmetic; it renders what arrives.
import { BASE_URL, USE_MOCK } from './config';
import { supabase } from '../auth/supabase';
import type {
  AccountsOverview,
  ApiErrorBody,
  ChatHistory,
  ContinueDiagnostic,
  ChatReply,
  Diagnostic,
  ExchangeInput,
  ExchangeResult,
  LinkingDone,
  LinkToken,
  Me,
} from './types';

// Re-export the contract types so screens (and the mock) import everything from
// one place.
export * from './types';

export interface PortiaApi {
  getMe(): Promise<Me>;
  createLinkToken(): Promise<LinkToken>;
  exchangePublicToken(input: ExchangeInput): Promise<ExchangeResult>;
  finishLinking(): Promise<LinkingDone>;
  getAccounts(): Promise<AccountsOverview>;
  getChatHistory(cursor?: string): Promise<ChatHistory>;
  sendChat(message: string): Promise<ChatReply>;
  getDiagnostic(): Promise<Diagnostic>;
  continueDiagnostic(): Promise<ContinueDiagnostic>;
  /** DELETE /account — 204, idempotent. Permanent; the caller signs out on success. */
  deleteAccount(): Promise<void>;
}

// The bearer token attached to backend requests. The Supabase session is the
// source of truth (persisted in the Keychain by supabase-js); src/auth/session
// primes this with the access token on every auth change and clears it on sign-out.
// Each request re-reads the session first (see freshToken); this cache is the
// fallback when that read throws.
let sessionToken: string | null = null;
export const setSessionToken = (token: string | null) => {
  sessionToken = token;
};

// supabase.auth.getSession() refreshes a token that is expired (or about to be)
// before returning it. Auto-refresh is paused while the app is backgrounded, so
// the first request after a long background otherwise went out with the cached,
// expired bearer, got a 401, and signed the user out for nothing.
async function freshToken(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? sessionToken;
  } catch {
    return sessionToken;
  }
}

// Per-request budgets. Nothing bounded a request before: iOS only enforces an
// idle timeout (~60s), so a hung backend left the loading state hanging, and a
// chat turn (up to several model calls plus tool rounds, sent as plain JSON with
// no bytes on the wire until the reply) could be cut off by that idle timeout
// after the server had already persisted the turn.
const DEFAULT_TIMEOUT_MS = 20_000;
const CHAT_TIMEOUT_MS = 120_000;
const timeoutFor = (method: string, path: string): number =>
  method === 'POST' && path === '/chat' ? CHAT_TIMEOUT_MS : DEFAULT_TIMEOUT_MS;
const TIMEOUT_MESSAGE = "Couldn't reach Portia in time. Check your connection and try again.";

// Contract rule: 401 means the session token is missing/expired — the app routes
// to sign-in. src/auth/session registers the handler (a callback avoids an
// api → auth → api import cycle); it receives the ApiError so it can tell a
// deleted account (code 'account_deleted') from plain expiry. The ApiError still
// propagates to the caller.
let onUnauthorized: ((error: ApiError) => void) | null = null;
export const setOnUnauthorized = (handler: ((error: ApiError) => void) | null) => {
  onUnauthorized = handler;
};

/** Thrown on any non-2xx response; carries the backend's voiced message + code. */
export class ApiError extends Error {
  constructor(public code: string, message: string, public status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutFor(method, path));
  try {
    const token = await freshToken();
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    if (!res.ok) {
      // Prefer the backend's voiced error; fall back to a plain one.
      const fallback = `Request to ${path} failed (${res.status}).`;
      const parsed = (await res.json().catch(() => null)) as ApiErrorBody | null;
      const error = new ApiError(parsed?.error.code ?? 'unknown', parsed?.error.message ?? fallback, res.status);
      if (res.status === 401) onUnauthorized?.(error);
      throw error;
    }
    // 204 (account deletion) has no body by contract; an empty 2xx body is
    // tolerated the same way rather than failing on JSON.parse.
    if (res.status === 204) return undefined as T;
    const text = await res.text();
    return (text ? JSON.parse(text) : undefined) as T;
  } catch (e) {
    // The abort surfaces as a generic error from fetch/body reads; the signal
    // says whether it was ours. Voiced, status 0: no response ever arrived.
    if (controller.signal.aborted) throw new ApiError('timeout', TIMEOUT_MESSAGE, 0);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

const httpApi: PortiaApi = {
  getMe: () => request('GET', '/me'),
  createLinkToken: () => request('POST', '/plaid/link-token'),
  exchangePublicToken: (input) => request('POST', '/plaid/exchange', input),
  finishLinking: () => request('POST', '/plaid/linking-done'),
  getAccounts: () => request('GET', '/accounts'),
  getChatHistory: (cursor) =>
    request('GET', `/chat/history${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`),
  sendChat: (message) => request('POST', '/chat', { message }),
  getDiagnostic: () => request('GET', '/diagnostic'),
  continueDiagnostic: () => request('POST', '/diagnostic/continue'),
  deleteAccount: () => request('DELETE', '/account'),
};

// `require` (not a static import) so the mock module is only pulled in when used.
export const api: PortiaApi = USE_MOCK ? require('./mock').mockApi : httpApi;
