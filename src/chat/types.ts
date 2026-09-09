// src/chat/types.ts
export type Sender = 'portia' | 'user';

export type Message = {
  id: string;
  sender: Sender;
  text: string;
  /** Server timestamp (ChatMessage) or local send time — total ordering key. */
  createdAt?: string;
  /** Institutions whose data informed this reply; present only when the turn
   *  read financial data. Absent = nothing to attribute, so nothing renders. */
  sources?: string[];
  /** Local-only: this user message never got its reply (shows inline Retry). */
  failed?: boolean;
  /** Local-only: why, in the backend's own voice when it said so. */
  failure?: string;
};
