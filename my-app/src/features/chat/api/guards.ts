import type {
  AccountListResponse,
  AnalyticsCertificateItem,
  AnalyticsEcsClusterItem,
  AnalyticsEcsServiceItem,
  AnalyticsEcsSeverity,
  AnalyticsEcsTaskItem,
  AnalyticsHubAccountError,
  AnalyticsHubAccountSnapshot,
  AnalyticsHubRefreshResponse,
  AnalyticsHubSnapshot,
  AnalyticsHubSnapshotResponse,
  AnalyticsHubStorageStatus,
  AnalyticsIdleResourceItem,
  AnalyticsMonthlyCostItem,
  AnalyticsServiceSpendItem,
  AnalyticsUtilizationResourceItem,
  AwsAccountDto,
  ChatMessageDto,
  ChatSummary,
  CreateChatResponse,
  DeleteChatResponse,
  HealthResponse,
  InlineCompletionResponse,
  ListChatsResponse,
  ListMessagesResponse,
  LlmAnswerResponse,
  RenameChatResponse,
} from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

function isNullableString(value: unknown): value is string | null | undefined {
  return value === undefined || value === null || typeof value === "string";
}

function isNullableNumber(value: unknown): value is number | null | undefined {
  return value === undefined || value === null || isNumber(value);
}

function isArrayOf<T>(value: unknown, guard: (item: unknown) => item is T): value is T[] {
  return Array.isArray(value) && value.every((item) => guard(item));
}

function isNumberRecord(value: unknown): value is Record<string, number> {
  return isRecord(value) && Object.values(value).every(isNumber);
}

function isChatSummary(value: unknown): value is ChatSummary {
  if (!isRecord(value)) return false;
  return (
    isString(value.id) &&
    isString(value.title) &&
    isNumber(value.createdAtMs) &&
    isNumber(value.updatedAtMs)
  );
}

function isMessageStatus(value: unknown): value is ChatMessageDto["status"] {
  return value === "final" || value === "streaming" || value === "error";
}

function isChatMessageDto(value: unknown): value is ChatMessageDto {
  if (!isRecord(value)) return false;
  return (
    isString(value.id) &&
    isString(value.chatId) &&
    (value.role === "user" || value.role === "assistant") &&
    isString(value.text) &&
    isNumber(value.createdAtMs) &&
    (value.status === undefined || isMessageStatus(value.status))
  );
}

function isAwsAccountDto(value: unknown): value is AwsAccountDto {
  if (!isRecord(value)) return false;
  return (
    isString(value.account_key) &&
    isString(value.account_id) &&
    isString(value.region)
  );
}

function isAnalyticsServiceSpendItem(value: unknown): value is AnalyticsServiceSpendItem {
  if (!isRecord(value)) return false;
  return isString(value.service) && isNumber(value.cost);
}

function isAnalyticsMonthlyCostItem(value: unknown): value is AnalyticsMonthlyCostItem {
  if (!isRecord(value)) return false;
  return isString(value.month) && isNumber(value.cost);
}

function isAnalyticsCertificateItem(value: unknown): value is AnalyticsCertificateItem {
  if (!isRecord(value)) return false;
  return (
    isString(value.certificate_arn) &&
    isString(value.domain_name) &&
    isString(value.expiry_date) &&
    isNumber(value.days_to_expiry)
  );
}

function isAnalyticsEcsSeverity(value: unknown): value is AnalyticsEcsSeverity {
  return value === "ok" || value === "warning" || value === "critical";
}

function isAnalyticsEcsTaskItem(value: unknown): value is AnalyticsEcsTaskItem {
  if (!isRecord(value)) return false;
  return (
    isString(value.task_arn) &&
    isString(value.task_id) &&
    isString(value.last_status) &&
    isString(value.desired_status) &&
    isNullableString(value.health_status) &&
    isNullableString(value.launch_type) &&
    isNullableString(value.stopped_reason) &&
    isArrayOf(value.container_reasons, isString) &&
    isAnalyticsEcsSeverity(value.severity)
  );
}

