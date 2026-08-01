// src/auth/supabase.ts
// The Supabase client — the app's real identity provider. Sign in with Apple goes
// through Supabase Auth's native ID-token flow (signInWithIdToken), so Supabase
// verifies the Apple identity token against Apple's keys and our registered client
// IDs server-side. We do NOT hand-roll Apple token verification.
//
// Config:
//  - EXPO_PUBLIC_SUPABASE_URL / _ANON_KEY come from .env.local (see .env.example).
//    The anon (publishable) key is client-safe by design.
//  - The session persists in the iOS Keychain via the chunked SecureStore adapter.
//  - persistSession + autoRefreshToken keep the user signed in across relaunches;
//    detectSessionInUrl is off (no web redirect — native flow returns a token).
import 'react-native-url-polyfill/auto';
import { AppState } from 'react-native';
import { createClient } from '@supabase/supabase-js';
import { chunkedSecureStore } from './secureStorage';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/** False until real keys are dropped into .env.local — lets the UI fail honestly. */
export const isSupabaseConfigured =
  !!url && !!anonKey && !url.includes('YOUR-PROJECT') && !anonKey.includes('YOUR-ANON');

export const supabase = createClient(url ?? 'http://localhost', anonKey ?? 'public-anon-key', {
  auth: {
    storage: chunkedSecureStore,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

// Supabase refreshes the access token on a timer; pause it while the app is
// backgrounded and resume on foreground (the documented React Native pattern).
AppState.addEventListener('change', (state) => {
  if (state === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});
