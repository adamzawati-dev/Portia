// src/api/mock.ts
// ┌─────────────────────────────────────────────────────────────────────────────┐
// │ MOCK BACKEND — implements docs/api-contract.md in-process. UI ONLY.         │
// │ Lets the whole app run before the real seam exists. The canned figures here │
// │ are illustrative — the SHIPPING app must never invent a number; every real  │
// │ figure comes from the backend. When the seam lands, set USE_MOCK = false.   │
// └─────────────────────────────────────────────────────────────────────────────┘
//
// Voice of every line: anchored to a number, names the window, no character
// verdict. (Same rules the real engine writes to.)
import { SEED_MESSAGES } from '../chat/seed';
import { MOCK_LATENCY_MS } from './config';
import type {
  AccountsOverview,
  AuthResult,
  ChatHistory,
  ChatMessage,
  ChatReply,
  Diagnostic,
  ExchangeInput,
  ExchangeResult,
  LinkToken,
  Me,
  PortiaApi,
} from './client';

const delay = <T>(value: T): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(value), MOCK_LATENCY_MS));

let nextId = 0;
const uid = (p: string) => `${p}-${Date.now()}-${nextId++}`;

// Canned, on-voice replies. Round-robined per user turn.
const REPLIES: string[] = [
  "Pulling the last 30 days: you're at $1,240 across everything — $90 under where you were this time last month.",
  'That charge is a $45 subscription, billed monthly. It last hit on the 3rd.',
  'Quiet week. Your biggest charge was $86 at the grocery store on Tuesday.',
  "Over the last 7 days you've spent $214 — mostly groceries and one $52 fill-up.",
  'Dining is your largest category in June so far: $186 across 9 charges.',
];

// The seed conversation, as server-shaped history (adds the timestamp field).
const history: ChatMessage[] = SEED_MESSAGES.map((m, i) => ({
  ...m,
  createdAt: new Date(Date.now() - (SEED_MESSAGES.length - i) * 60_000).toISOString(),
}));
let turn = 0;

export const mockApi: PortiaApi = {
  async authApple(): Promise<AuthResult> {
    return delay({ sessionToken: uid('mock-session'), user: { id: 'mock-user', isNewUser: false } });
  },

  async getMe(): Promise<Me> {
    return delay({
      user: { id: 'mock-user' },
      onboarding: { hasLinkedBank: true, diagnosticState: 'done' },
    });
  },

  async createLinkToken(): Promise<LinkToken> {
    return delay({
      linkToken: uid('mock-link'),
      expiration: new Date(Date.now() + 30 * 60_000).toISOString(),
    });
  },

  async exchangePublicToken(input: ExchangeInput): Promise<ExchangeResult> {
    return delay({
      linked: [{ institutionName: input.institution.name, accountCount: 2 }],
      duplicate: false,
    });
  },

  async getAccounts(): Promise<AccountsOverview> {
    return delay({
      // Backend-computed: total available across depository accounts.
      summary: { cashAvailable: 12404.12, window: 'as of just now' },
      institutions: [
        {
          institutionName: 'Wells Fargo',
          accounts: [
            { id: 'acc-1', name: 'Everyday Checking', mask: '4021', type: 'depository', available: 3284.12, current: 3284.12, window: 'as of just now' },
            { id: 'acc-2', name: 'Way2Save', mask: '8870', type: 'depository', available: 9120.0, current: 9120.0, window: 'as of just now' },
          ],
        },
        {
          institutionName: 'Amex',
          accounts: [
            { id: 'acc-3', name: 'Platinum', mask: '1009', type: 'credit', available: 0, current: 842.55, projected: 918.3, window: 'posted now · projected once pending clears' },
          ],
        },
      ],
    });
  },

  async getChatHistory(): Promise<ChatHistory> {
    return delay({ messages: [...history] });
  },

  async sendChat(message: string): Promise<ChatReply> {
    history.push({ id: uid('u'), sender: 'user', text: message, createdAt: new Date().toISOString() });
    const reply: ChatMessage = {
      id: uid('p'),
      sender: 'portia',
      text: REPLIES[turn++ % REPLIES.length],
      createdAt: new Date().toISOString(),
    };
    history.push(reply);
    return delay({ messages: [reply] });
  },

  async getDiagnostic(): Promise<Diagnostic> {
    return delay({
      state: 'ready',
      segments: [
        { id: 'd1', label: 'Last 24 months', figure: 148200, caption: 'moved through your accounts. Let me show you where it went.' },
        { id: 'd2', label: 'Your #1 merchant', figure: 3033, caption: 'Uber Eats, across 133 orders. That is the big one.' },
        { id: 'd3', label: 'Every month, on subscriptions', figure: 214, caption: 'across 6 of them. One has been dormant since March.' },
        { id: 'd4', label: 'Your biggest single day', figure: 1290, caption: 'March 3rd — flights to Lisbon.' },
        { id: 'd5', label: 'Money I could put back', figure: 2200, caption: 'a year, from just three changes. Want them?' },
      ],
    });
  },
};