function isAnalyticsEcsServiceItem(value: unknown): value is AnalyticsEcsServiceItem {
  if (!isRecord(value)) return false;
  return (
    isString(value.service_name) &&
    isString(value.service_arn) &&
    isString(value.status) &&
    isNumber(value.desired_count) &&
    isNumber(value.running_count) &&
    isNumber(value.pending_count) &&
    isNullableNumber(value.utilization_percent) &&
    isNullableString(value.utilization_status) &&
    isNullableNumber(value.cpu_average_percent) &&
    isNullableNumber(value.memory_average_percent) &&
    isNullableString(value.launch_type) &&
    isNullableString(value.task_definition) &&
    isNullableString(value.deployment_status) &&
    isAnalyticsEcsSeverity(value.severity) &&
    isString(value.insight) &&
    isNullableString(value.reason) &&
    isNullableString(value.solution) &&
    isNullableString(value.console_url) &&
    isArrayOf(value.events, isString) &&
    isArrayOf(value.tasks, isAnalyticsEcsTaskItem)
  );
}

function isAnalyticsEcsClusterItem(value: unknown): value is AnalyticsEcsClusterItem {
  if (!isRecord(value)) return false;
  return (
    isString(value.cluster_name) &&
    isNullableString(value.cluster_arn) &&
    isNullableString(value.status) &&
    isAnalyticsEcsSeverity(value.severity) &&
    isString(value.insight) &&
    isArrayOf(value.services, isAnalyticsEcsServiceItem)
  );
}

function isAnalyticsIdleResourceItem(value: unknown): value is AnalyticsIdleResourceItem {
  if (!isRecord(value)) return false;
  return (
    isString(value.resource_type) &&
    isString(value.resource_id) &&
    isNullableString(value.name) &&
    isString(value.region) &&
    isString(value.signal) &&
    isString(value.finding) &&
    isString(value.implication) &&
    isString(value.suggested_action) &&
    isAnalyticsEcsSeverity(value.severity) &&
    isBoolean(value.idle) &&
    isNullableNumber(value.cpu_average_percent) &&
    isNullableNumber(value.network_average_bytes) &&
    isNullableNumber(value.estimated_monthly_waste) &&
    isNullableString(value.console_url)
  );
}

function isAnalyticsUtilizationResourceItem(value: unknown): value is AnalyticsUtilizationResourceItem {
  if (!isRecord(value)) return false;
  return (
    isString(value.resource_type) &&
    isString(value.resource_id) &&
    isNullableString(value.resource_name) &&
    isString(value.region) &&
    isString(value.utilization_status) &&
    isAnalyticsEcsSeverity(value.severity) &&
    isString(value.finding) &&
    isString(value.reason) &&
    isString(value.suggested_action) &&
    isString(value.source) &&
    (value.current_configuration === undefined || isRecord(value.current_configuration)) &&
    (value.recommended_configuration === undefined || value.recommended_configuration === null || isRecord(value.recommended_configuration)) &&
    isNumberRecord(value.metrics) &&
    isNullableString(value.console_url)
  );
}

function isAnalyticsHubAccountSnapshot(value: unknown): value is AnalyticsHubAccountSnapshot {
  if (!isRecord(value)) return false;
  return (
    isString(value.account_key) &&
    isString(value.account_id) &&
    isString(value.region) &&
    isNullableString(value.project_name) &&
    isNullableString(value.project_owner) &&
    isNumber(value.total_cost_30d) &&
    isArrayOf(value.service_spend_30d, isAnalyticsServiceSpendItem) &&
    isArrayOf(value.monthly_cost_trend, isAnalyticsMonthlyCostItem) &&
    isArrayOf(value.expiring_certificates, isAnalyticsCertificateItem) &&
    (value.ecs_clusters === undefined || isArrayOf(value.ecs_clusters, isAnalyticsEcsClusterItem)) &&
    (value.utilization_resources === undefined || isArrayOf(value.utilization_resources, isAnalyticsUtilizationResourceItem)) &&
    (value.idle_resources === undefined || isArrayOf(value.idle_resources, isAnalyticsIdleResourceItem))
  );
}

