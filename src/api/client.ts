// src/api/client.ts
// The single entry point the app uses to reach the backend. `api` is either the
// real HTTP client or the in-process mock, chosen by USE_MOCK (see config). Every
// screen imports `api` and the contract types from here — nothing else knows
// whether the seam is live. The app does no arithmetic; it renders what arrives.
import { BASE_URL, USE_MOCK } from './config';
import type {
  AccountsOverview,
  ApiErrorBody,
  ChatHistory,
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
}

// The bearer token attached to backend requests. The Supabase session is the
// source of truth (persisted in the Keychain by supabase-js); src/auth/session
// primes this with the access token on every auth change and clears it on sign-out.
let sessionToken: string | null = null;
export const setSessionToken = (token: string | null) => {
  sessionToken = token;
};

// Contract rule: 401 means the session token is missing/expired — the app routes
// to sign-in. src/auth/session registers the handler (a callback avoids an
// api → auth → api import cycle); the ApiError still propagates to the caller.
let onUnauthorized: (() => void) | null = null;
export const setOnUnauthorized = (handler: (() => void) | null) => {
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
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    if (res.status === 401) onUnauthorized?.();
    // Prefer the backend's voiced error; fall back to a plain one.
    const fallback = `Request to ${path} failed (${res.status}).`;
    const parsed = (await res.json().catch(() => null)) as ApiErrorBody | null;
    throw new ApiError(parsed?.error.code ?? 'unknown', parsed?.error.message ?? fallback, res.status);
  }
  return res.json() as Promise<T>;
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
};

// `require` (not a static import) so the mock module is only pulled in when used.
export const api: PortiaApi = USE_MOCK ? require('./mock').mockApi : httpApi;
