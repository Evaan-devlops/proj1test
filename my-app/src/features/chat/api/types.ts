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

export type AnalyticsServiceSpendItem = {
  service: string;
  cost: number;
};

export type AnalyticsMonthlyCostItem = {
  month: string;
  cost: number;
};

export type AnalyticsCertificateItem = {
  certificate_arn: string;
  domain_name: string;
  expiry_date: string;
  days_to_expiry: number;
};

export type AnalyticsHubAccountSnapshot = {
  account_key: string;
  account_id: string;
  region: string;
  project_name?: string | null;
  project_owner?: string | null;
  total_cost_30d: number;
  service_spend_30d: AnalyticsServiceSpendItem[];
  monthly_cost_trend: AnalyticsMonthlyCostItem[];
  expiring_certificates: AnalyticsCertificateItem[];
};

export type AnalyticsHubAccountError = {
  account_key: string;
  account_id?: string | null;
  region?: string | null;
  error: string;
};

export type AnalyticsHubSnapshot = {
  generated_at_utc?: string | null;
  account_count: number;
  accounts: AnalyticsHubAccountSnapshot[];
  errors: AnalyticsHubAccountError[];
};

export type AnalyticsHubSnapshotResponse = {
  snapshot: AnalyticsHubSnapshot;
  refresh_in_progress: boolean;
};

export type AnalyticsHubRefreshResponse = {
  queued: boolean;
  refresh_in_progress: boolean;
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
