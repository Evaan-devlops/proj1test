// src/features/chat/api/types.ts

export type ChatSummary = {
  id: string;
  title: string;
  createdAtMs: number;
  updatedAtMs: number;
};

export type ChatMessageDto = {
  id: string;
  chatId: string;
  role: "user" | "assistant";
  text: string;
  createdAtMs: number;
  status?: "final" | "streaming" | "error";
};

export type HealthResponse = {
  ok: true;
  version: string;
  serverTimeMs: number;
};

export type CreateChatRequest = {
  title?: string;
};

export type CreateChatResponse = {
  chat: ChatSummary;
};

export type ListChatsResponse = {
  items: ChatSummary[];
  nextCursor: string | null;
};

export type RenameChatRequest = {
  title: string;
};

export type RenameChatResponse = {
  ok: true;
  chat: ChatSummary;
};

export type DeleteChatResponse = {
  ok: true;
};

export type ListMessagesResponse = {
  items: ChatMessageDto[];
  nextCursor: string | null;
};

export type AwsAccountDto = {
  account_key: string;
  account_id: string;
  region: string;
};

export type AccountListResponse = {
  accounts: AwsAccountDto[];
};

export type ChatStreamRequest = {
  userText: string;
  clientMessageId?: string;
  selectedAccountKeys?: string[];
};

export type RerunStreamRequest = {
  newUserText: string;
  selectedAccountKeys?: string[];
};

export type InlineCompletionRequest = {
  text: string;
  cursor: number;
  maxSuggestions?: number;
  lang?: string;
};

export type InlineCompletionResponse = {
  suggestions: Array<{
    insertText: string;
    displayText: string;
    score?: number;
  }>;
};

export type StreamEvent =
  | { type: "start"; userMessage: ChatMessageDto; assistantMessage: ChatMessageDto }
  | { type: "delta"; messageId: string; text: string }
  | { type: "final"; messageId: string; fullText?: string }
  | { type: "error"; message: string };
