// src/api/config.ts
// Where the app's API calls go. Set EXPO_PUBLIC_API_URL (in .env.local) to point
// at a real backend seam (built to docs/api-contract.md); leave it unset to run
// against the in-process mock, which keeps the app fully exercisable without the
// backend. EXPO_PUBLIC_ vars are inlined at bundle time — restart Metro with -c
// after changing them.

const apiUrl = process.env.EXPO_PUBLIC_API_URL;

export const USE_MOCK = !apiUrl;

// Base URL of the real backend seam. Unused while USE_MOCK is true.
export const BASE_URL = apiUrl ?? 'https://api.portia.invalid';

// Network feel of the mock — makes the UI behave like real latency lands.
export const MOCK_LATENCY_MS = 650;
