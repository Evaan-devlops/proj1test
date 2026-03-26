// src/features/chat/api/chatApi.ts
import { request, requestStream } from "../../../lib/http/client";
import type {
  AccountListResponse,
  ChatStreamRequest,
  CreateChatRequest,
  CreateChatResponse,
  DeleteChatResponse,
  HealthResponse,
  InlineCompletionRequest,
  InlineCompletionResponse,
  ListChatsResponse,
  ListMessagesResponse,
  RenameChatRequest,
  RenameChatResponse,
  RerunStreamRequest,
} from "./types";

export const chatApi = {
  health() {
    return request<HealthResponse>("/api/health", { method: "GET" });
  },

  listAccounts() {
    return request<AccountListResponse>("/api/v1/aws/accounts", { method: "GET" });
  },

  createChat(body: CreateChatRequest = {}) {
    return request<CreateChatResponse>("/api/v1/chats", {
      method: "POST",
      body,
    });
  },

  listChats(params: { limit?: number; cursor?: string } = {}) {
    const qs = new URLSearchParams();
    if (params.limit) qs.set("limit", String(params.limit));
    if (params.cursor) qs.set("cursor", params.cursor);
    const path = "/api/v1/chats";
    const url = qs.toString() ? `${path}?${qs.toString()}` : path;
    return request<ListChatsResponse>(url, { method: "GET" });
  },

  renameChat(chatId: string, body: RenameChatRequest) {
    return request<RenameChatResponse>(`/api/v1/chats/${chatId}`, {
      method: "PATCH",
      body,
    });
  },

  deleteChat(chatId: string) {
    return request<DeleteChatResponse>(`/api/v1/chats/${chatId}`, {
      method: "DELETE",
    });
  },

  listMessages(chatId: string, params: { limit?: number; cursor?: string } = {}) {
    const qs = new URLSearchParams();
    if (params.limit) qs.set("limit", String(params.limit));
    if (params.cursor) qs.set("cursor", params.cursor);
    const path = `/api/v1/chats/${chatId}/messages`;
    const url = qs.toString() ? `${path}?${qs.toString()}` : path;
    return request<ListMessagesResponse>(url, { method: "GET" });
  },

  streamChat(chatId: string, body: ChatStreamRequest) {
    return requestStream(`/api/v1/chats/${chatId}/stream`, {
      method: "POST",
      body,
      mode: "auto",
      idleTimeoutMs: 30_000,
      headers: {
        Accept: "text/event-stream",
      },
    });
  },

  rerunStream(chatId: string, userMessageId: string, body: RerunStreamRequest) {
    return requestStream(`/api/v1/chats/${chatId}/messages/${userMessageId}/rerun/stream`, {
      method: "POST",
      body,
      mode: "auto",
      idleTimeoutMs: 30_000,
      headers: {
        Accept: "text/event-stream",
      },
    });
  },

  inlineCompletion(body: InlineCompletionRequest) {
    return request<InlineCompletionResponse>("/api/completions/inline", {
      method: "POST",
      body,
    });
  },
};

export type { StreamEvent } from "./types";
