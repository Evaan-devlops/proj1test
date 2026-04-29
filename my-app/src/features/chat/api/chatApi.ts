// src/features/chat/api/chatApi.ts
import { request, requestStream } from "src/lib/http";
import type { ApiError } from "src/lib/http";
import type {
  AccountListResponse,
  AnalyticsHubRefreshResponse,
  AnalyticsHubSnapshotResponse,
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
import {
  isAccountListResponse,
  isAnalyticsHubRefreshResponse,
  isAnalyticsHubSnapshotResponse,
  isCreateChatResponse,
  isDeleteChatResponse,
  isHealthResponse,
  isInlineCompletionResponse,
  isListChatsResponse,
  isListMessagesResponse,
  isRenameChatResponse,
} from "./guards";

type JsonRequestOptions = Parameters<typeof request>[1];
type ValidatedApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiError };

function invalidResponseResult<T>(message: string, details: unknown): ValidatedApiResult<T> {
  return {
    ok: false,
    error: {
      status: 0,
      message,
      details,
    },
  };
}

async function requestValidated<T>(
  url: string,
  options: JsonRequestOptions,
  guard: (value: unknown) => value is T,
  invalidMessage: string,
): Promise<ValidatedApiResult<T>> {
  const result = await request<unknown>(url, options);
  if (!result.ok) return result;
  if (!guard(result.data)) {
    return invalidResponseResult<T>(invalidMessage, result.data);
  }
  return { ok: true, data: result.data };
}

export const chatApi = {
  health() {
    return requestValidated<HealthResponse>(
      "/api/health",
      { method: "GET" },
      isHealthResponse,
      "Health response had an unexpected format.",
    );
  },

  listAccounts() {
    return requestValidated<AccountListResponse>(
      "/api/v1/aws/accounts",
      { method: "GET" },
      isAccountListResponse,
      "Accounts response had an unexpected format.",
    );
  },

  getAnalyticsHubSnapshot() {
    return requestValidated<AnalyticsHubSnapshotResponse>(
      "/api/v1/aws/analytics-hub/snapshot",
      { method: "GET" },
      isAnalyticsHubSnapshotResponse,
      "Analytics snapshot response had an unexpected format.",
    );
  },

  refreshAnalyticsHubSnapshot() {
    return requestValidated<AnalyticsHubRefreshResponse>(
      "/api/v1/aws/analytics-hub/refresh",
      { method: "POST" },
      isAnalyticsHubRefreshResponse,
      "Analytics refresh response had an unexpected format.",
    );
  },

  createChat(body: CreateChatRequest = {}) {
    return requestValidated<CreateChatResponse>(
      "/api/v1/chats",
      {
        method: "POST",
        body,
      },
      isCreateChatResponse,
      "Create chat response had an unexpected format.",
    );
  },

  listChats(params: { limit?: number; cursor?: string } = {}) {
    const qs = new URLSearchParams();
    if (params.limit) qs.set("limit", String(params.limit));
    if (params.cursor) qs.set("cursor", params.cursor);
    const path = "/api/v1/chats";
    const url = qs.toString() ? `${path}?${qs.toString()}` : path;
    return requestValidated<ListChatsResponse>(
      url,
      { method: "GET" },
      isListChatsResponse,
      "Chats response had an unexpected format.",
    );
  },

  renameChat(chatId: string, body: RenameChatRequest) {
    return requestValidated<RenameChatResponse>(
      `/api/v1/chats/${chatId}`,
      {
        method: "PATCH",
        body,
      },
      isRenameChatResponse,
      "Rename chat response had an unexpected format.",
    );
  },

  deleteChat(chatId: string) {
    return requestValidated<DeleteChatResponse>(
      `/api/v1/chats/${chatId}`,
      {
        method: "DELETE",
      },
      isDeleteChatResponse,
      "Delete chat response had an unexpected format.",
    );
  },

  listMessages(chatId: string, params: { limit?: number; cursor?: string } = {}) {
    const qs = new URLSearchParams();
    if (params.limit) qs.set("limit", String(params.limit));
    if (params.cursor) qs.set("cursor", params.cursor);
    const path = `/api/v1/chats/${chatId}/messages`;
    const url = qs.toString() ? `${path}?${qs.toString()}` : path;
    return requestValidated<ListMessagesResponse>(
      url,
      { method: "GET" },
      isListMessagesResponse,
      "Messages response had an unexpected format.",
    );
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
    return requestValidated<InlineCompletionResponse>(
      "/api/completions/inline",
      {
        method: "POST",
        body,
      },
      isInlineCompletionResponse,
      "Inline completion response had an unexpected format.",
    );
  },
};

export type { StreamEvent } from "./types";
