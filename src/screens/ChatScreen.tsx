// src/screens/ChatScreen.tsx
// The chat surface. Full-width assistant prose marked by an apricot rule (key
// figure lifted hero-size), compact user chips, and a composer that rides the
// keyboard frame-by-frame (react-native-keyboard-controller on the UI thread).
//
// Ordering is strict: a user turn always sits directly above the reply it
// triggered. Optimistic user turns are stamped with a local createdAt; replies
// are spliced in AFTER their anchoring user message (not appended blind), any
// server echo of the user's own turn is dropped, and sends fired while a reply
// is in flight queue and dispatch in order once it completes.
//
// The thread is an inverted FlatList: offset 0 is the newest message, so the
// keyboard shrinking the list keeps the latest turns pinned and visible for
// free. No maintainVisibleContentPosition (see the list props for why —
// Fabric overlap bug); scrolled-up readers get the Latest pill. Content
// dissolves under the fixed header through a true alpha mask (MaskedView).
// The seam is the SSE variant of POST /chat (real step labels while Portia
// works, see src/chat/stream) with the JSON POST as fallback; the arrived reply
// is presented as a token stream. This screen renders exactly what arrives and
// computes nothing.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  ListRenderItem,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleSheet,
  View,
} from 'react-native';
import { SymbolView } from 'expo-symbols';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
import Animated, {
  FadeInUp,
  interpolate,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { glass, gradients, palette, radius, spacing, surface } from '../../theme/dusk';
import { haptic } from '../../theme/haptics';
import { Background } from '../components/Background';
import { AppText } from '../components/AppText';
import { MessageRow, StreamingRow, ThinkingSteps } from '../components/MessageRow';
import { Composer } from '../components/Composer';
import { Glass } from '../components/Glass';
import { Press } from '../components/Press';
import { ChatSkeleton, Skeleton } from '../components/Skeleton';
import { TAB_BAR_SPACE } from '../components/TabBar';
import { Message } from '../chat/types';
import { CHAT_STREAMING, streamText, StreamHandle } from '../chat/stream';
import { HeroFigure, extractHero } from '../chat/markdown';
import { useMotion } from '../hooks/useMotion';
import { api, ApiError, StreamUnavailableError } from '../api/client';
import type { ChatReply, ChatStreamDone } from '../api/client';

let nextId = 0;
const uid = () => `m${Date.now()}-${nextId++}`;
// Local (optimistic/failed) rows carry the `m<ts>-n` id shape; server rows carry
// their persisted ids. The shape is how a history merge tells them apart.
const LOCAL_ID = /^m\d+-\d+$/;
const isLocalId = (id: string) => LOCAL_ID.test(id);

/** Merge a server history page over the thread: the page is authoritative for
 *  every persisted row, and local rows (optimistic, queued, failed) that the
 *  server hasn't acknowledged by id stay put below it — a refetch never wipes a
 *  turn that is still in flight. */
function mergeHistory(prev: Message[] | null, page: Message[]): Message[] {
  const serverIds = new Set(page.map((m) => m.id));
  const local = (prev ?? []).filter((m) => isLocalId(m.id) && !serverIds.has(m.id));
  return [...page, ...local];
}

// Inverted list: offset 0 is the newest message ("the bottom").
const NEAR_BOTTOM_PX = 80;
const CARET_BLINK_MS = 530;
// Fixed header: title block height below the status bar; content scrolls under
// it and dissolves through the alpha-mask tail.
const TITLE_H = 36;

// The empty thread's invitation to act — three on-voice openers, tap to send.
const SUGGESTED_PROMPTS = [
  'What did I spend this week?',
  'Any subscriptions I should know about?',
  "How's this month tracking against last?",
];

// `steps` are the server's own progress labels for this turn, in order.
// `hero` is decided once from the complete reply before the reveal starts.
type Pending = {
  phase: 'waiting' | 'streaming';
  text: string;
  steps: string[];
  hero: HeroFigure | null;
};

/** A history page in conversation order (oldest first). The page's ORDER is
 *  the truth about the conversation — never re-sort individual messages by
 *  createdAt: a user turn and its reply are often persisted together with
 *  identical timestamps, and a timestamp sort then leaves the newest-first
 *  adjacency intact (reply above question — the reload-ordering bug). Instead,
 *  detect the page's orientation from the first strict timestamp inequality
 *  and reverse it wholesale, so server adjacency is preserved exactly. (The
 *  contract serves newest-first; the mock serves oldest-first — both land.) */
function orientPage(messages: Message[]): Message[] {
  const page = [...messages];
  let orientation = 0; // -1 = newest-first, 1 = oldest-first
  for (let i = 1; i < page.length && orientation === 0; i++) {
    const prev = Date.parse(page[i - 1].createdAt ?? '');
    const cur = Date.parse(page[i].createdAt ?? '');
    if (prev !== cur) orientation = prev > cur ? -1 : 1;
  }
  // Undecidable (0 or 1 message, or all-equal stamps): assume the contract's
  // newest-first.
  if (orientation !== 1) page.reverse();
  return page;
}

/** Splice a reply in directly after the user turn that triggered it. */
function insertAfterAnchor(
  prev: Message[] | null,
  anchorId: string | null,
  incoming: Message[],
): Message[] {
  const arr = [...(prev ?? [])];
  const i = arr.findIndex((m) => m.id === anchorId);
  arr.splice(i >= 0 ? i + 1 : arr.length, 0, ...incoming);
  return arr;
}

export function ChatScreen() {
  const insets = useSafeAreaInsets();
  const { reduced, durations, cardStagger } = useMotion();
  const headerH = insets.top + TITLE_H;

  // null = the first history fetch hasn't resolved -> the thread-shaped skeleton.
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [showPill, setShowPill] = useState(false);
  const [caretOn, setCaretOn] = useState(true);

  // History load failed: an empty thread with this set is an ERROR state, not
  // "no history yet" — it renders an inline error line + Retry above the chips.
  const [historyFailed, setHistoryFailed] = useState(false);

  const listRef = useRef<FlatList<Message>>(null);
  const nearBottom = useRef(true);
  const pendingRef = useRef<Pending | null>(null);
  pendingRef.current = pending;
  const messagesRef = useRef<Message[] | null>(null);
  messagesRef.current = messages;
  const streamHandle = useRef<StreamHandle | null>(null);
  // Aborts the in-flight SSE request on Stop / unmount.
  const abortRef = useRef<AbortController | null>(null);
  const sentAt = useRef(0);
  const firstTokenSeen = useRef(false);
  const alive = useRef(true);
  const seedTries = useRef(0);
  // Older history: the server's opaque cursor for the page before the oldest
  // one loaded (undefined = nothing older), and the in-flight guard.
  const nextCursor = useRef<string | undefined>(undefined);
  const loadingOlderRef = useRef(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  // Sends made while a reply is in flight (already rendered as user rows),
  // dispatched in order afterwards.
  const sendQueue = useRef<{ id: string; text: string }[]>([]);

  const loadHistory = useCallback(() => {
    setHistoryFailed(false);
    api
      .getChatHistory()
      .then((h) => {
        if (!alive.current) return;
        const page = orientPage(h.messages);
        nextCursor.current = h.nextCursor;
        const hasLocalRows = (messagesRef.current ?? []).some((m) => isLocalId(m.id));
        setMessages((prev) => mergeHistory(prev, page));
        // Just after the reveal, Portia's opening line may still be writing
        // (POST /diagnostic/continue is fire-and-forget) -- an empty thread
        // re-checks briefly so the seed is collected, not missed. Not while a
        // send is pending or a local row exists: the user has already started
        // the conversation, and the seed only lands on an empty thread anyway.
        if (
          page.length === 0 &&
          !pendingRef.current &&
          !hasLocalRows &&
          seedTries.current++ < 3
        ) {
          setTimeout(() => alive.current && loadHistory(), 1500);
        }
      })
      .catch(() => {
        if (!alive.current) return;
        setMessages([]);
        setHistoryFailed(true);
      });
  }, []);

  useEffect(() => {
    alive.current = true;
    loadHistory();
    return () => {
      alive.current = false;
      streamHandle.current?.cancel();
      abortRef.current?.abort();
    };
  }, [loadHistory]);

  // Scrolling toward the top of the inverted list reaches the oldest loaded
  // row: fetch the page before it and prepend, in server order, skipping any
  // row already on screen. A failed page keeps its cursor so the next reach
  // simply tries again.
  const loadOlder = useCallback(() => {
    const cursor = nextCursor.current;
    if (!cursor || loadingOlderRef.current) return;
    loadingOlderRef.current = true;
    setLoadingOlder(true);
    api
      .getChatHistory(cursor)
      .then((h) => {
        if (!alive.current) return;
        nextCursor.current = h.nextCursor;
        const older = orientPage(h.messages);
        setMessages((prev) => {
          const seen = new Set((prev ?? []).map((m) => m.id));
          return [...older.filter((m) => !seen.has(m.id)), ...(prev ?? [])];
        });
      })
      .catch(() => {})
      .finally(() => {
        loadingOlderRef.current = false;
        if (alive.current) setLoadingOlder(false);
      });
  }, []);

  const retryHistory = useCallback(() => {
    setMessages(null); // back to the thread skeleton while the retry runs
    loadHistory();
  }, [loadHistory]);

  // Caret blink while streaming (steady under Reduce Motion).
  const streamingNow = pending?.phase === 'streaming';
  useEffect(() => {
    if (!streamingNow || reduced) {
      setCaretOn(true);
      return;
    }
    const t = setInterval(() => setCaretOn((c) => !c), CARET_BLINK_MS);
    return () => clearInterval(t);
  }, [streamingNow, reduced]);

  // Per-dispatch generation. Each send bumps it and captures its own value; a
  // reply, chunk or failure lands only while its generation is still current,
  // so Stop (which bumps it) truly ends a turn and a later send can never
  // revive an earlier one. A shared boolean could: the next send reset it.
  const dispatchGen = useRef(0);
  // The optimistic row of the turn in flight -- what a stopped partial reply
  // splices in after.
  const activeAnchor = useRef<string | null>(null);

  const appendUserRow = useCallback((text: string): string => {
    const id = uid();
    setMessages((prev) => [
      ...(prev ?? []),
      { id, sender: 'user', text, createdAt: new Date().toISOString() },
    ]);
    return id;
  }, []);

  // Follow-ups queued behind a turn that failed or was stopped never went out:
  // they fail visibly (Retry on the row) rather than vanishing.
  const failQueued = useCallback(() => {
    const ids = new Set(sendQueue.current.map((q) => q.id));
    sendQueue.current = [];
    if (ids.size === 0) return;
    setMessages((prev) => (prev ?? []).map((m) => (ids.has(m.id) ? { ...m, failed: true } : m)));
  }, []);

  const dispatchRef = useRef<(text: string, anchorId: string) => void>(() => {});
  const dispatch = useCallback(
    (text: string, anchorId: string) => {
      const gen = ++dispatchGen.current;
      const current = () => gen === dispatchGen.current;
      activeAnchor.current = anchorId;
      const controller = new AbortController();
      abortRef.current = controller;
      const waiting: Pending = { phase: 'waiting', text: '', steps: [], hero: null };
      pendingRef.current = waiting; // eager: a send in the same tick must queue
      setPending(waiting);
      firstTokenSeen.current = false;
      sentAt.current = Date.now();

      const viaJson = (): Promise<ChatReply> => api.sendChat(text);
      // The SSE seam: the server's step labels as each tool starts, chunk text
      // concatenated in order, the persisted reply on done. Chunks are held
      // until done so the presenter reveals one complete, audited reply. Falls
      // back to the JSON path only when no response arrived at all (then no
      // turn was started server-side, so resending is safe).
      const viaStream = (): Promise<ChatReply> => {
        let chunks = '';
        const result: { done?: ChatStreamDone } = {};
        return api
          .streamChat(
            text,
            {
              onStep: (label) => {
                if (!current()) return;
                setPending((p) => ({
                  phase: 'waiting',
                  text: '',
                  steps: [...(p?.steps ?? []), label],
                  hero: null,
                }));
              },
              onChunk: (piece) => {
                chunks += piece;
              },
              onDone: (done) => {
                result.done = done;
              },
            },
            controller.signal,
          )
          .then((): ChatReply => {
            if (!result.done) throw new Error('stream ended without done');
            const { message, userMessageId } = result.done;
            return { messages: [{ ...message, text: chunks || message.text }], userMessageId };
          })
          .catch((e: unknown) => {
            if (e instanceof StreamUnavailableError && current()) return viaJson();
            throw e;
          });
      };

      (CHAT_STREAMING ? viaStream() : viaJson())
        .then((reply) => {
          if (!current()) return;
          // Some seams echo the user's turn back; the optimistic copy already
          // renders it — drop the echo so it can't land below the answer.
          const incoming = reply.messages.filter(
            (m) => !(m.sender === 'user' && m.text === text),
          );
          const full = incoming.map((m) => m.text).join('\n\n');
          // The callout is decided from the whole reply, once — never from a
          // partial reveal frame.
          const hero = extractHero(full);
          streamHandle.current = streamText(full, {
            instant: reduced,
            onChunk: (soFar) => {
              if (!current()) return;
              if (!firstTokenSeen.current) {
                firstTokenSeen.current = true;
                console.log(`[chat] first token in ${Date.now() - sentAt.current}ms`);
              }
              setPending({ phase: 'streaming', text: soFar, steps: [], hero });
            },
            onDone: () => {
              if (!current()) return;
              streamHandle.current = null;
              activeAnchor.current = null;
              setPending(null);
              // Reconcile the optimistic user row with its persisted id, so a
              // later history merge dedupes it by id instead of duplicating it.
              const userId = reply.userMessageId;
              setMessages((prev) => {
                let rows = prev ?? [];
                if (userId) {
                  rows = rows.some((m) => m.id === userId)
                    ? rows.filter((m) => m.id !== anchorId)
                    : rows.map((m) => (m.id === anchorId ? { ...m, id: userId } : m));
                }
                const fresh = incoming.filter((m) => !rows.some((r) => r.id === m.id));
                return insertAfterAnchor(rows, userId ?? anchorId, fresh);
              });
              haptic.success();
              const next = sendQueue.current.shift();
              if (next) dispatchRef.current(next.text, next.id);
            },
          });
        })
        .catch((e: unknown) => {
          if (!current()) return;
          activeAnchor.current = null;
          setPending(null);
          // Mark the exact failed turn; Retry lives on the row, with the
          // backend's own words when it said why.
          const failure = e instanceof ApiError ? e.message : undefined;
          setMessages((prev) =>
            (prev ?? []).map((m) => (m.id === anchorId ? { ...m, failed: true, failure } : m)),
          );
          failQueued(); // don't fire follow-ups into a dead connection
        });
    },
    [reduced, failQueued],
  );
  dispatchRef.current = dispatch;

  const handleSend = useCallback(
    (text: string) => {
      // The user's own turn shows immediately, whether it goes out now or queues.
      const id = appendUserRow(text);
      // A user's own send is the one case where the list may move under them:
      // bring the new turn into view instead of leaving it behind the pill.
      nearBottom.current = true;
      setShowPill(false);
      listRef.current?.scrollToOffset({ offset: 0, animated: true });
      if (pendingRef.current) {
        sendQueue.current.push({ id, text }); // strict order: dispatched after this reply
        return;
      }
      dispatch(text, id);
    },
    [appendUserRow, dispatch],
  );

  const handleStop = useCallback(() => {
    // Client-side stop: the server finishes and persists the turn regardless
    // (it serializes per user), so the full reply can surface on a later
    // history load. Here it can no longer land anything.
    dispatchGen.current++;
    abortRef.current?.abort();
    abortRef.current = null;
    streamHandle.current?.cancel();
    streamHandle.current = null;
    const p = pendingRef.current;
    const anchorId = activeAnchor.current;
    activeAnchor.current = null;
    setPending(null);
    // Keep what was already on screen — a stop is a stop, not an undo.
    if (p?.phase === 'streaming' && p.text.length > 0) {
      const partial: Message = {
        id: uid(),
        sender: 'portia',
        text: p.text,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => insertAfterAnchor(prev, anchorId, [partial]));
    }
    failQueued();
  }, [failQueued]);

  const handleRetry = useCallback(
    (failed: Message) => {
      setMessages((prev) => (prev ?? []).filter((m) => m.id !== failed.id));
      handleSend(failed.text);
    },
    [handleSend],
  );

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    // Inverted: offset 0 IS the newest message.
    nearBottom.current = e.nativeEvent.contentOffset.y < NEAR_BOTTOM_PX;
    if (nearBottom.current) setShowPill(false);
  }, []);

  // Content grew while the reader was scrolled up: offer the pill, never yank.
  const onContentSizeChange = useCallback(() => {
    if (!nearBottom.current) setShowPill(true);
  }, []);

  const jumpToLatest = useCallback(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
    setShowPill(false);
  }, []);

  const renderItem: ListRenderItem<Message> = useCallback(
    ({ item }) => <MessageRow message={item} onRetry={handleRetry} />,
    [handleRetry],
  );

  // Inverted data: newest first.
  const inverted = useMemo(() => (messages ? [...messages].reverse() : []), [messages]);

  const footer = pending ? (
    pending.phase === 'waiting' ? (
      <ThinkingSteps steps={pending.steps} />
    ) : (
      <StreamingRow text={pending.text} caretOn={caretOn} hero={pending.hero} />
    )
  ) : null;

  const emptyThread = messages != null && messages.length === 0 && !pending;

  // Keyboard: the spacer grows frame-by-frame with the keyboard (UI thread),
  // shrinking the thread; the composer's bottom inset melts from the tab-bar
  // zone to flush as the keyboard rises.
  const { height: kbHeight, progress: kbProgress } = useReanimatedKeyboardAnimation();
  const tabZone = insets.bottom + TAB_BAR_SPACE;
  const composerInset = useAnimatedStyle(() => ({
    paddingBottom: interpolate(kbProgress.value, [0, 1], [tabZone, spacing.sm]),
  }));
  const kbSpacer = useAnimatedStyle(() => ({ height: Math.max(0, -kbHeight.value) }));

  const maskElement = (
    <View style={styles.flex}>
      <LinearGradient
        colors={gradients.headerFade.mask}
        locations={[0, headerH / (headerH + gradients.headerFade.tail), 1]}
        style={{ height: headerH + gradients.headerFade.tail }}
      />
      <View style={[styles.flex, styles.maskSolid]} />
    </View>
  );

  return (
    <Background>
      <View style={styles.root}>
        <View style={styles.flex}>
          {messages === null ? (
            <View style={{ paddingTop: headerH + spacing.md }}>
              <ChatSkeleton />
            </View>
          ) : emptyThread ? (
            <View style={styles.emptyWrap}>
              {historyFailed ? (
                <View style={styles.historyError}>
                  <AppText variant="caption" color={palette.attention}>
                    Couldn't load our conversation.
                  </AppText>
                  <Press
                    onPress={retryHistory}
                    hitSlop={14}
                    accessibilityRole="button"
                    accessibilityLabel="Retry loading the conversation"
                  >
                    <AppText variant="caption" color={palette.signature}>
                      Retry
                    </AppText>
                  </Press>
                </View>
              ) : null}
              {SUGGESTED_PROMPTS.map((prompt, i) => (
                <Animated.View
                  key={prompt}
                  entering={
                    reduced
                      ? undefined
                      : FadeInUp.duration(durations.fast).delay(150 + i * cardStagger)
                  }
                >
                  <Press
                    onPress={() => handleSend(prompt)}
                    hitSlop={spacing.xs}
                    accessibilityRole="button"
                    accessibilityLabel={`Ask: ${prompt}`}
                    style={styles.chip}
                  >
                    <AppText variant="body" color={palette.textSecondary}>
                      {prompt}
                    </AppText>
                  </Press>
                </Animated.View>
              ))}
            </View>
          ) : (
            <MaskedView style={styles.flex} maskElement={maskElement}>
              <FlatList
                ref={listRef}
                data={inverted}
                inverted
                keyExtractor={(m) => m.id}
                renderItem={renderItem}
                ListHeaderComponent={footer}
                // Inverted: the list's end is the oldest loaded row, and its
                // footer sits at the visual top — a page-shaped placeholder
                // while the older page loads.
                onEndReached={loadOlder}
                onEndReachedThreshold={0.5}
                ListFooterComponent={
                  loadingOlder ? (
                    <View style={styles.olderLoading}>
                      <Skeleton width="100%" height={56} round={radius.card} />
                    </View>
                  ) : null
                }
                contentContainerStyle={[
                  styles.list,
                  // Inverted: paddingBottom is the visual TOP — clear the
                  // header and its dissolve tail.
                  { paddingBottom: headerH + gradients.headerFade.tail + spacing.md },
                ]}
                // Deliberately NO maintainVisibleContentPosition: on the New
                // Architecture, mvcp + inverted + an index-0 insertion in the
                // same frame as the streaming footer collapsing re-anchored
                // against stale cell offsets — the new user row rendered INSIDE
                // the tall assistant row. At offset 0 an inverted list shows
                // new head items natively with no anchor math; scrolled-up
                // readers get the Latest pill instead of a held anchor.
                keyboardDismissMode="interactive"
                onScroll={onScroll}
                scrollEventThrottle={32}
                onContentSizeChange={onContentSizeChange}
                bounces
                indicatorStyle="white"
              />
            </MaskedView>
          )}

          {showPill ? (
            <View style={styles.pillWrap} pointerEvents="box-none">
              <Press
                onPress={jumpToLatest}
                hitSlop={spacing.sm}
                accessibilityRole="button"
                accessibilityLabel="Jump to latest"
              >
                <Glass.Chrome radius={radius.chip} style={styles.pill}>
                  <SymbolView
                    name="arrow.down"
                    size={13}
                    tintColor={palette.textPrimary}
                    weight="semibold"
                  />
                  <AppText variant="caption" color={palette.textPrimary}>
                    Latest
                  </AppText>
                </Glass.Chrome>
              </Press>
            </View>
          ) : null}
        </View>

        <Animated.View style={composerInset}>
          <Composer onSend={handleSend} streaming={pending != null} onStop={handleStop} />
        </Animated.View>
        {/* Grows with the keyboard, frame-by-frame on the UI thread. */}
        <Animated.View style={kbSpacer} />

        {/* Fixed header: soft env scrim under the title + the alpha mask on the
            thread — content dissolves well before it can touch the wordmark. */}
        <View pointerEvents="none" style={[styles.headerOverlay, { height: headerH + spacing.xxl }]}>
          <LinearGradient colors={gradients.headerFade.scrim} style={StyleSheet.absoluteFill} />
          <View style={[styles.header, { paddingTop: insets.top }]}>
            <AppText variant="title" color={palette.textPrimary}>
              Portia
            </AppText>
            {/* Right corner is owned by the account gear (see MainTabs). */}
          </View>
        </View>
      </View>
    </Background>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  maskSolid: {
    backgroundColor: '#000', // mask alpha only; never rendered to screen
  },
  headerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xs,
  },
  list: {
    paddingHorizontal: spacing.xl,
    // Inverted: paddingTop is the visual BOTTOM (above the composer); the
    // visual-top padding is added inline (it depends on the safe-area inset).
    paddingTop: spacing.md,
  },
  emptyWrap: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  olderLoading: {
    marginVertical: spacing.lg,
  },
  historyError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  chip: {
    backgroundColor: surface.userMessage,
    borderRadius: radius.chip,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: glass.border,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  pillWrap: {
    position: 'absolute',
    bottom: spacing.md,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
});
