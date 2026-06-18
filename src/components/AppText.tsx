// src/components/AppText.tsx
// The only way text enters the app. Every size/weight/tracking/leading comes from
// the type scale in theme/dusk.ts — never an ad-hoc fontSize on a raw <Text>.
import React from 'react';
import { Text, TextProps, TextStyle } from 'react-native';
import { palette, type as typeTokens } from '../../theme/dusk';
import { fontFamilyForWeight } from '../../theme/fonts';

export type TypeVariant = keyof typeof typeTokens.scale;

export type AppTextProps = TextProps & {
  /** A key from the type scale in theme/dusk.ts. */
  variant?: TypeVariant;
  /** Defaults to the primary warm-white. Pass a palette token, not a literal. */
  color?: string;
  /** Turn on tabular + lining figures. Required anywhere a number appears. */
  tabular?: boolean;
};

// fontVariant in the tokens is a readonly tuple; RN wants a mutable array.
const NUMERIC_VARIANT = [...typeTokens.numericVariant] as TextStyle['fontVariant'];

export function AppText({
  variant = 'body',
  color = palette.textPrimary,
  tabular = false,
  style,
  ...rest
}: AppTextProps) {
  const t = typeTokens.scale[variant] as {
    size: number;
    weight?: string;
    letterSpacing?: number;
    lineHeight?: number;
    opacity?: number;
  };

  const base: TextStyle = {
    fontFamily: fontFamilyForWeight(t.weight),
    fontSize: t.size,
    letterSpacing: t.letterSpacing,
    lineHeight: t.lineHeight,
    color,
    opacity: t.opacity,
  };

  return (
    <Text
      style={[base, tabular ? { fontVariant: NUMERIC_VARIANT } : null, style]}
      {...rest}
    />
  );
}
