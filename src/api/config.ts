// src/api/config.ts
// Where the app's API calls go. Set EXPO_PUBLIC_API_URL (in .env.local) to point
// at a real backend seam (built to docs/api-contract.md); leave it unset to run
// against the in-process mock, which keeps the app fully exercisable without the
// backend. EXPO_PUBLIC_ vars are inlined at bundle time — restart Metro with -c
// after changing them.

const apiUrl = process.env.EXPO_PUBLIC_API_URL;

// Fail closed. The mock returns invented balances and canned replies; a release
// build that lost its API URL (an EAS environment missing the variable) must
// crash at launch, not ship the mock to real users as if it were their money.
if (!__DEV__ && !apiUrl) {
  throw new Error(
    'EXPO_PUBLIC_API_URL is not set. A release build cannot fall back to the in-process mock; define it in the EAS environment for this build profile.',
  );
}

// The mock is a development convenience only: dev build + no URL configured.
export const USE_MOCK = __DEV__ && !apiUrl;

// Base URL of the real backend seam. Unused while USE_MOCK is true.
export const BASE_URL = apiUrl ?? 'https://api.portia.invalid';

// Network feel of the mock — makes the UI behave like real latency lands.
export const MOCK_LATENCY_MS = 650;
