# Portia app — client/server API contract (v1)

The seam between the app (client) and the proven backend engine. **The app talks
only to these endpoints; the accuracy engine sits behind them, untouched.** The
backend seam is built to *this* document; the app is built against a mock that
implements it (`src/api/mock.ts`), so both sides move in parallel.

## Load-bearing rules

- **The app does no arithmetic and invents nothing.** Every dollar figure, every
  merchant/category name, and the time window each figure covers come from the
  backend. The app renders exactly what it receives. This mirrors the engine's
  own rule: the math is never the model's job; the voice is never the code's job.
- **Auth.** `Authorization: Bearer <sessionToken>` on every endpoint. The session
  token is the Supabase access token (see Auth below); it replaces the Telegram
  secret and the Plaid hosted-page cookie as the thing that binds a request to a user.
- **Money is transport-neutral.** Amounts are sent as numbers (major units, e.g.
  `1240.50`) plus a `window` label string the backend authored (e.g.
  `"last 30 days"`, `"June so far"`). The app never formats a window itself and
  never derives one figure from another.
- **Errors.** Non-2xx returns `{ error: { code, message } }`. `message` is
  user-safe and in Portia's voice (plain, never vague about what happened or how
  to fix it). `401` means the session token is missing/expired — app routes to
  sign-in.

## Base URL

Configured per environment in `src/api/config.ts`. Phase 1 default points at the
in-process mock; flip `USE_MOCK = false` + set `BASE_URL` to hit a real backend.

---

## Auth

There are no auth endpoints. Identity is Supabase-native:

- The app signs in with Apple via Supabase Auth's ID-token flow
  (`supabase.auth.signInWithIdToken` with the Apple identity token + nonce).
  Supabase verifies the Apple credential; supabase-js owns session persistence
  (Keychain) and silent refresh. The backend never sees the Apple credential.
- `sessionToken` = the Supabase **access token**. The app sends it as the bearer
  on every request; the backend verifies it against the Supabase project's JWKS.
- **Auto-registration.** The backend creates the user record on the first verified
  request — there is no separate registration call. A brand-new sign-in can go
  straight to `GET /me`.
- `401` still means the token is missing/expired server-side — the app routes to
  sign-in. With supabase-js auto-refresh this is the backstop, not the normal path.

> Note for the backend seam: Apple yields an Apple user id, not a Telegram id.
> The app replaces Telegram — existing Telegram-linked accounts are **not**
> migrated automatically. New app identity, re-link the bank. (Conscious cutover.)

### `GET /me`
Who the user is and where onboarding stands — drives the entry screen AND the
in-app sync chip (syncing never blocks a screen; the user lands in the app and
progress streams in).
- **200**
  ```
  {
    user: { id: string }
    onboarding: {
      hasLinkedBank: boolean
      diagnosticState: 'none' | 'pending' | 'ready' | 'done'
      items: {                          // per-institution backfill progress
        institutionName: string | null
        historicalUpdateComplete: boolean
        transactionCount: number        // rows landed so far — render verbatim
      }[]
    }
  }
  ```
- **Poll THIS endpoint for sync/diagnostic status, never `GET /diagnostic`** — a
  'ready' fetch of `/diagnostic` marks the reveal as seen. (Fetching it while
  'pending' is safe and doubles as a retry kick.)
- After `POST /plaid/linking-done` the backend seeds Portia's narration line into
  the chat thread ("<banks> are in. I'm reading your transaction history now…"),
  idempotently and only as the thread's first message — the app just fetches
  history as normal.

---

## Plaid (native SDK flow — replaces the hosted page)

### `POST /plaid/link-token`
Mint a Plaid Link token for `react-native-plaid-link-sdk`.
- **200** `{ linkToken: string, expiration: string /* ISO 8601 */ }`

### `POST /plaid/exchange`
Exchange the SDK's `public_token` after the user links a bank. Backend exchanges
for an access token, encrypts it (AES-256-GCM, as today), and binds it to the
authed user id. Duplicate institutions are detected and discarded, as today.
- **Body** `{ publicToken: string, institution: { id: string, name: string } }`
- **200** `{ linked: { institutionName: string, accountCount: number }[], duplicate: boolean }`

---

## Read + chat

### `GET /accounts`
Linked institutions and their accounts, available-led, with posted-vs-projected
for cards — the shape the engine already computes. The `summary.cashAvailable`
figure is computed by the backend (the app does no arithmetic, so the overview's
hero number must arrive precomputed).
- **200** `AccountsOverview` where
  ```
  AccountsOverview = {
    summary: {
      cashAvailable: number
      window: string            // "available now", widens to "as of last refresh"
                                // when any institution below is cache-served
      creditOwed: number        // backend-summed posted balance across credit accounts
      creditOwedWindow: string
      pending?: { label: string, amount: number, window: string }[]
                                // live pending charges per credit account; omitted
                                // when there are none
      insight?: string          // ONE Portia-voiced sentence for the Overview brief,
                                // deterministic template over backend-computed figures
                                // (anchored + windowed, never model-generated); render
                                // verbatim, omit section when absent
    }
    institutions: Institution[]
  }
  Institution = {
    institutionName: string
    accounts: Account[]
    refreshFailed?: boolean     // live refresh failed; accounts below are the cached
                                // last-synced balances (their `window` says when)
    lastGoodWindow?: string     // e.g. "as of Sep 5"; "no successful refresh yet"
  }
  // A failing institution is NOT dropped: its accounts are served from cache so the
  // app can say "Wells Fargo didn't refresh. Your last balance is still shown."
  Account = {
    id: string
    name: string              // e.g. "Checking"
    mask: string              // last 4, e.g. "4021"
    type: 'depository' | 'credit'
    available: number         // available-led balance (pending deposits included)
    current: number           // posted now
    projected?: number        // credit: balance once pending clears
    window: string            // freshness label authored by the backend, e.g. "as of just now"
  }
  ```

