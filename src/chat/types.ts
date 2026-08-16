// src/chat/types.ts
export type Sender = 'portia' | 'user';

export type Message = {
  id: string;
  sender: Sender;
  text: string;
  /** Local-only: this user message never reached the backend (shows inline Retry). */
  failed?: boolean;
};
