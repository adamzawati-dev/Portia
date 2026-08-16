// src/chat/markdown.tsx
// Streaming-safe markdown for chat: `stabilize` balances any construct a
// partial stream can leave open (unclosed ``` fence, dangling ** or `) so a
// mid-stream frame renders as if the construct were closed — layout never
// breaks, then the next chunk refines it. <MessageText> renders the small
// vocabulary Portia's replies use — bold, inline code, fenced blocks — through
// AppText, so every size and color stays a token. Unknown markdown passes
// through as plain text rather than half-rendering.
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { glass, innerRadius, palette, radius, spacing } from '../../theme/dusk';
import { fontFamilyForWeight } from '../../theme/fonts';
import { AppText } from '../components/AppText';

/** Close any construct an incomplete stream left open. Order matters: balance
 *  fences first so inline counting only sees prose. */
export function stabilize(text: string): string {
  let out = text;
  if (((out.match(/```/g) ?? []).length) % 2 === 1) out += '\n```';
  const prose = out.split(/```[\s\S]*?```/).join('');
  if (((prose.match(/\*\*/g) ?? []).length) % 2 === 1) out += '**';
  const proseTicks = (prose.match(/`/g) ?? []).length;
  if (proseTicks % 2 === 1) out += '`';
  return out;
}

type Block = { type: 'p' | 'code'; content: string };

function parseBlocks(text: string): Block[] {
  // Odd segments sit between ``` markers. A language tag on the fence line is
  // presentation noise here — drop it.
  return text
    .split('```')
    .map((seg, i): Block =>
      i % 2 === 1
        ? { type: 'code', content: seg.replace(/^[a-zA-Z0-9]*\n/, '').replace(/\n$/, '') }
        : { type: 'p', content: seg.replace(/^\n/, '').replace(/\n$/, '') },
    )
    .filter((b) => b.content.length > 0);
}

const BOLD_FAMILY = fontFamilyForWeight('600');

function InlineSpans({ content, color }: { content: string; color: string }) {
  const nodes: React.ReactNode[] = [];
  // Code spans first, then bold inside the prose runs.
  content.split(/(`[^`]+`)/g).forEach((seg, i) => {
    if (seg.startsWith('`') && seg.endsWith('`') && seg.length > 2) {
      nodes.push(
        <AppText key={`c${i}`} variant="body" color={palette.textPrimary} style={styles.codeSpan}>
          {seg.slice(1, -1)}
        </AppText>,
      );
      return;
    }
    seg.split(/(\*\*[\s\S]+?\*\*)/g).forEach((run, j) => {
      if (run.startsWith('**') && run.endsWith('**') && run.length > 4) {
        nodes.push(
          <AppText key={`b${i}.${j}`} variant="body" color={color} style={styles.bold}>
            {run.slice(2, -2)}
          </AppText>,
        );
      } else if (run.length > 0) {
        nodes.push(run);
      }
    });
  });
  return (
    <AppText variant="body" color={color}>
      {nodes}
    </AppText>
  );
}

export function MessageText({ text, color }: { text: string; color: string }) {
  const blocks = parseBlocks(stabilize(text));
  return (
    <>
      {blocks.map((b, i) =>
        b.type === 'code' ? (
          <View key={i} style={[styles.codeBlock, i > 0 && styles.blockGap]}>
            <AppText variant="body" color={palette.textPrimary}>
              {b.content}
            </AppText>
          </View>
        ) : (
          <View key={i} style={i > 0 ? styles.blockGap : null}>
            <InlineSpans content={b.content} color={color} />
          </View>
        ),
      )}
    </>
  );
}

const styles = StyleSheet.create({
  bold: {
    fontFamily: BOLD_FAMILY,
  },
  codeSpan: {
    backgroundColor: palette.envBottom,
  },
  codeBlock: {
    backgroundColor: palette.envBottom,
    borderRadius: innerRadius(radius.card, spacing.md),
    padding: spacing.md,
  },
  blockGap: {
    marginTop: spacing.sm,
  },
});
