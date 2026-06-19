// src/api/types.ts
// The client/server contract types. Faithful to docs/api-contract.md — the
// backend seam is built to match these. The app renders exactly what arrives;
// every figure and the window it covers are authored by the backend (see the
// load-bearing rules in the contract). Never compute or invent these in the app.
import { Message } from '../chat/types';

// Auth
export type AuthResult = {
  sessionToken: string;
  user: { id: string; isNewUser: boolean };
};

export type Me = {
  user: { id: string };
  onboarding: {
    hasLinkedBank: boolean;
    diagnosticState: 'none' | 'pending' | 'ready' | 'done';
  };
};

// Plaid
export type LinkToken = { linkToken: string; expiration: string };

export type ExchangeInput = {
  publicToken: string;
  institution: { id: string; name: string };
};

export type ExchangeResult = {
  linked: { institutionName: string; accountCount: number }[];
  duplicate: boolean;
};

// Accounts / balances — strings and numbers exactly as the bank/engine report.
export type Account = {
  id: string;
  name: string;
  mask: string;
  type: 'depository' | 'credit';
  available: number;
  current: number;
  projected?: number; // credit: balance once pending clears
  window: string; // freshness label authored by the backend
};

export type Institution = {
  institutionName: string;
  accounts: Account[];
};

// The overview payload. `summary.cashAvailable` is computed by the backend — the
// app never sums accounts itself.
export type AccountsSummary = {
  cashAvailable: number;
  window: string;
};

export type AccountsOverview = {
  summary: AccountsSummary;
  institutions: Institution[];
};

// Chat — a ChatMessage is a UI Message plus a server timestamp, so it renders
// through the existing MessageBubble without mapping.
export type ChatMessage = Message & { createdAt: string };

export type ChatHistory = { messages: ChatMessage[]; nextCursor?: string };
export type ChatReply = { messages: ChatMessage[] };

// Diagnostic — each segment is one full-screen card in the paced reveal. `caption`
// is the voice line and must not restate `figure` (the card shows it big on its own).
export type DiagnosticSegment = {
  id: string;
  label: string; // short overline
  figure?: number; // dominant currency figure (omit for a text-only card)
  caption: string; // one voice line; does not repeat the figure
};

export type Diagnostic = {
  state: 'none' | 'pending' | 'ready' | 'done';
  segments: DiagnosticSegment[];
};

// Error envelope for non-2xx responses.
export type ApiErrorBody = { error: { code: string; message: string } };
