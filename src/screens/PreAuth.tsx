// src/screens/PreAuth.tsx
// What a signed-out user sees: the three-beat value sequence, then Sign in with
// Apple. Kept client-side here (not as session phases) so the whole flow remounts
// fresh whenever the user is signed out — including right after sign-out, which is
// why signing out returns the user to the start of onboarding.
import React, { useState } from 'react';
import { OnboardingScreen } from './OnboardingScreen';
import { SignInScreen } from './SignInScreen';

export function PreAuth() {
  const [introDone, setIntroDone] = useState(false);
  return introDone ? <SignInScreen /> : <OnboardingScreen onDone={() => setIntroDone(true)} />;
}
