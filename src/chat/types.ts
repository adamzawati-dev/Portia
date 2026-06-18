// src/chat/types.ts
export type Sender = 'portia' | 'user';

export type Message = {
  id: string;
  sender: Sender;
  text: string;
};
