// src/chat/stream.ts
// Two halves of the chat's streaming shape.
//
// 1. The SSE seam: POST /chat with `Accept: text/event-stream` answers with
//    `step` (real tool progress, rendered verbatim) -> `chunk` (reply text,
//    concatenated in order) -> `done` | `error`. parseSSEFrames splits the
//    wire text on blank-line frame boundaries; the fetch itself lives in
//    src/api/client (it owns the base URL and bearer). CHAT_STREAMING flips
//    the screen between this seam and the plain JSON POST.
// 2. The presenter: streamText reveals a complete reply as a token stream —
//    the same onChunk/onDone contract either seam feeds. It reveals exactly
//    the text the backend returned — pacing is presentation, content is not.

/** Consume the SSE variant of POST /chat. False = the JSON request/response
 *  path only (the fallback contract). */
export const CHAT_STREAMING = true;

/** Per-event idle budget for the stream. A turn is several model calls plus
 *  tool rounds, but the server emits a `step` as each tool starts, so silence
 *  this long means the connection is dead — not that Portia is still working. */
export const CHAT_STREAM_IDLE_MS = 60_000;

export type SSEFrame = { event: string; data: string };

/** Split accumulated SSE text into complete frames (blank-line boundaries).
 *  Returns the parsed frames and the unconsumed remainder to keep buffering.
 *  `event:` names the frame; `data:` lines are joined with newlines; comments
 *  (`:`), `id:` and `retry:` are ignored. A frame without data is skipped. */
export function parseSSEFrames(buffer: string): { frames: SSEFrame[]; rest: string } {
  const normalized = buffer.replace(/\r\n?/g, '\n');
  const parts = normalized.split('\n\n');
  const rest = parts.pop() ?? '';
  const frames: SSEFrame[] = [];
  for (const part of parts) {
    let event = 'message';
    const data: string[] = [];
    for (const line of part.split('\n')) {
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''));
    }
    if (data.length > 0) frames.push({ event, data: data.join('\n') });
  }
  return { frames, rest };
}

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
