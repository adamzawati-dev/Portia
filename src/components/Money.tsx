// src/components/Money.tsx
// The ONLY way a currency amount reaches the screen. Never string-concatenate an
// amount inline. The figure dominates; the currency glyph (and the cents) are
// de-emphasized via the `currency` type token. Tabular figures everywhere so live
// values update without horizontal jitter.
//
// Boundary note: the app never invents a figure. `value` is whatever the backend
// returned; here we only *present* it (grouping + fixed decimals), never compute it.
import React from 'react';
import { View, ViewProps } from 'react-native';
import { palette, spacing } from '../../theme/dusk';
import { AppText, TypeVariant } from './AppText';

type NumericVariant = Extract<TypeVariant, 'numHero' | 'numXL' | 'numLG' | 'numMD' | 'numSM'>;

export type MoneyProps = ViewProps & {
  /** The figure as returned by the API. */
  value: number;
  /** Size of the dominant figure. */
  variant?: NumericVariant;
  currencySymbol?: string;
  /** Defaults to primary text; pass `palette.signature` for hero/positive moments. */
  color?: string;
  showCents?: boolean;
};

function groupThousands(intPart: string): string {
  return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function Money({
  value,
  variant = 'numXL',
  currencySymbol = '$',
  color = palette.textPrimary,
  showCents = true,
  style,
  ...rest
}: MoneyProps) {
  const negative = value < 0;
  const fixed = Math.abs(value).toFixed(showCents ? 2 : 0);
  const [intPart, centsPart] = fixed.split('.');
  const grouped = groupThousands(intPart);

  // The de-emphasized glyph scales with the figure so it never out-sizes a small one.
  const currencyVariant = variant === 'numSM' ? 'currencySm' : 'currency';

  const a11y = `${negative ? '-' : ''}${currencySymbol}${grouped}${centsPart ? '.' + centsPart : ''}`;

  return (
    <View
      style={[{ flexDirection: 'row', alignItems: 'baseline' }, style]}
      accessible
      accessibilityLabel={a11y}
      {...rest}
    >
      {negative ? (
        <AppText variant={variant} color={color} tabular>
          −
        </AppText>
      ) : null}
      <AppText variant={currencyVariant} color={color} tabular style={{ marginRight: spacing.xs / 2 }}>
        {currencySymbol}
      </AppText>
      <AppText variant={variant} color={color} tabular>
        {grouped}
      </AppText>
      {showCents ? (
        <AppText variant={currencyVariant} color={color} tabular>
          .{centsPart}
        </AppText>
      ) : null}
    </View>
  );
}
