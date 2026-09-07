// src/components/Surface.tsx
// A flat content surface on the Dusk background — cards, rows, chat bubbles,
// Diagnostic cards. Content is NEVER glass (glass is chrome-only; see
// Glass.tsx): a solid warm-ink fill with a hairline border reads calm, costs
// nothing to composite, and lets the environment's blooms stay the depth cue.
import React from 'react';
import { StyleSheet, View, ViewProps } from 'react-native';
import { glass, radius as radiusTokens, surface } from '../../theme/dusk';

export type SurfaceProps = ViewProps & {
  /** Corner radius token value. Defaults to the card radius. */
  radius?: number;
  /** Optional wash over the fill (e.g. palette.signatureGlow for "yours"). */
  tint?: string;
  children?: React.ReactNode;
};

export function Surface({ radius = radiusTokens.card, tint, style, children, ...rest }: SurfaceProps) {
  return (
    <View
      style={[
        {
          borderRadius: radius,
          backgroundColor: surface.elevated,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: glass.border,
          overflow: 'hidden',
        },
        style,
      ]}
      {...rest}
    >
      {tint ? (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: tint }]} />
      ) : null}
      {children}
    </View>
  );
}
