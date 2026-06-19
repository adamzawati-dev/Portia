// src/plaid/link.ts
// The in-app bank link, via the native Plaid Link SDK (replaces the backend's
// hosted page). Flow: ask the backend for a link token, open the native Plaid
// sheet, then hand the resulting public token back to the backend to exchange +
// encrypt + bind to this user (see /plaid/link-token and /plaid/exchange in
// docs/api-contract.md). Credentials never touch us — Plaid holds them.
import { create, open, LinkSuccess, LinkExit } from 'react-native-plaid-link-sdk';
import { api, ExchangeResult } from '../api/client';
import { USE_MOCK } from '../api/config';

/** Thrown when the user backs out of the Plaid sheet — callers treat as a no-op. */
export class PlaidCanceled extends Error {
  constructor() {
    super('Plaid link canceled');
    this.name = 'PlaidCanceled';
  }
}

export async function connectBank(): Promise<ExchangeResult> {
  const { linkToken } = await api.createLinkToken();

  // Against the mock there is no real Plaid sheet (the token is fake), so simulate
  // a successful link to keep the onboarding flow exercisable end to end.
  if (USE_MOCK) {
    return api.exchangePublicToken({
      publicToken: 'mock-public-token',
      institution: { id: 'ins_mock', name: 'Wells Fargo' },
    });
  }

  create({ token: linkToken });
  return new Promise<ExchangeResult>((resolve, reject) => {
    open({
      onSuccess: (success: LinkSuccess) => {
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
