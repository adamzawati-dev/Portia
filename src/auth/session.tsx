// src/auth/session.tsx
// App-level auth + onboarding state — the single source of "what screen does this
// user belong on." A lightweight state machine instead of a navigation library:
// the app's top-level destinations have no back-stack, so a nav lib would be
// premature weight. Revisit when stacked surfaces arrive.
//
// Auth is now real: the phase is driven by the Supabase session (Sign in with Apple
// via supabase.auth — see ./apple). Supabase persists the session in the Keychain
// and restores it on launch, so a returning user lands signed in. Everything
// downstream of auth (bank link, diagnostic) still resolves off the mock `GET /me`
// for now — this phase is auth-only and additive.
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { api, setSessionToken } from '../api/client';
import { supabase } from './supabase';
import { signInWithApple } from './apple';

export type SessionPhase =
  | 'loading' // hydrating the session / resolving where the user goes
  | 'signedOut' // no session -> pre-auth onboarding + SignInScreen
  | 'onboarding' // signed in, no bank linked yet -> BankConnectScreen
  | 'diagnostic' // linked, day-one Diagnostic not yet seen -> DiagnosticScreen
  | 'ready'; // signed in + linked + past the Diagnostic -> the app (MainTabs)

type SessionValue = {
  phase: SessionPhase;
  /** Run the Apple flow; the resulting Supabase session drives routing. */
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

  // Map a Supabase session -> a phase. No session drops to the pre-auth flow; a
  // session primes the API client's bearer token, then onboarding state decides
  // the destination. A failed /me drops to signed-out rather than trapping a spinner.
  const routeFromSession = useCallback(
    async (session: Session | null) => {
      if (!session) {
        setSessionToken(null);
        setPhase('signedOut');
        return;
      }
      setSessionToken(session.access_token);
      setPhase('loading');
      try {
        await routeFromMe();
      } catch {
        await supabase.auth.signOut(); // emits SIGNED_OUT -> routeFromSession(null)
      }
    },
    [routeFromMe],
  );

  // Launch + every auth change flow through one listener. onAuthStateChange emits
  // INITIAL_SESSION on subscribe, so this also hydrates the persisted session on
  // launch — no separate getSession() call (which would double-route).
  useEffect(() => {
    let active = true;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) void routeFromSession(session);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [routeFromSession]);

  // Sign-in success establishes the Supabase session, which the listener above turns
  // into a phase. We rethrow so SignInScreen can surface a cancel/error; on success
  // the screen stays put for the blink until the listener routes onward.
  const signIn = useCallback(async () => {
    await signInWithApple();
  }, []);

  const completeDiagnostic = useCallback(() => setPhase('ready'), []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut(); // listener routes to 'signedOut'
  }, []);

  return (
    <SessionContext.Provider
      value={{ phase, signIn, refresh: routeFromMe, completeDiagnostic, signOut }}
    >
      {children}
    </SessionContext.Provider>
  );
}
