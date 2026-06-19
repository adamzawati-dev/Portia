// src/auth/session.tsx
// App-level auth + onboarding state — the single source of "what screen does this
// user belong on." A lightweight state machine instead of a navigation library:
// the app currently has three top-level destinations and no back-stack, so a nav
// lib would be premature weight. Revisit when stacked/tabbed surfaces arrive
// (balances, diagnostic) in a later phase.
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '../api/client';
import { signInWithApple } from './apple';
import { clearToken, loadToken, saveToken } from './storage';

export type SessionPhase =
  | 'loading' // hydrating the stored token / resolving where the user goes
  | 'signedOut' // no valid session -> SignInScreen
  | 'onboarding' // signed in, no bank linked yet -> BankConnectScreen
  | 'diagnostic' // linked, day-one Diagnostic not yet seen -> DiagnosticScreen
  | 'ready'; // signed in + linked + past the Diagnostic -> the app (MainTabs)

type SessionValue = {
  phase: SessionPhase;
  /** Run the Apple flow, persist the session, and route by onboarding state. */
  signIn: () => Promise<void>;
  /** Re-fetch onboarding state (e.g. just after a bank links). */
  refresh: () => Promise<void>;
  /** The Diagnostic has been seen — move into the app. */
  completeDiagnostic: () => void;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionValue | null>(null);

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within <SessionProvider>');
  return ctx;
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = useState<SessionPhase>('loading');

  // The one place that maps backend onboarding state -> a destination.
  const routeFromMe = useCallback(async () => {
    const me = await api.getMe();
    const { hasLinkedBank, diagnosticState } = me.onboarding;
    if (!hasLinkedBank) {
      setPhase('onboarding');
    } else if (diagnosticState === 'ready' || diagnosticState === 'pending') {
      setPhase('diagnostic');
    } else {
      setPhase('ready');
    }
  }, []);

  // Launch: hydrate a stored token, then resolve. A bad/expired token drops to
  // signed-out rather than trapping the user on a spinner.
  useEffect(() => {
    let active = true;
    (async () => {
      const token = await loadToken();
      if (!active) return;
      if (!token) {
        setPhase('signedOut');
        return;
      }
      try {
        await routeFromMe();
      } catch {
        await clearToken();
        if (active) setPhase('signedOut');
      }
    })();
    return () => {
      active = false;
    };
  }, [routeFromMe]);

  const signIn = useCallback(async () => {
    const { sessionToken } = await signInWithApple();
    await saveToken(sessionToken);
    setPhase('loading');
    await routeFromMe();
  }, [routeFromMe]);

  const completeDiagnostic = useCallback(() => setPhase('ready'), []);

  const signOut = useCallback(async () => {
    await clearToken();
    setPhase('signedOut');
  }, []);

  return (
    <SessionContext.Provider
      value={{ phase, signIn, refresh: routeFromMe, completeDiagnostic, signOut }}
    >
      {children}
    </SessionContext.Provider>
  );
}
