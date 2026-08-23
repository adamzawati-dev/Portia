// src/screens/ChatScreen.tsx
// The chat surface. Full-width assistant prose marked by an apricot rule (key
// figure lifted hero-size), compact user chips, a keyboard-flush glass
// composer, and a streaming-shaped reply pipeline: honest thinking-status
// lines before the first token, tokens appending into a stable footer row
// with a blinking caret, Stop in the composer, and auto-follow that yields to
// the reader (a "Latest" pill appears once they scroll up). The seam is still
// request/response — src/chat/stream presents the arrived reply as a token
// stream, so this screen is already wired for the real streaming seam. It
// renders exactly what arrives and computes nothing.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  ListRenderItem,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  StyleSheet,
  View,
} from 'react-native';
import { SymbolView } from 'expo-symbols';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { glass, palette, radius, spacing } from '../../theme/dusk';
import { haptic } from '../../theme/haptics';
import { Background } from '../components/Background';
import { AppText } from '../components/AppText';
import { MessageRow, StreamingRow, ThinkingSteps } from '../components/MessageRow';
import { Composer } from '../components/Composer';
import { Glass } from '../components/Glass';
import { Press } from '../components/Press';
import { ChatSkeleton } from '../components/Skeleton';
import { Message } from '../chat/types';
import { streamText, StreamHandle } from '../chat/stream';
import { useMotion } from '../hooks/useMotion';
import { api } from '../api/client';

let nextId = 0;
const uid = () => `m${Date.now()}-${nextId++}`;

// Within this distance of the bottom the thread auto-follows new tokens.
const NEAR_BOTTOM_PX = 80;
const CARET_BLINK_MS = 530;

// The empty thread's invitation to act — three on-voice openers, tap to send.
const SUGGESTED_PROMPTS = [
  'What did I spend this week?',
  'Any subscriptions I should know about?',
  "How's this month tracking against last?",
];

type Pending = { phase: 'waiting' | 'streaming'; text: string };

export function ChatScreen() {
  const insets = useSafeAreaInsets();
  const { reduced } = useMotion();
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

  const handleSend = useCallback(
    (text: string) => {
      if (pendingRef.current) return;
      setMessages((prev) => [...(prev ?? []), { id: uid(), sender: 'user', text }]);
      setPending({ phase: 'waiting', text: '' });
      canceled.current = false;
      firstTokenSeen.current = false;
      sentAt.current = Date.now();

      api
        .sendChat(text)
        .then((reply) => {
          if (canceled.current) return;
          const full = reply.messages.map((m) => m.text).join('\n\n');
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
              setMessages((prev) => [...(prev ?? []), ...reply.messages]);
              haptic.success();
            },
          });
        })
        .catch(() => {
          if (canceled.current) return;
          setPending(null);
          // Mark the just-sent user turn failed; Retry lives on the row.
          setMessages((prev) => {
            const arr = [...(prev ?? [])];
            for (let i = arr.length - 1; i >= 0; i--) {
              if (arr[i].sender === 'user') {
                arr[i] = { ...arr[i], failed: true };
                break;
              }
            }
            return arr;
          });
        });
    },
    [reduced],
  );

  const handleStop = useCallback(() => {
    canceled.current = true;
    streamHandle.current?.cancel();
    streamHandle.current = null;
    const p = pendingRef.current;
    setPending(null);
    // Keep what was already on screen — a stop is a stop, not an undo.
    if (p?.phase === 'streaming' && p.text.length > 0) {
      setMessages((prev) => [...(prev ?? []), { id: uid(), sender: 'portia', text: p.text }]);
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
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const distance = contentSize.height - contentOffset.y - layoutMeasurement.height;
    nearBottom.current = distance < NEAR_BOTTOM_PX;
    if (nearBottom.current) setShowPill(false);
  }, []);

  // Fires whenever the thread grows (new turn, each stream chunk): follow if
  // the reader is at the bottom, otherwise offer the pill instead of yanking.
  const onContentSizeChange = useCallback(() => {
    if (nearBottom.current) {
      listRef.current?.scrollToEnd({ animated: false });
    } else {
      setShowPill(true);
    }
  }, []);

  const jumpToLatest = useCallback(() => {
    listRef.current?.scrollToEnd({ animated: true });
    setShowPill(false);
  }, []);

  const renderItem: ListRenderItem<Message> = useCallback(
    ({ item }) => <MessageRow message={item} onRetry={handleRetry} />,
    [handleRetry],
  );

  const footer = pending ? (
    pending.phase === 'waiting' ? (
      <ThinkingSteps />
    ) : (
      <StreamingRow text={pending.text} caretOn={caretOn} />
    )
  ) : null;

  const emptyThread = messages != null && messages.length === 0 && !pending;

  return (
    <Background>
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <AppText variant="title" color={palette.textPrimary}>
            Portia
          </AppText>
          {/* Right corner is owned by the account gear (see MainTabs). */}
        </View>

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.flex}>
            {messages === null ? (
              <ChatSkeleton />
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
                {SUGGESTED_PROMPTS.map((prompt) => (
                  <Press
                    key={prompt}
                    onPress={() => handleSend(prompt)}
                    accessibilityRole="button"
                    accessibilityLabel={`Ask: ${prompt}`}
                    style={styles.chip}
                  >
                    <AppText variant="body" color={palette.textSecondary}>
                      {prompt}
                    </AppText>
                  </Press>
                ))}
              </View>
            ) : (
              <FlatList
                ref={listRef}
                data={messages}
                keyExtractor={(m) => m.id}
                renderItem={renderItem}
                ListFooterComponent={footer}
                contentContainerStyle={styles.list}
                keyboardDismissMode="interactive"
                onScroll={onScroll}
                scrollEventThrottle={32}
                onContentSizeChange={onContentSizeChange}
              />
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

          {/* The tab bar (or, while typing, the keyboard) owns the bottom inset. */}
          <View style={{ paddingBottom: spacing.sm }}>
            <Composer onSend={handleSend} streaming={pending != null} onStop={handleStop} />
          </View>
        </KeyboardAvoidingView>
      </View>
    </Background>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  list: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
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
