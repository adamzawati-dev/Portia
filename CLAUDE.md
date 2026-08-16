# Portia app — Claude Code working doc

A React Native (Expo) iOS client on top of the existing, proven Portia backend.
**The app is a client. The brain stays on the backend** — see the architecture
boundary below. This doc is the design + voice contract; tokens live in
`theme/dusk.ts` (the single source of truth).

## Build & run (Phase 0 landed)
- **Expo SDK 56** (managed), TypeScript, **New Architecture on** (`newArchEnabled: true`), iOS-first.
- Liquid glass via **`expo-glass-effect`** (first-party Expo, autolinks in managed). `@callstack/liquid-glass` is the noted escape hatch if we later need its specific behaviours. Requires **iOS 26 + Xcode 26** to render real glass; falls back to a tinted/frosted solid otherwise.
- The glass module does **not** run in Expo Go — use a **Dev Client**: `npx expo run:ios` (needs Xcode 26) or an EAS dev-client build.
- iOS deployment target is pinned to **26.0** via `expo-build-properties` (required for the glass APIs to compile).
- Project lives at `~/Developer/portia` (NOT under `~/Desktop`: macOS TCC blocks Node/Expo `getcwd` inside Desktop).
- Fonts: **Hanken Grotesk** via `@expo-google-fonts/hanken-grotesk`, weight→family map in `theme/fonts.ts`.

## Primitives (all token-driven)
- `Glass.Chrome` / `Glass.Sheet` — the ONLY two glass wrappers (chrome: tab bar, composer, top controls, floating buttons; sheet: overlays). Real glass when `GLASS_SUPPORTED`, else tinted fallback. **Content is never glass.**
- `<Surface>` — flat content surface (cards, rows, chat bubbles, Diagnostic cards) on the Dusk background.
- `<Press>` — the one pressable: 0.97 dip on the press spring (Reanimated, UI thread), `haptic.tap` on activation, `commit` prop for `haptic.commit`.
- `<Skeleton>` / `OverviewSkeleton` / `ChatSkeleton` — loading is the screen's shape, dimmed and breathing. **No spinners.**
- `<Money>` — currency amount; de-emphasized `$`, tabular figures. Never string-concat an amount.
- `<AppText>` — the only text entry point; pulls every size/weight/tracking from the type scale.
- `<Background>` — environment gradient + two glow blooms + grain overlay.
- `haptic` (`theme/haptics.ts`) — tap/commit/success/warning/tick. The only file that imports expo-haptics.

---

# Design system — Portia app (Dusk)

Rules Claude Code follows for every screen and component. These are non-negotiable;
they are how the app stays world-class instead of templated.

## The world
- **Dusk.** Warm-ink environment (aubergine → wine), apricot signature. Tokens live in `theme/dusk.ts` — pull from there, never hardcode a color/blur/radius/size.
- **No green/red money binary.** Spending is never red, opportunity is never a scold. This is the anti-budget thesis made literal.
- **Signature is sparing.** Apricot marks the positive/hero moment and the primary action — a glow, not an alarm. Coral (`attention`) is reserved STRICTLY for "this matters," once per screen at most.
- **Restraint scales with stakes.** Trust screens (bank-connect, anything touching credentials or money movement) get *less* — no pulse, no glow, more air. A loud trust screen reads as a scam.

## Material — glass is chrome, content is flat
- **Glass belongs to chrome only** — the layer that floats over content: tab bar, composer, top controls, floating buttons (`Glass.Chrome`) and modal sheets (`Glass.Sheet`). Built on the native bridge (Apple's real Liquid Glass APIs); requires iOS 26 + Xcode 26.
- **Content is never glass.** Cards, rows, chat bubbles, Diagnostic cards are flat `<Surface>`s on the Dusk background — calmer, and no compositor tax in scrolling lists.
- **Never hardcode a blur value** — use `glass.blurRadius` etc. from tokens. A single fixed blur is the generic-glassmorphism tell.
- **Graceful fallback is mandatory.** `GLASS_SUPPORTED` gates the native bridge; on Android / iOS < 26 the wrappers fall back to the tinted solid (`glass.fallbackFill`). The layout must still look intentional, not broken.
- **Concentric corners:** nested rounded elements use `innerRadius(outer, padding)` from `theme/dusk.ts`. Radii: button 14, card 24, sheet 32, chip 999.

## Type — numbers are the hero
- Hanken Grotesk. Use the scale in `theme/dusk.ts`, not ad-hoc sizes.
- **Tabular figures everywhere a number appears** (`fontVariant: ['tabular-nums','lining-nums']`) so live values update without horizontal jitter.
- Currency glyph is de-emphasized (smaller, lower opacity); the figure dominates. Use the `<Money>` component, never raw string concatenation for amounts.
- Sentence case everywhere. Never Title Case, never ALL CAPS except the `overline` label style.

## Motion
- **All animation is Reanimated worklets on the UI thread** — never JS-thread `Animated`, never `LayoutAnimation`.
- Spring-based and physical: `motion.springs.press` (touch), `.sheet` (overlays), `.layout` (entrances). Durations: `motion.durations` {instant 120, fast 200, base 260, slow 400}. Never canned linear easings.
- Read motion through `useMotion()` (src/hooks/useMotion) — under Reduce Motion it zeroes durations and makes springs immediate, so animated code needs no branching.
- The Diagnostic is a paced, staggered reveal (`motion.revealStagger`).
- Haptics go through `haptic` (`theme/haptics.ts`) — tap on touches, commit on state-changing actions; nothing else imports expo-haptics.

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

@AGENTS.md
