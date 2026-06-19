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
- **Auth.** `Authorization: Bearer <sessionToken>` on every endpoint except
  `POST /auth/apple`. The session token replaces the Telegram secret and the
  Plaid hosted-page cookie as the thing that binds a request to a user.
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

### `POST /auth/apple`
Exchange a Sign in with Apple credential for a Portia session.
- **Body** `{ identityToken: string, nonce: string }`
- **200** `{ sessionToken: string, user: { id: string, isNewUser: boolean } }`

> Note for the backend seam: Apple yields an Apple user id, not a Telegram id.
> The app replaces Telegram — existing Telegram-linked accounts are **not**
> migrated automatically. New app identity, re-link the bank. (Conscious cutover.)

### `GET /me`
Who the user is and where onboarding stands — drives the entry screen.
- **200** `{ user: { id: string }, onboarding: { hasLinkedBank: boolean, diagnosticState: 'none' | 'pending' | 'ready' | 'done' } }`

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
    summary: { cashAvailable: number, window: string }
    institutions: Institution[]
  }
  Institution = { institutionName: string, accounts: Account[] }
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
- **200** `{ messages: ChatMessage[] }` where
  ```
  ChatMessage = {
    id: string
    sender: 'portia' | 'user'
    text: string
    createdAt: string         // ISO 8601
  }
  ```

### `GET /chat/history?cursor=<opaque>`
Prior conversation, newest page first; omit `cursor` for the latest page.
- **200** `{ messages: ChatMessage[], nextCursor?: string }`

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

---

## Endpoint summary

| Method | Path                  | Purpose                          |
|--------|-----------------------|----------------------------------|
| POST   | `/auth/apple`         | Sign in with Apple → session     |
| GET    | `/me`                 | Identity + onboarding state      |
| POST   | `/plaid/link-token`   | Mint Plaid Link token            |
| POST   | `/plaid/exchange`     | Exchange public token, link bank |
| GET    | `/accounts`           | Balances (available-led)         |
| POST   | `/chat`               | Send message → Portia reply      |
| GET    | `/chat/history`       | Prior conversation               |
| GET    | `/diagnostic`         | Day-one paced reveal             |
