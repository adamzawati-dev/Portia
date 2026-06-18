// src/screens/ChatScreen.tsx
// The chat surface — UI only, no backend. Conversation of distinct glass bubbles
// (each its own GlassSurface), a keyboard-respecting glass composer, and a MOCK
// responder that appends canned, on-voice Portia replies (see chat/mockResponder —
// swap it for the real API later). Seeded with example messages in Portia's voice.
import React, { useCallback, useRef, useState } from 'react';
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
import { SEED_MESSAGES } from '../chat/seed';
import { getMockReply } from '../chat/mockResponder';

const TYPING_ITEM: Message = { id: '__typing__', sender: 'portia', text: '' };
const MOCK_REPLY_DELAY = 700; // MOCK only — feels like a reply landing.

let nextId = 0;
const uid = () => `m${Date.now()}-${nextId++}`;

export function ChatScreen() {
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<Message[]>(SEED_MESSAGES);
  const [isTyping, setIsTyping] = useState(false);
  const listRef = useRef<FlatList<Message>>(null);
  const userTurns = useRef(0);

  const handleSend = useCallback((text: string) => {
    setMessages((prev) => [...prev, { id: uid(), sender: 'user', text }]);
    setIsTyping(true);
    const turn = userTurns.current++;
    // MOCK: a real implementation awaits the Portia API here.
    setTimeout(() => {
      setIsTyping(false);
      setMessages((prev) => [...prev, { id: uid(), sender: 'portia', text: getMockReply(turn) }]);
    }, MOCK_REPLY_DELAY);
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
            Demo · canned replies
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
