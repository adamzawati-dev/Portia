// src/screens/ChatScreen.tsx
// The chat surface. UI is unchanged — distinct glass bubbles, a keyboard-respecting
// glass composer — but it now talks to the backend through `api` (src/api/client).
// History loads on mount; sends await Portia's reply. Whether that's the live seam
// or the in-process mock is decided by USE_MOCK in src/api/config; this screen
// neither knows nor cares. It renders exactly what arrives and computes nothing.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  ListRenderItem,
  Platform,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { palette, spacing } from '../../theme/dusk';
import { Background } from '../components/Background';
import { AppText } from '../components/AppText';
import { MessageBubble, TypingBubble } from '../components/MessageBubble';
import { Composer } from '../components/Composer';
import { Message } from '../chat/types';
import { api, ApiError } from '../api/client';

const TYPING_ITEM: Message = { id: '__typing__', sender: 'portia', text: '' };

let nextId = 0;
const uid = () => `m${Date.now()}-${nextId++}`;

export function ChatScreen() {
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const listRef = useRef<FlatList<Message>>(null);

  useEffect(() => {
    let active = true;
    api
      .getChatHistory()
      .then((h) => active && setMessages(h.messages))
      .catch(() => active && setMessages([]));
    return () => {
      active = false;
    };
  }, []);

  const handleSend = useCallback((text: string) => {
    setMessages((prev) => [...prev, { id: uid(), sender: 'user', text }]);
    setIsTyping(true);
    api
      .sendChat(text)
      .then((reply) => setMessages((prev) => [...prev, ...reply.messages]))
      .catch((err) => {
        // Errors don't apologize and aren't vague — say what to do next.
        const line =
          err instanceof ApiError
            ? err.message
            : "I couldn't reach your data just now. Check your connection and try again.";
        setMessages((prev) => [...prev, { id: uid(), sender: 'portia', text: line }]);
      })
      .finally(() => setIsTyping(false));
  }, []);

  const renderItem: ListRenderItem<Message> = useCallback(
    ({ item }) => (item.id === TYPING_ITEM.id ? <TypingBubble /> : <MessageBubble message={item} />),
    [],
  );

  const data = isTyping ? [...messages, TYPING_ITEM] : messages;

  return (
    <Background>
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <AppText variant="title" color={palette.textPrimary}>
            Portia
          </AppText>
          <AppText variant="caption" color={palette.textTertiary}>
            Mock backend
          </AppText>
        </View>

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <FlatList
            ref={listRef}
            data={data}
            keyExtractor={(m) => m.id}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
            keyboardDismissMode="interactive"
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          />
          <View style={{ paddingBottom: Math.max(insets.bottom, spacing.sm) }}>
            <Composer onSend={handleSend} />
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
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
});
