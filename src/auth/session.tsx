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
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import type { Session } from '@supabase/supabase-js';
import { api, ApiError, setOnUnauthorized, setSessionToken } from '../api/client';
import { clearAccountsCache } from '../api/accountsCache';
import { AUTH_STORAGE_KEY, supabase } from './supabase';
import { chunkedSecureStore } from './secureStorage';
import { signInWithApple } from './apple';

export type SessionPhase =
  | 'loading' // hydrating the session / resolving where the user goes
  | 'signedOut' // no session -> pre-auth onboarding + SignInScreen
  | 'unreachable' // signed in, but /me failed for a reason other than 401 -> retry screen
  | 'onboarding' // signed in, no bank linked yet -> BankConnectScreen
  | 'diagnostic' // linked, day-one Diagnostic not yet seen -> DiagnosticScreen
  | 'ready'; // signed in + linked + past the Diagnostic -> the app (MainTabs)

// The backend's 401 code for an account that was deleted (its Supabase identity
// may outlive the deletion by minutes while the auth user is removed). The user
// gets told, instead of a silent bounce to sign-in.
const ACCOUNT_DELETED_CODE = 'account_deleted';
const ACCOUNT_DELETED_NOTICE =
  'That account was deleted. Sign in again in a few minutes to start fresh.';

type SessionValue = {
  phase: SessionPhase;
  /** Why the last sign-out was forced (e.g. the account was deleted); null otherwise.
   *  SignInScreen shows it in its error row. Cleared on the next sign-in attempt. */
  signedOutNotice: string | null;
  /** Run the Apple flow; the resulting Supabase session drives routing. */
  signIn: () => Promise<void>;
  /** Re-fetch onboarding state (e.g. just after a bank links). */
  refresh: () => Promise<void>;
  /** The Diagnostic has been seen — move into the app. */
  completeDiagnostic: () => void;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionValue | null>(null);

// Sign out, offline included. auth-js posts /logout first and, on a network
// error, returns { error } WITHOUT dropping the local session: no SIGNED_OUT
// fires, the user stays signed in, and nothing says so. Fall back to a local
// sign-out. In auth-js 2.108 the local scope still posts /logout, so if that
// fails too, drop the persisted session ourselves and run the local pass again:
// with nothing in storage it skips the network and emits SIGNED_OUT. (The
// refresh token is then revoked only if a later global sign-out reaches the
// server; that is the price of signing out with no connection.)
async function signOutSupabase(): Promise<void> {
  const global = await supabase.auth.signOut();
  if (!global.error) return;
  const local = await supabase.auth.signOut({ scope: 'local' });
  if (!local.error) return;
  await chunkedSecureStore.removeItem(AUTH_STORAGE_KEY).catch(() => {});
  const { error } = await supabase.auth.signOut({ scope: 'local' });
  if (error) throw error;
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within <SessionProvider>');
  return ctx;
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = useState<SessionPhase>('loading');
  const [signedOutNotice, setSignedOutNotice] = useState<string | null>(null);

  // The one place that maps backend onboarding state -> a destination.
  const resolveRoute = useCallback(async () => {
    const me = await api.getMe();
    const { hasLinkedBank, diagnosticState } = me.onboarding;
    if (!hasLinkedBank) {
      setPhase('onboarding');
    } else if (diagnosticState === 'ready') {
      // An unviewed reveal at cold open plays first -- it's the hero moment and the
      // user has had breathing room since the invite. Never at 'pending': syncing no
      // longer blocks; the user lands in the app and progress streams into the chip.
      setPhase('diagnostic');
    } else {
      setPhase('ready');
    }
  }, []);

  // Routes run one at a time, in call order. Two overlapping /me round-trips
  // (launch + a bank-link refresh, say) could otherwise resolve out of order and
  // leave the phase set by the STALER response. Each caller still gets its own
  // result: a rejection propagates to the caller but never blocks the next route.
  const routeChain = useRef<Promise<void>>(Promise.resolve());
  const routeFromMe = useCallback(() => {
    const run = routeChain.current.then(resolveRoute, resolveRoute);
    routeChain.current = run.catch(() => {});
    return run;
  }, [resolveRoute]);

  // Map a Supabase session -> a phase. No session drops to the pre-auth flow; a
  // session primes the API client's bearer token, then onboarding state decides
  // the destination. Only a 401 ends the session (the API client's handler signs
  // out); any other /me failure -- offline, a backend 5xx, a timeout -- keeps the
  // Supabase session and parks on the 'unreachable' screen, which retries. Signing
  // out on those threw a valid session away for a network blip, and offline the
  // sign-out itself failed silently and trapped the user on the Holding frame.
  const routeFromSession = useCallback(
    async (session: Session | null) => {
      if (!session) {
        setSessionToken(null);
        // Every sign-out path lands here (manual, 401 backstop, deleted account):
        // drop the cached balances so one user's figures never greet another.
        clearAccountsCache();
        setPhase('signedOut');
        return;
      }
      setSessionToken(session.access_token);
      setSignedOutNotice(null); // a new session makes any forced-sign-out reason stale
      setPhase('loading');
      try {
        await routeFromMe();
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return; // onUnauthorized signs out
        setPhase('unreachable');
      }
    },
    [routeFromMe],
  );

  // A 401 from any endpoint means the session is dead server-side (contract rule):
  // sign out, which routes to sign-in via the auth listener. Supabase auto-refresh
  // makes this rare; it's the backstop, not the normal expiry path. A deleted
  // account is the one 401 worth a sentence on the sign-in screen.
  useEffect(() => {
    setOnUnauthorized((error) => {
      if (error.code === ACCOUNT_DELETED_CODE) setSignedOutNotice(ACCOUNT_DELETED_NOTICE);
      signOutSupabase().catch(() => {});
    });
    return () => setOnUnauthorized(null);
  }, []);

  // While unreachable, coming back to the foreground is the natural retry moment
  // (the user toggled airplane mode, walked out of the tunnel). A failure here just
  // stays on the retry screen.
  useEffect(() => {
    if (phase !== 'unreachable') return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') routeFromMe().catch(() => {});
    });
    return () => sub.remove();
  }, [phase, routeFromMe]);

  // Launch + every auth change flow through one listener. onAuthStateChange emits
  // INITIAL_SESSION on subscribe, so this also hydrates the persisted session on
  // launch — no separate getSession() call (which would double-route).
  //
  // Only the events that change WHO is signed in re-route. TOKEN_REFRESHED fires
  // on every silent refresh (hourly) and USER_UPDATED after the first-sign-in
  // profile write; routing on those set the phase back to 'loading', which
  // remounts the whole tree mid-use (Holding flash, refetches, a Diagnostic
  // cut off). They only need the new bearer.
  useEffect(() => {
    let active = true;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      switch (event) {
        case 'TOKEN_REFRESHED':
        case 'USER_UPDATED':
          if (session) setSessionToken(session.access_token);
          return;
        case 'INITIAL_SESSION':
        case 'SIGNED_IN':
        case 'SIGNED_OUT':
          void routeFromSession(session);
          return;
        default:
          return;
      }
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
    setSignedOutNotice(null);
    await signInWithApple();
  }, []);

  const completeDiagnostic = useCallback(() => setPhase('ready'), []);

  const signOut = useCallback(async () => {
    setSignedOutNotice(null);
    await signOutSupabase(); // listener routes to 'signedOut'
  }, []);

  return (
    <SessionContext.Provider
      value={{ phase, signedOutNotice, signIn, refresh: routeFromMe, completeDiagnostic, signOut }}
    >
      {children}
    </SessionContext.Provider>
  );
}
