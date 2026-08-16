// src/chat/stream.ts
// Presents a complete reply as a token stream. The seam today is
// request/response (POST /chat returns the full text — "backend streaming
// as-is"), so this adapter gives the UI its streaming shape: the same
// onChunk/onDone contract a real SSE seam will feed later, at which point only
// this function's internals change. It reveals exactly the text the backend
// returned — pacing is presentation, content is not.
export type StreamHandle = { cancel: () => void };

const TICK_MS = 24;
const MAX_TICKS = 40; // long replies reveal in bigger steps, capped at ~1s total

export function streamText(
  full: string,
  opts: {
    /** Reveal everything at once (Reduce Motion, or an empty reply). */
    instant?: boolean;
    onChunk: (textSoFar: string) => void;
    onDone: () => void;
  },
): StreamHandle {
  if (opts.instant || full.length === 0) {
    opts.onChunk(full);
    opts.onDone();
    return { cancel: () => {} };
  }

  // Word-boundary tokens (whitespace kept) so mid-word flicker never happens.
  const tokens = full.split(/(\s+)/);
  const perTick = Math.max(1, Math.ceil(tokens.length / MAX_TICKS));
  let i = 0;
  const timer = setInterval(() => {
    i = Math.min(tokens.length, i + perTick);
    opts.onChunk(tokens.slice(0, i).join(''));
    if (i >= tokens.length) {
      clearInterval(timer);
      opts.onDone();
    }
  }, TICK_MS);

  return { cancel: () => clearInterval(timer) };
}
