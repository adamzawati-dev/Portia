// theme/fonts.ts
// Hanken Grotesk wiring. The design tokens (theme/dusk.ts) describe one family
// ('HankenGrotesk') with numeric weights; on native, each weight is a distinct
// loaded font file, so we map a token weight -> the concrete loaded family name.
// Single source for "which weight string maps to which font" lives here.
// Import per-weight subpaths (not the package root) so Metro bundles only the four
// weights we use, instead of all 18 Hanken Grotesk faces.
import { HankenGrotesk_400Regular } from '@expo-google-fonts/hanken-grotesk/400Regular';
import { HankenGrotesk_500Medium } from '@expo-google-fonts/hanken-grotesk/500Medium';
import { HankenGrotesk_600SemiBold } from '@expo-google-fonts/hanken-grotesk/600SemiBold';
import { HankenGrotesk_700Bold } from '@expo-google-fonts/hanken-grotesk/700Bold';

// Pass straight into useFonts().
export const fontAssets = {
  HankenGrotesk_400Regular,
  HankenGrotesk_500Medium,
  HankenGrotesk_600SemiBold,
  HankenGrotesk_700Bold,
} as const;

// Token weight string -> loaded font family. Keep in sync with the weights used
// in theme/dusk.ts `type.scale`.
const WEIGHT_TO_FAMILY: Record<string, keyof typeof fontAssets> = {
  '400': 'HankenGrotesk_400Regular',
  '500': 'HankenGrotesk_500Medium',
  '600': 'HankenGrotesk_600SemiBold',
  '700': 'HankenGrotesk_700Bold',
};

export function fontFamilyForWeight(weight?: string): keyof typeof fontAssets {
  return (weight && WEIGHT_TO_FAMILY[weight]) || 'HankenGrotesk_400Regular';
}
