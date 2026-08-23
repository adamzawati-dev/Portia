// src/chat/markdown.tsx
// Streaming-safe rendering for Portia's prose. `stabilize` balances constructs a
// partial stream can leave open (unclosed ``` fence, dangling ** or `) so a
// mid-stream frame never breaks layout. <MessageProse> renders the small
// vocabulary the replies use — bold, inline code, fenced blocks — line by line:
// inline spans never cross a line break (a cross-line match is how fragments of
// a figure end up beached on their own line), heading markers are dropped, and
// dollar amounts render one step up (numSM, semibold, tabular, warm near-white)
// so figures read before prose. All sizes/colors are tokens; nothing here
// computes a number — amounts are lifted verbatim from the backend's text.
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { glass, innerRadius, palette, radius, spacing } from '../../theme/dusk';
import { fontFamilyForWeight } from '../../theme/fonts';
import { AppText } from '../components/AppText';

// A dollar figure exactly as the backend wrote it (with optional cents).
const AMOUNT = /\$[\d,]+(?:\.\d{1,2})?/;
const AMOUNT_SPLIT = /(\$[\d,]+(?:\.\d{1,2})?)/g;
const AMOUNT_EXACT = /^\$[\d,]+(?:\.\d{1,2})?$/; // whole-piece check (no /g state)

/** Close any construct an incomplete stream left open. Order matters: balance
 *  fences first so inline counting only sees prose. */
export function stabilize(text: string): string {
  let out = text;
  if (((out.match(/```/g) ?? []).length) % 2 === 1) out += '\n```';
  const prose = out.split(/```[\s\S]*?```/).join('');
  if (((prose.match(/\*\*/g) ?? []).length) % 2 === 1) out += '**';
  if (((prose.match(/`/g) ?? []).length) % 2 === 1) out += '`';
  return out;
}

// ---------------------------------------------------------------------------
// Financial callout: "this is the number that matters." The contract has no
// flag yet, so the rule is structural and DELIBERATELY strict:
//   - the line is short and LEADS with the amount ("$2,558 net loss"),
//   - it is not a list item (breakdowns never become KPIs),
//   - and it is the ONLY such line in the reply — two or more figure lines
//     mean the reply is a breakdown, and nothing gets the callout.
// Amounts embedded mid-sentence never promote. When the backend grows a
// highlight flag, it replaces this heuristic.
// ---------------------------------------------------------------------------

export type HeroFigure = {
  /** Verbatim backend text, e.g. "$2,558" — parsed only to render, never math. */
  amount: string;
  /** Words sharing the lifted line ("net loss"), or null for a bare figure. */
  label: string | null;
  /** The exact raw line to remove from prose (it renders as the callout). */
  liftedLine: string;
};

const SHORT_LINE = 48;
const LIST_MARKER = /^\s*([-*•→]|\d+[.)])\s+/;

export function extractHero(text: string): HeroFigure | null {
  const candidates: HeroFigure[] = [];
  for (const line of text.split('\n')) {
    if (LIST_MARKER.test(line)) continue; // list items never hero
    // Strip markdown markers AND the streaming caret — it rides the live text
    // and must never leak into a lifted label.
    const cleaned = line.replace(/[*#`_▍]/g, '').trim();
    if (cleaned.length === 0 || cleaned.length > SHORT_LINE) continue;
    const m = cleaned.match(AMOUNT);
    if (!m || !cleaned.startsWith(m[0])) continue; // callouts lead with the figure
    const label = cleaned
      .slice(m[0].length)
      .replace(/^[\s\-–—:,.]+|[\s\-–—:,.]+$/g, '')
      .trim();
    candidates.push({ amount: m[0], label: label || null, liftedLine: line });
  }
  return candidates.length === 1 ? candidates[0] : null;
}

// ---------------------------------------------------------------------------
// Prose rendering
// ---------------------------------------------------------------------------

type Block = { type: 'p' | 'code'; content: string };

function parseBlocks(text: string): Block[] {
  return text
    .split('```')
    .map((seg, i): Block =>
      i % 2 === 1
        ? { type: 'code', content: seg.replace(/^[a-zA-Z0-9]*\n/, '').replace(/\n$/, '') }
        : { type: 'p', content: seg.replace(/^\n+/, '').replace(/\n+$/, '') },
    )
    .filter((b) => b.content.length > 0);
}

const BOLD_FAMILY = fontFamilyForWeight('600');

function InlineSpans({ line, color }: { line: string; color: string }) {
  const nodes: React.ReactNode[] = [];
  // Code spans first; then bold (within the line only); then amounts.
  line.split(/(`[^`\n]+`)/g).forEach((seg, i) => {
    if (seg.startsWith('`') && seg.endsWith('`') && seg.length > 2) {
      nodes.push(
        <AppText key={`c${i}`} variant="body" color={palette.textPrimary} style={styles.codeSpan}>
          {seg.slice(1, -1)}
        </AppText>,
      );
      return;
    }
    seg.split(/(\*\*[^\n*]+\*\*)/g).forEach((run, j) => {
      const bold = run.startsWith('**') && run.endsWith('**') && run.length > 4;
      const content = bold ? run.slice(2, -2) : run;
      if (content.length === 0) return;
      content.split(AMOUNT_SPLIT).forEach((piece, k) => {
        if (piece.length === 0) return;
        if (AMOUNT_EXACT.test(piece)) {
          // Figures step up from prose: numSM, semibold, tabular, near-white.
          nodes.push(
            <AppText key={`a${i}.${j}.${k}`} variant="numSM" color={palette.textPrimary} tabular>
              {piece}
            </AppText>,
          );
        } else {
          nodes.push(
            bold ? (
              <AppText key={`b${i}.${j}.${k}`} variant="body" color={color} style={styles.bold}>
                {piece}
              </AppText>
            ) : (
              piece
            ),
          );
        }
      });
    });
  });
  return (
    <AppText variant="body" color={color}>
      {nodes}
    </AppText>
  );
}

/** One line of prose: heading markers dropped, list dashes kept as-is. */
function ProseLine({ line, color }: { line: string; color: string }) {
  const cleaned = line.replace(/^#{1,4}\s+/, '');
  return <InlineSpans line={cleaned} color={color} />;
}

export function MessageProse({
  text,
  color,
  omitLine,
}: {
  text: string;
  color: string;
  /** Exact line lifted into the hero block — removed from the prose flow. */
  omitLine?: string | null;
}) {
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
            {b.content
              .split('\n')
              .filter((line) => !(omitLine != null && line === omitLine))
              .map((line, l) =>
                line.trim().length === 0 ? (
                  <View key={l} style={styles.lineBreak} />
                ) : (
                  <View key={l} style={l > 0 ? styles.lineGap : null}>
                    <ProseLine line={line} color={color} />
                  </View>
                ),
              )}
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
  lineGap: {
    marginTop: spacing.xs,
  },
  lineBreak: {
    height: spacing.sm,
  },
});
