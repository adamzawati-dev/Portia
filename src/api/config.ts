// src/api/config.ts
// Where the app's API calls go. Phase 1 ships against the in-process mock so the
// app is fully exercisable without the backend seam existing yet. When the seam
// lands (built to docs/api-contract.md), flip USE_MOCK to false and set BASE_URL.

export const USE_MOCK = true;

// Base URL of the real backend seam. Unused while USE_MOCK is true.
export const BASE_URL = 'https://api.portia.invalid';

// Network feel of the mock — makes the UI behave like real latency lands.
export const MOCK_LATENCY_MS = 650;