function isAnalyticsHubAccountError(value: unknown): value is AnalyticsHubAccountError {
  if (!isRecord(value)) return false;
  return (
    isString(value.account_key) &&
    isNullableString(value.account_id) &&
    isNullableString(value.region) &&
    isString(value.error)
  );
}

function isAnalyticsHubSnapshot(value: unknown): value is AnalyticsHubSnapshot {
  if (!isRecord(value)) return false;
  return (
    isNullableString(value.generated_at_utc) &&
    isNumber(value.account_count) &&
    isArrayOf(value.accounts, isAnalyticsHubAccountSnapshot) &&
    isArrayOf(value.errors, isAnalyticsHubAccountError)
  );
}

export function isHealthResponse(value: unknown): value is HealthResponse {
  if (!isRecord(value)) return false;
  return value.ok === true && isString(value.version) && isNumber(value.serverTimeMs);
}

export function isAccountListResponse(value: unknown): value is AccountListResponse {
  if (!isRecord(value)) return false;
  return isArrayOf(value.accounts, isAwsAccountDto);
}

export function isAnalyticsHubSnapshotResponse(value: unknown): value is AnalyticsHubSnapshotResponse {
  if (!isRecord(value)) return false;
  return (
    isAnalyticsHubSnapshot(value.snapshot) &&
    isBoolean(value.refresh_in_progress)
  );
}

export function isAnalyticsHubRefreshResponse(value: unknown): value is AnalyticsHubRefreshResponse {
  if (!isRecord(value)) return false;
  return isBoolean(value.queued) && isBoolean(value.refresh_in_progress) && isString(value.table_key);
}

export function isAnalyticsHubStorageStatus(value: unknown): value is AnalyticsHubStorageStatus {
  if (!isRecord(value) || !isRecord(value.table_counts)) return false;
  return (
    isBoolean(value.sqlite_enabled) &&
    (value.db_connected === undefined || isBoolean(value.db_connected)) &&
    isString(value.db_file) &&
    isBoolean(value.db_exists) &&
    Object.values(value.table_counts).every(isNumber) &&
    isBoolean(value.json_snapshot_exists) &&
    isBoolean(value.jsonl_table_cache_exists) &&
    isString(value.active_storage_source) &&
    (value.portable_mode === undefined || isBoolean(value.portable_mode)) &&
    (value.portable_note === undefined || isString(value.portable_note))
  );
}

export function isCreateChatResponse(value: unknown): value is CreateChatResponse {
  if (!isRecord(value)) return false;
  return isChatSummary(value.chat);
}

export function isListChatsResponse(value: unknown): value is ListChatsResponse {
  if (!isRecord(value)) return false;
  return isArrayOf(value.items, isChatSummary) && (value.nextCursor === null || isString(value.nextCursor));
}

export function isRenameChatResponse(value: unknown): value is RenameChatResponse {
  if (!isRecord(value)) return false;
  return value.ok === true && isChatSummary(value.chat);
}

export function isDeleteChatResponse(value: unknown): value is DeleteChatResponse {
  if (!isRecord(value)) return false;
  return value.ok === true;
}

export function isListMessagesResponse(value: unknown): value is ListMessagesResponse {
  if (!isRecord(value)) return false;
  return isArrayOf(value.items, isChatMessageDto) && (value.nextCursor === null || isString(value.nextCursor));
}

export function isInlineCompletionResponse(value: unknown): value is InlineCompletionResponse {
  if (!isRecord(value) || !Array.isArray(value.suggestions)) return false;
  return value.suggestions.every((item) => {
    if (!isRecord(item)) return false;
    return (
      isString(item.insertText) &&
      isString(item.displayText) &&
      (item.score === undefined || isNumber(item.score))
    );
  });
}

export function isLlmAnswerResponse(value: unknown): value is LlmAnswerResponse {
  if (!isRecord(value)) return false;
  return (
    isString(value.answer) &&
    isString(value.prompt) &&
    isString(value.engine) &&
    isNullableString(value.provider_request_id)
  );
}
