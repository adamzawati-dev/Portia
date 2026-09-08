// src/api/types.ts
// The client/server contract types. Faithful to docs/api-contract.md — the
// backend seam is built to match these. The app renders exactly what arrives;
// every figure and the window it covers are authored by the backend (see the
// load-bearing rules in the contract). Never compute or invent these in the app.
import { Message } from '../chat/types';

// Auth is Supabase-native (signInWithIdToken in src/auth) — the bearer sent to the
// backend is the Supabase access token; there is no auth endpoint in the contract.
export type SyncItem = {
  institutionName: string | null;
  historicalUpdateComplete: boolean;
  transactionCount: number;
};

export type Me = {
  user: { id: string };
  onboarding: {
    hasLinkedBank: boolean;
    diagnosticState: 'none' | 'pending' | 'ready' | 'done';
    // Per-institution backfill progress -- drives the in-app sync chip. Real
    // state from the backend; the app renders it and adds nothing.
    items: SyncItem[];
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

// POST /plaid/linking-done — releases the diagnostic hold once the user is done
// adding banks; returns the fresh onboarding block so routing needs no second /me.
export type LinkingDone = { onboarding: Me['onboarding'] };

// POST /diagnostic/continue — seeds Portia's opening chat line after the reveal.
export type ContinueDiagnostic = { seeding: boolean };

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
  /** Live refresh failed; `accounts` are the cached last-synced balances (their
   *  `window` says when). Say so -- never present cache as live. */
  refreshFailed?: boolean;
  lastGoodWindow?: string; // e.g. "as of Sep 5"
};

// The overview payload. `summary.cashAvailable` is computed by the backend — the
// app never sums accounts itself.
export type AccountsSummary = {
  cashAvailable: number;
  window: string; // "available now", widens to "as of last refresh" when any bank is cache-served
  /** Backend-summed posted balance across credit accounts. Never summed here. */
  creditOwed?: number;
  creditOwedWindow?: string;
  /** Live pending charges per credit account; omitted when there are none. */
  pending?: { label: string; amount: number; window: string }[];
  /** One Portia-voiced sentence for the Overview's intelligence line, backend-
   *  authored from backend-computed figures. Rendered verbatim, only when present. */
  insight?: string;
};

export type AccountsOverview = {
  summary: AccountsSummary;
  institutions: Institution[];
};

// Chat — a ChatMessage is a UI Message plus a server timestamp, so it renders
// through the existing MessageBubble without mapping.
export type ChatMessage = Message & {
  createdAt: string;
  /** Institutions whose data informed this reply; present only when the turn read
   *  financial data. Replaces the all-institutions line when present. */
  sources?: string[];
};

export type ChatHistory = { messages: ChatMessage[]; nextCursor?: string };
// `messages` never echoes the user's own message. `userMessageId` is the persisted
// id of the user's turn (same id it carries in /chat/history) for reconciliation.
export type ChatReply = { messages: ChatMessage[]; userMessageId?: string };

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
