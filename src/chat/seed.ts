// src/chat/seed.ts
// Seed conversation that demonstrates Portia's voice: anchored to real numbers,
// always names the time window, never a character verdict. UI demo only — these
// are illustrative, not figures returned by the backend.
import { Message } from './types';

export const SEED_MESSAGES: Message[] = [
  {
    id: 'seed-1',
    sender: 'portia',
    text: "You've spent $312 on groceries in the last 30 days — about $40 under your usual month.",
  },
  {
    id: 'seed-2',
    sender: 'user',
    text: 'how much on coffee this month?',
  },
  {
    id: 'seed-3',
    sender: 'portia',
    text: '$58 on coffee so far in June, across 11 visits. Last June you were at $44 by this point.',
  },
  {
    id: 'seed-4',
    sender: 'user',
    text: 'is that bad?',
  },
  {
    id: 'seed-5',
    sender: 'portia',
    text: "It's $14 more than this time last month — not a character flaw. Want me to ping you if it passes $80 in June?",
  },
];
