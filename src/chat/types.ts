// src/chat/types.ts
export type Sender = 'portia' | 'user';

export type Message = {
  id: string;
  sender: Sender;
  text: string;
  /** Server timestamp (ChatMessage) or local send time — total ordering key. */
  createdAt?: string;
  /** Local-only: this user message never got its reply (shows inline Retry). */
  failed?: boolean;
  /** Local-only: why, in the backend's own voice when it said so. */
  failure?: string;
};
