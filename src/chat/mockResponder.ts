// src/chat/mockResponder.ts
// ┌─────────────────────────────────────────────────────────────────────────────┐
// │ MOCK RESPONDER — UI ONLY. NOT THE REAL BRAIN.                                │
// │ Returns canned, on-voice lines so the chat surface is demoable without the  │
// │ backend. SWAP FOR THE REAL API: replace getMockReply() with a call to the   │
// │ Portia chat endpoint. Do NOT ship these canned lines — the app must never   │
// │ invent a figure; every real number comes from the backend.                  │
// └─────────────────────────────────────────────────────────────────────────────┘
//
// Voice rules these lines follow: anchored to numbers, always name the window,
// never a character verdict.
export const MOCK_REPLIES: string[] = [
  "Pulling the last 30 days: you're at $1,240 across everything — $90 under where you were this time last month.",
  'That charge is a $45 subscription, billed monthly. It last hit on the 3rd.',
  'Quiet week. Your biggest charge was $86 at the grocery store on Tuesday.',
  "Over the last 7 days you've spent $214 — mostly groceries and one $52 fill-up.",
  'Dining is your largest category in June so far: $186 across 9 charges.',
];

/** Deterministic round-robin over the canned set. `turnIndex` = which user turn this answers. */
export function getMockReply(turnIndex: number): string {
  return MOCK_REPLIES[turnIndex % MOCK_REPLIES.length];
}
