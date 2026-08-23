// src/plaid/link.ts
// The in-app bank link, via the native Plaid Link SDK (replaces the backend's
// hosted page). Flow: ask the backend for a link token, open the native Plaid
// sheet, then hand the resulting public token back to the backend to exchange +
// encrypt + bind to this user (see /plaid/link-token and /plaid/exchange in
// docs/api-contract.md). Credentials never touch us — Plaid holds them.
import type { LinkSuccess, LinkExit } from 'react-native-plaid-link-sdk';
import { api, ExchangeResult } from '../api/client';
import { USE_MOCK } from '../api/config';

// Deferred require: the Plaid SDK's JS only loads when a link actually starts,
// keeping it off the cold-start path (type imports above are erased at build).
const plaid = () => require('react-native-plaid-link-sdk') as typeof import('react-native-plaid-link-sdk');

/** Thrown when the user backs out of the Plaid sheet — callers treat as a no-op. */
export class PlaidCanceled extends Error {
  constructor() {
    super('Plaid link canceled');
    this.name = 'PlaidCanceled';
  }
}

/**
 * @param onSyncing Fires once the Plaid sheet has succeeded and the exchange
 *   round-trip begins — the caller's cue to show its syncing state (the sheet
 *   no longer covers the screen from here on).
 */
export async function connectBank(onSyncing?: () => void): Promise<ExchangeResult> {
  const { linkToken } = await api.createLinkToken();

  // Against the mock there is no real Plaid sheet (the token is fake), so simulate
  // a successful link to keep the onboarding flow exercisable end to end.
  if (USE_MOCK) {
    onSyncing?.();
    return api.exchangePublicToken({
      publicToken: 'mock-public-token',
      institution: { id: 'ins_mock', name: 'Wells Fargo' },
    });
  }

  plaid().create({ token: linkToken });
  return new Promise<ExchangeResult>((resolve, reject) => {
    plaid().open({
      onSuccess: (success: LinkSuccess) => {
        onSyncing?.();
        const inst = success.metadata.institution;
        api
          .exchangePublicToken({
            publicToken: success.publicToken,
            institution: { id: inst?.id ?? '', name: inst?.name ?? '' },
          })
          .then(resolve, reject);
      },
      onExit: (exit: LinkExit) => {
        // No error on the exit means the user dismissed it — a benign cancel.
        if (!exit.error) {
          reject(new PlaidCanceled());
          return;
        }
        reject(new Error(exit.error.displayMessage ?? exit.error.errorMessage));
      },
    });
  });
}
