// src/api/client.ts
// The single entry point the app uses to reach the backend. `api` is either the
// real HTTP client or the in-process mock, chosen by USE_MOCK (see config). Every
// screen imports `api` and the contract types from here — nothing else knows
// whether the seam is live. The app does no arithmetic; it renders what arrives.
import { BASE_URL, USE_MOCK } from './config';
import type {
  AccountsOverview,
  ApiErrorBody,
  AuthResult,
  ChatHistory,
  ChatReply,
  Diagnostic,
  ExchangeInput,
  ExchangeResult,
  LinkToken,
  Me,
} from './types';

// Re-export the contract types so screens (and the mock) import everything from
// one place.
export * from './types';

export interface PortiaApi {
  authApple(input: { identityToken: string; nonce: string }): Promise<AuthResult>;
  getMe(): Promise<Me>;
  createLinkToken(): Promise<LinkToken>;
  exchangePublicToken(input: ExchangeInput): Promise<ExchangeResult>;
  getAccounts(): Promise<AccountsOverview>;
  getChatHistory(cursor?: string): Promise<ChatHistory>;
  sendChat(message: string): Promise<ChatReply>;
  getDiagnostic(): Promise<Diagnostic>;
}

// Session token lives in memory for now. Phase 2 (auth) persists it in the
// Keychain via expo-secure-store and hydrates this on launch.
let sessionToken: string | null = null;
export const setSessionToken = (token: string | null) => {
  sessionToken = token;
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
    // Prefer the backend's voiced error; fall back to a plain one.
    const fallback = `Request to ${path} failed (${res.status}).`;
    const parsed = (await res.json().catch(() => null)) as ApiErrorBody | null;
    throw new ApiError(parsed?.error.code ?? 'unknown', parsed?.error.message ?? fallback, res.status);
  }
  return res.json() as Promise<T>;
}

const httpApi: PortiaApi = {
  authApple: (input) => request('POST', '/auth/apple', input),
  getMe: () => request('GET', '/me'),
  createLinkToken: () => request('POST', '/plaid/link-token'),
  exchangePublicToken: (input) => request('POST', '/plaid/exchange', input),
  getAccounts: () => request('GET', '/accounts'),
  getChatHistory: (cursor) =>
    request('GET', `/chat/history${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`),
  sendChat: (message) => request('POST', '/chat', { message }),
  getDiagnostic: () => request('GET', '/diagnostic'),
};

// `require` (not a static import) so the mock module is only pulled in when used.
export const api: PortiaApi = USE_MOCK ? require('./mock').mockApi : httpApi;
