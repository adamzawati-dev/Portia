// theme/dusk.ts
// Portia design tokens — the Dusk world. Dark-mode-first.
// SINGLE SOURCE OF TRUTH. Never hardcode a color, blur, radius, or font size
// in a component — pull it from here. Light-mode counterpart is a TODO once
// the dark world is locked in code.

export const palette = {
  // warm-ink environment (aubergine → wine). Never cold black — the warmth is the point.
  envBase:   '#220A22',
  envTop:    '#2C0E2C',
  envMid:    '#3A1326',
  envBottom: '#190A1C',

  // signature — apricot. Positive, hero, "here's what's yours." A glow, never an alarm.
  signature:     '#FFAE74',
  signatureDeep: '#E07A45',
  signatureCtaA: '#FFC089', // CTA gradient start
  signatureCtaB: '#FF9E62', // CTA gradient end
  signatureGlow: 'rgba(255,174,116,0.42)',
  onSignature:   '#3A0F1E', // text/icons sitting ON the signature fill

  // attention — reserved STRICTLY for "this matters." Once per screen, at most.
  attention: '#FF77A8',

  // warm-white type ramp
  textPrimary:   '#F8ECE8',
  textSecondary: 'rgba(248,236,232,0.64)',
  textTertiary:  'rgba(248,236,232,0.44)',

  // device bezel / large frames
  frameTop:    '#3A1830',
  frameBottom: '#150612',
} as const;

// Gradients — feed these into expo-linear-gradient.
export const gradients = {
  environment: {
    colors:    ['#2C0E2C', '#3A1326', '#190A1C'] as const,
    locations: [0, 0.55, 1] as const,
  },
  // glow blooms layered OVER the environment (radial, low alpha)
  glowMagenta: 'rgba(180,40,110,0.38)',
  glowWarm:    'rgba(150,70,40,0.40)',
  // leverage hero card fill
  leverage: {
    colors:    ['rgba(255,174,116,0.20)', 'rgba(180,40,110,0.12)', 'rgba(255,220,225,0.04)'] as const,
    locations: [0, 0.62, 1] as const,
  },
  cta: { colors: ['#FFC089', '#FF9E62'] as const },
} as const;

// Liquid-glass material. Real blur comes from the native bridge (see GlassSurface).
// These tokens drive the fallback + the decorative layers (specular, edge, tint).
export const glass = {
  tintFrom: 'rgba(255,220,225,0.11)',  // glass fill / fallback gradient start
  tintTo:   'rgba(255,200,180,0.035)', // …end
  border:   'rgba(255,215,210,0.16)',
  blurRadius: 26,   // passed to the native bridge where supported
  saturation: 1.8,
  specular: 'rgba(255,255,255,0.20)', // inset top highlight
  lift: { color: 'rgba(0,0,0,0.40)', radius: 32, offsetY: 14 },
  // dichroic refractive edge (subtle) — most visible on hero surfaces
  dichroic: ['#FF9EC0', '#FFB98A', '#FFD28A', '#FF9EC0'] as const,
  dichroicOpacity: 0.34,
  // solid fallback for devices without liquid glass (Android / iOS < 26)
  fallbackFill: 'rgba(58,19,38,0.72)',
} as const;

export const radius = {
  sm: 13, md: 17 /* buttons */, lg: 22 /* glass cards */, xl: 25 /* hero card */,
  emblem: 26, device: 34,
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24 } as const;

// Typography — Hanken Grotesk. Numbers are the hero: tabular figures EVERYWHERE a
// figure appears, currency glyph de-emphasized, tight tracking on display sizes.
// On every numeric <Text>, set: fontVariant={type.numericVariant}
export const type = {
  family: 'HankenGrotesk',
  numericVariant: ['tabular-nums', 'lining-nums'] as const,
  scale: {
    display:  { size: 30, weight: '600', letterSpacing: -0.6, lineHeight: 35 },
    title:    { size: 20, weight: '600', letterSpacing: -0.2, lineHeight: 24 },
    body:     { size: 15, weight: '400', letterSpacing: 0,    lineHeight: 23 },
    caption:  { size: 12, weight: '500', letterSpacing: 0.4,  lineHeight: 16 },
    overline: { size: 11, weight: '600', letterSpacing: 1.3,  lineHeight: 14 }, // UPPERCASE labels
    // number treatments — always pair with numericVariant
    numHero:  { size: 68, weight: '700', letterSpacing: -2.4, lineHeight: 70 }, // diagnostic full-screen figure
    numXL:    { size: 47, weight: '600', letterSpacing: -1.4, lineHeight: 47 }, // hero balance
    numLG:    { size: 45, weight: '700', letterSpacing: -1.3, lineHeight: 45 }, // leverage figure
    numMD:    { size: 30, weight: '600', letterSpacing: -0.6, lineHeight: 32 },
    numSM:    { size: 18, weight: '600', letterSpacing: -0.2, lineHeight: 22 }, // list-row figure
    currency:   { size: 23, weight: '500', opacity: 0.7 }, // the de-emphasized $ glyph
    currencySm: { size: 12, weight: '500', opacity: 0.7 }, // de-emphasized $ for numSM
  },
} as const;

// Motion — spring-based and physical. ALWAYS respect Reduce Motion.
export const motion = {
  spring:       { damping: 18, stiffness: 180, mass: 1 }, // default surface motion
  springSoft:   { damping: 22, stiffness: 120, mass: 1 }, // entrance / reveal
  durationFast: 120, // specular tracking
  durationBase: 240,
  revealStagger: 90, // Diagnostic reveal staggers children by this (ms)
} as const;

export const dusk = { palette, gradients, glass, radius, spacing, type, motion } as const;
export type Theme = typeof dusk;
export default dusk;
