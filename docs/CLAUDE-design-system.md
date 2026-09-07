# Design system — Portia app (Dusk)

Rules Claude Code follows for every screen and component. These are non-negotiable;
they are how the app stays world-class instead of templated.

## The world
- **Dusk.** Warm-ink environment (aubergine → wine), apricot signature. Tokens live in `theme/dusk.ts` — pull from there, never hardcode a color/blur/radius/size.
- **No green/red money binary.** Spending is never red, opportunity is never a scold. This is the anti-budget thesis made literal.
- **Signature is sparing.** Apricot marks the positive/hero moment and the primary action — a glow, not an alarm. Coral (`attention`) is reserved STRICTLY for "this matters," once per screen at most.
- **Restraint scales with stakes.** Trust screens (bank-connect, anything touching credentials or money movement) get *less* — no pulse, no glow, more air. A loud trust screen reads as a scam.

## Material — liquid glass
- Built on the native bridge (Apple's real Liquid Glass APIs), not a CSS-style blur fake. Requires iOS 26 + Xcode 26.
- Two primitives only: **`<GlassSurface>`** (a single glass panel) and **`<GlassContainer>`** (groups whose glass effects merge). Everything translucent uses these.
- **Never hardcode a blur value** — use `glass.blurRadius` etc. from tokens. A single fixed blur is the generic-glassmorphism tell.
- **Graceful fallback is mandatory.** Check `isLiquidGlassSupported`; on Android / iOS < 26 fall back to the tinted solid (`glass.fallbackFill`). The layout must still look intentional, not broken.

## Type — numbers are the hero
- Hanken Grotesk. Use the scale in `theme/dusk.ts`, not ad-hoc sizes.
- **Tabular figures everywhere a number appears** (`fontVariant: ['tabular-nums','lining-nums']`) so live values update without horizontal jitter.
- Currency glyph is de-emphasized (smaller, lower opacity); the figure dominates. Use the `<Money>` component, never raw string concatenation for amounts.
- Sentence case everywhere. Never Title Case, never ALL CAPS except the `overline` label style.

## Motion
- Spring-based and physical (use `motion.spring` / `springSoft`), never canned linear easings.
- Hero surfaces earn pointer/scroll-reactive specular. The Diagnostic is a paced, staggered reveal (`motion.revealStagger`).
- **Always respect Reduce Motion** — disable ambient drift, pulse, and specular tracking when it's on.

## Voice — Portia (all copy)
- Sharp friend, not a parent. Direct, specific, dry, anchored to real numbers.
- **Always name the time window** a figure covers. **Never** show a number the API didn't return.
- Banned: character verdicts ("you spend like…"), personal-life insinuation (a dating-app charge is a $45 subscription, full stop), generic fintech cheerfulness.
- UI writing: active voice, plain verbs, sentence case. Errors don't apologize and are never vague about what happened or how to fix it. An empty state is an invitation to act.

## Architecture boundary (load-bearing)
- **The app is a client. The brain stays on the backend.** The accuracy engine is the crown jewel and is NOT rebuilt here.
- The app **never does arithmetic** and never invents a figure, merchant, or category. It renders exactly what the API returns. Every dollar value on screen came from the backend.

## Working discipline
- Think Before Coding · Simplicity First · Surgical Changes · Goal-Driven Execution.
- Confirm current package versions and APIs against live docs before installing — don't trust memory on fast-moving RN/Expo/glass libraries.
- Every change ends in **commit → push → confirm SHA**.
