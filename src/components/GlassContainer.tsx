// src/components/GlassContainer.tsx
// Groups MULTIPLE <GlassSurface> children so their glass effects merge when close
// together (Apple's container-merging behaviour). On unsupported platforms it
// degrades to a plain layout View — the surfaces still render their own fallbacks.
//
// Do NOT wrap a single surface in this: the native container traces a hard merged-
// glass rectangle around its contents, which reads as a selection box. A lone card
// should use <GlassSurface> directly.
import React from 'react';
import { View, ViewProps } from 'react-native';
import { GlassContainer as NativeGlassContainer } from 'expo-glass-effect';
import { spacing as spacingTokens } from '../../theme/dusk';
import { GLASS_SUPPORTED } from '../glass/support';

export type GlassContainerProps = ViewProps & {
  /** Distance at which child glass effects begin merging. */
  spacing?: number;
  children?: React.ReactNode;
};

export function GlassContainer({
  spacing = spacingTokens.md,
  style,
  children,
  ...rest
}: GlassContainerProps) {
  if (!GLASS_SUPPORTED) {
    return (
      <View style={style} {...rest}>
        {children}
      </View>
    );
  }
  return (
    <NativeGlassContainer spacing={spacing} style={style} {...rest}>
      {children}
    </NativeGlassContainer>
  );
}
