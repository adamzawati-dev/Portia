# Claude Code kickoff — Portia app, Phase 0 (scaffold + design system)

Paste this into Claude Code after you've added `theme/dusk.ts` and merged the
design-system section into `CLAUDE.md`.

---

We're starting the Portia iOS app — a new React Native client on top of the existing,
proven backend. Do NOT touch or rebuild any backend logic; the app is a client that
will call the existing API. This first task is scaffold + design-system foundation
ONLY. Build it, prove it works, then stop for my review. Don't build the full screen
set yet.

**Stack decisions (already made — don't relitigate):**
- Expo (managed), TypeScript, **New Architecture enabled**, iOS-first.
- Liquid glass via the **native bridge** — the real Apple Liquid Glass APIs, not a blur fake. Requires iOS 26 + Xcode 26. The glass libs don't run in Expo Go, so set up an Expo Dev Client / config plugin.
- Design tokens are in `theme/dusk.ts` — the single source of truth. Design + voice rules are in `CLAUDE.md`. Follow both exactly.

**Before installing anything: Think Before Coding.** Check current versions and APIs
against live docs — Expo SDK that supports New Arch + RN 0.80+, and the liquid-glass
package. Recommend `@callstack/liquid-glass` (wraps Apple's APIs via Fabric/TurboModules,
supports interactive + container merging) with `expo-glass-effect` as the fallback option;
confirm which is cleanest for managed Expo right now and tell me your choice before wiring it.
State your plan and the exact versions, then proceed.

**Build, in order:**
1. Scaffold the Expo app (TS, New Architecture, iOS-first). Set up the Dev Client.
2. Install + configure the liquid-glass bridge. Add `expo-linear-gradient` and the blur/fallback dependency.
3. Add the **Hanken Grotesk** font (expo-font).
4. Add `theme/dusk.ts` (provided) as the token source.
5. Build three primitives, all driven by tokens:
   - `<GlassSurface>` — a single glass panel. Uses the native bridge; checks `isLiquidGlassSupported` and falls back to the tinted solid (`glass.fallbackFill`) on Android / iOS < 26. Includes the inset specular highlight and the soft lift shadow.
   - `<GlassContainer>` — groups child surfaces so their glass effects merge.
   - `<Money>` — renders a currency amount with the de-emphasized `$` glyph and tabular figures (`fontVariant`). Plus a small `<AppText>` wrapping the type scale.
6. Build a `<Background>` — the environment gradient + the two layered glow blooms + a subtle grain overlay.
7. Render ONE smoke-test screen: `<Background>` with a single `<GlassSurface>` card showing a tabular balance via `<Money>` and the apricot CTA button. No navigation, no real data — this only has to prove the system works.

**Done = all of these true:**
- Glass renders for real on an iOS 26 simulator, and falls back cleanly (still looks intentional) when liquid glass is unsupported.
- Hanken Grotesk loads; the balance uses tabular figures and the de-emphasized currency glyph.
- Every color/size/blur on screen comes from `theme/dusk.ts`, nothing hardcoded.
- Reduce Motion is respected (no ambient/specular motion when it's on).

**Then stop.** commit → push → confirm the SHA, summarize what you scaffolded and the
package versions you landed on, and show me the smoke-test screen. We review before any
real screens get built.
