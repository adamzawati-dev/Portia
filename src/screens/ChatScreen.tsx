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
// free, and maintainVisibleContentPosition holds the reader's place when new
// content lands while they're scrolled up. Content dissolves under the fixed
// header through a true alpha mask (MaskedView). The seam is still
// request/response — src/chat/stream presents the arrived reply as a token
// stream. This screen renders exactly what arrives and computes nothing.
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
import { glass, gradients, palette, radius, spacing } from '../../theme/dusk';
import { haptic } from '../../theme/haptics';
import { Background } from '../components/Background';
import { AppText } from '../components/AppText';
import { MessageRow, StreamingRow, ThinkingSteps } from '../components/MessageRow';
import { Composer } from '../components/Composer';
import { Glass } from '../components/Glass';
import { Press } from '../components/Press';
import { ChatSkeleton } from '../components/Skeleton';
import { TAB_BAR_SPACE } from '../components/TabBar';
import { Message } from '../chat/types';
import { streamText, StreamHandle } from '../chat/stream';
import { useMotion } from '../hooks/useMotion';
import { api } from '../api/client';

let nextId = 0;
const uid = () => `m${Date.now()}-${nextId++}`;

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

type Pending = { phase: 'waiting' | 'streaming'; text: string };

/** Splice a reply in directly after the user turn that triggered it. */
function insertAfterAnchor(prev: Message[] | null, anchorId: string, incoming: Message[]): Message[] {
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
  const streamHandle = useRef<StreamHandle | null>(null);
  const canceled = useRef(false);
  const sentAt = useRef(0);
  const firstTokenSeen = useRef(false);
  const alive = useRef(true);
  const seedTries = useRef(0);
  // Sends made while a reply is in flight, dispatched in order afterwards.
  const sendQueue = useRef<string[]>([]);

  const loadHistory = useCallback(() => {
    setHistoryFailed(false);
    api
      .getChatHistory()
      .then((h) => {
        if (!alive.current) return;
        // The contract's page is newest-first; the thread renders oldest-first.
        const ordered = [...h.messages].sort(
          (a, b) => Date.parse(a.createdAt ?? '') - Date.parse(b.createdAt ?? ''),
        );
        setMessages(ordered);
        // Just after the reveal, Portia's opening line may still be writing
        // (POST /diagnostic/continue is fire-and-forget) -- an empty thread
        // re-checks briefly so the seed is collected, not missed.
        if (ordered.length === 0 && seedTries.current++ < 3) {
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
    };
  }, [loadHistory]);

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

  const dispatchRef = useRef<(text: string) => void>(() => {});
  const dispatch = useCallback(
    (text: string) => {
      const anchorId = uid();
      setMessages((prev) => [
        ...(prev ?? []),
        { id: anchorId, sender: 'user', text, createdAt: new Date().toISOString() },
      ]);
      setPending({ phase: 'waiting', text: '' });
      canceled.current = false;
      firstTokenSeen.current = false;
      sentAt.current = Date.now();

      api
        .sendChat(text)
        .then((reply) => {
          if (canceled.current) return;
          // Some seams echo the user's turn back; the optimistic copy already
          // renders it — drop the echo so it can't land below the answer.
          const incoming = reply.messages.filter(
            (m) => !(m.sender === 'user' && m.text === text),
          );
          const full = incoming.map((m) => m.text).join('\n\n');
          streamHandle.current = streamText(full, {
            instant: reduced,
            onChunk: (soFar) => {
              if (!firstTokenSeen.current) {
                firstTokenSeen.current = true;
                console.log(`[chat] first token in ${Date.now() - sentAt.current}ms`);
              }
              setPending({ phase: 'streaming', text: soFar });
            },
            onDone: () => {
              streamHandle.current = null;
              setPending(null);
              setMessages((prev) => insertAfterAnchor(prev, anchorId, incoming));
              haptic.success();
              const next = sendQueue.current.shift();
              if (next) dispatchRef.current(next);
            },
          });
        })
        .catch(() => {
          if (canceled.current) return;
          setPending(null);
          sendQueue.current = []; // don't fire follow-ups into a dead connection
          // Mark the exact failed turn; Retry lives on the row.
          setMessages((prev) =>
            (prev ?? []).map((m) => (m.id === anchorId ? { ...m, failed: true } : m)),
          );
        });
    },
    [reduced],
  );
  dispatchRef.current = dispatch;

  const handleSend = useCallback(
    (text: string) => {
      if (pendingRef.current) {
        sendQueue.current.push(text); // strict order: dispatched after this reply
        return;
      }
      dispatch(text);
    },
    [dispatch],
  );

  const handleStop = useCallback(() => {
    canceled.current = true;
    streamHandle.current?.cancel();
    streamHandle.current = null;
    sendQueue.current = [];
    const p = pendingRef.current;
    setPending(null);
    // Keep what was already on screen — a stop is a stop, not an undo.
    if (p?.phase === 'streaming' && p.text.length > 0) {
      setMessages((prev) => [
        ...(prev ?? []),
        { id: uid(), sender: 'portia', text: p.text, createdAt: new Date().toISOString() },
      ]);
    }
  }, []);

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
      <ThinkingSteps />
    ) : (
      <StreamingRow text={pending.text} caretOn={caretOn} />
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
                    hitSlop={8}
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
                contentContainerStyle={[
                  styles.list,
                  // Inverted: paddingBottom is the visual TOP — clear the
                  // header and its dissolve tail.
                  { paddingBottom: headerH + gradients.headerFade.tail + spacing.md },
                ]}
                maintainVisibleContentPosition={{
                  minIndexForVisible: 0,
                  autoscrollToTopThreshold: NEAR_BOTTOM_PX,
                }}
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
  historyError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  chip: {
    backgroundColor: glass.tintFrom,
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