### `POST /chat`
Send a message to Portia; receive her reply (possibly several messages).
- **Body** `{ message: string }`
- **200** `{ messages: ChatMessage[], userMessageId?: string }` where
  ```
  ChatMessage = {
    id: string
    sender: 'portia' | 'user'
    text: string
    createdAt: string         // ISO 8601
    sources?: string[]        // institutions whose data informed this reply, e.g.
                              // ["American Express", "Wells Fargo"]; present only when
                              // the turn read financial data — replace the all-
                              // institutions muted line with this when present
  }
  ```
- **`messages` never echoes the user's own message** — it contains Portia's reply
  only. The client does not need to de-duplicate by text.
- `userMessageId` is the persisted id of the user's turn (the same id that row will
  carry in `/chat/history`), so an optimistic bubble can be reconciled by id. Absent
  only if persistence of the turn itself failed.

#### Streaming variant (same path)
Send the same request with `Accept: text/event-stream` to receive SSE instead of
JSON. Event order per turn:
```
event: step    data: { label: string }   // 0..n, one per tool as it starts —
                                         // real progress ("Checking balances",
                                         // "Scanning transactions"), render verbatim
event: chunk   data: { text: string }    // 1..n, concatenate in order for the reply
event: done    data: { message: ChatMessage, userMessageId?: string }
event: error   data: { code, message }   // terminal, replaces chunk/done
```
- Today the whole reply arrives as ONE `chunk`; the contract requires clients to
  concatenate chunks so token-level streaming can land later without a change.
- The reply is intentionally not streamed token-by-token from the model: the
  server audits the complete draft for number/merchant grounding before anything
  is delivered.
- Validation failures (empty/too-long message) return the normal JSON 4xx error
  envelope before any stream opens.
- The non-streaming JSON response remains unchanged and is the fallback contract.

### `GET /chat/history?cursor=<opaque>`
Prior conversation, newest page first; omit `cursor` for the latest page.
- **200** `{ messages: ChatMessage[], nextCursor?: string }`
- **Page order is authoritative for conversation sequence** (server orders by a
  monotonic per-row sequence, newest first). Within any page, a user message always
  precedes its reply in conversation order (i.e. appears after it in the
  newest-first payload). Do NOT sort by `createdAt`: a turn's user and reply rows
  are persisted together and can share an identical timestamp — ties are expected
  and carry no ordering information.

### `DELETE /account`
Permanent account deletion (App Store Guideline 5.1.1(v)). Auth: bearer, same as
everything else.
- **204** on success, empty body. **Idempotent**: repeating the call (including with
  a token whose account was already deleted) also returns 204.
- After 204 the client signs out locally; the Supabase session is dead server-side.
- What it does, in order: revokes every Plaid item at Plaid (`/item/remove`, so the
  bank links actually die), purges all financial data (accounts, transactions,
  balances), chat history, extracted facts, goals, moments/diagnostic, then deletes
  the Supabase auth user. External revocations that fail transiently are retried
  durably server-side; the account is already unusable in the meantime.
- **Irrecoverable**: everything above. The only thing retained is a deletion audit
  record containing salted hashes of identifiers (no financial data, no names) plus
  encrypted retry material until external cleanup completes.
- `DELETE /me` is a deployed alias with identical behavior; `/account` is the
  contract path.

---

## Diagnostic (day-one paced reveal)

### `GET /diagnostic`
The one-time 6–12 paced segments. Delivered as data so the app can stage the
reveal; runs once ever, server-enforced.
- **200**
  ```
  {
    state: 'none' | 'pending' | 'ready' | 'done'
    segments: DiagnosticSegment[]   // empty unless state is 'ready' | 'done'
  }
  // Shaped for the full-screen paced reveal: each segment is one card. `caption`
  // is Portia's voice line and must NOT restate `figure` (the card shows the figure
  // big on its own). Omit `figure` for a text-only card (e.g. the closing hook).
  DiagnosticSegment = {
    id: string
    label: string       // short overline, e.g. "Last 24 months"
    figure?: number     // the dominant currency figure, shown big (counts up in-app)
    caption: string     // one voice line; does not repeat the figure
  }
  ```

### `POST /diagnostic/continue`
Fired (and forgotten) when the user taps through the reveal's closing hook. Seeds
Portia's opening line into the chat thread — the conversation continues what the
cards started instead of opening on an empty room; the chat screen collects it on
its first history fetch. Idempotent: seeds only when the diagnostic is complete and
the thread is still empty. The line is validated to contain **no figures** (any
digit rejects the generation and a deterministic fallback ships instead).
- **200** `{ seeding: boolean }`

---

## Endpoint summary

| Method | Path                  | Purpose                          |
|--------|-----------------------|----------------------------------|
| GET    | `/me`                 | Identity + onboarding state      |
| POST   | `/plaid/link-token`   | Mint Plaid Link token            |
| POST   | `/plaid/exchange`     | Exchange public token, link bank |
| GET    | `/accounts`           | Balances (available-led)         |
| POST   | `/chat`               | Send message → Portia reply      |
| GET    | `/chat/history`       | Prior conversation               |
| GET    | `/diagnostic`         | Day-one paced reveal             |
| POST   | `/diagnostic/continue`| Seed chat opening after reveal   |
| DELETE | `/account`            | Permanent account deletion (204) |
