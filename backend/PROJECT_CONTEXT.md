# Project Context

This document describes the current state of the AWS analytics and chat application so it can be shared with ChatGPT or another engineer for architecture, product, or implementation discussion.

## 1. Application Summary

This repository contains a cloud operations application for AWS cost, utilization, idle resource, certificate, ECS, and account analysis. The product has two main surfaces:

- `my-app/`: a React/Vite frontend with an Analytics Hub and chat experience.
- `backend/`: a FastAPI backend that connects to AWS, persists local JSONL cache files, serves Analytics Hub snapshots, and powers an AWS-aware chat assistant.

The primary user experience is the Analytics Hub. It loads cached AWS intelligence first for smooth startup, lets users refresh specific tables, and allows selected signals to be sent into chat for grounded analysis. The backend is designed to confirm connected AWS accounts, check local cache coverage, fetch missing account data in the background, and refresh cached data periodically.

Analytics Hub now has a local SQLite database for queryable operational data:

```text
backend/data/aws_insights.db
```

The existing JSON snapshot and JSONL cache files are still preserved and used as fallback. Chat history, API response archive, and tool catalog index remain JSONL.

The SQLite DB is embedded and portable. There is no PostgreSQL/MySQL/Docker service to start or restart. If the project is moved to another machine, copy the code plus `backend/data/`; the app will open `backend/data/aws_insights.db` automatically. If that file is missing, the backend recreates it and falls back to JSON/JSONL cache until AWS refresh fills it.

## 2. Repository Layout

```text
proj1test/
  backend/
    app/
      api/v1/endpoints/
        aws.py
        chat.py
        llm.py
      chat/
        tool_catalog.py
      core/
        config.py
      schemas/
        aws.py
      services/
        analytics_hub_service.py
        analytics_sqlite_service.py
        archive_service.py
        aws_clients.py
        aws_service.py
        chat_service.py
        chat_store_service.py
        llm_service.py
    data/
      analytics_hub_snapshot.json
      analytics_hub_tables.jsonl
      aws_insights.db
      api_response_archive.jsonl
      chat_context.jsonl
      tool_catalog_index.jsonl
    .env.example
    PROJECT_CONTEXT.md

  my-app/
    src/
      pages/
        AnalyticsHub.tsx
      styles/
        globals.css
```

## 3. Backend Architecture

The backend is a FastAPI service. The app entrypoint is `backend/app/main.py`, which registers the API router and starts Analytics Hub background maintenance on application startup.

Main routers:

- `backend/app/api/v1/endpoints/aws.py`: AWS account, cost, utilization, idle resource, certificate, ECS, and Analytics Hub APIs.
- `backend/app/api/v1/endpoints/chat.py`: chat CRUD and streaming chat endpoints.
- `backend/app/api/v1/endpoints/llm.py`: direct LLM answer and health-check endpoints.

Main services:

- `AwsInsightsService` in `backend/app/services/aws_service.py`: calls AWS APIs and shapes cloud operations data.
- `AnalyticsHubSnapshotService` in `backend/app/services/analytics_hub_service.py`: manages startup cache checks, snapshot persistence, table-level JSONL cache, background refreshes, and partial refresh requests.
- `AnalyticsSqliteService` in `backend/app/services/analytics_sqlite_service.py`: initializes `aws_insights.db`, stores queryable Analytics Hub tables, records refresh runs, and provides safe fallback behavior if SQLite reads/writes fail.
- `ChatService` in `backend/app/services/chat_service.py`: single orchestrator for chat routing, archive lookup, live AWS calls, and LLM answer composition.
- `ChatStoreService` in `backend/app/services/chat_store_service.py`: JSONL-backed chat history persistence and compaction.
- `ArchiveService` in `backend/app/services/archive_service.py`: bounded archive of recent AWS API responses.
- `LlmService` in `backend/app/services/llm_service.py`: token handling and downstream LLM calls.
- `aws_clients.py`: central AWS client/session factory.

The backend intentionally uses a single orchestrator pattern for chat. It does not use a multi-agent framework.

## 4. Configuration

Configuration is environment-driven. The reference file is `backend/.env.example`.

Important groups:

- AWS account keys: `AWS_ACCOUNT_KEYS=dev,prod`
- Per-account AWS fields: `AWS_<ACCOUNT>_ACCESS_KEY_ID`, `AWS_<ACCOUNT>_SECRET_ACCESS_KEY`, `AWS_<ACCOUNT>_REGION`, optional `AWS_<ACCOUNT>_SESSION_TOKEN`
- Optional Secrets Manager loading for account config.
- LLM settings: `VOX_USER`, `VOX_PASSWORD`, `TOKEN_URL`, `VESSEL_OPENAI_API`, `VESSEL_OPENAI_PAYLOAD_MODE`, model/version fields, and timeout.
- Local data files:
  - `CHAT_CONTEXT_FILE`
  - `API_RESPONSE_ARCHIVE_FILE`
  - `ANALYTICS_HUB_SNAPSHOT_FILE`
  - `ANALYTICS_HUB_TABLE_CACHE_FILE`
  - `ANALYTICS_SQLITE_DB_FILE`
  - `TOOL_CATALOG_INDEX_FILE`
- Analytics Hub behavior:
  - `ANALYTICS_HUB_REFRESH_INTERVAL_MINUTES`, default 30.
  - `ANALYTICS_HUB_TABLE_CACHE_MAX_RECORDS`, default 200.
- CORS and chat memory limits.

Do not share real `.env` secrets with ChatGPT. Use `.env.example` for discussion.

## 5. AWS Account Flow

The backend resolves connected AWS accounts from configured account keys. It can read credentials from environment variables or Secrets Manager, depending on configuration.

On Analytics Hub startup, the backend should:

1. Resolve connected AWS accounts.
2. Check `analytics_hub_snapshot.json` and `analytics_hub_tables.jsonl`.
3. Ensure the local SQLite database and Analytics Hub tables exist.
4. Prune SQLite rows to the currently configured AWS account keys so stale copied data from unrelated accounts does not appear.
5. Hydrate SQLite from existing JSON/JSONL cache if SQLite is empty and cache data exists.
6. Determine whether cached data exists for each connected account.
7. Serve SQLite data first when available for the configured accounts.
8. Fall back to `analytics_hub_snapshot.json` and `analytics_hub_tables.jsonl` if SQLite is empty or unavailable.
9. Fetch missing account data in the background.
10. Periodically refresh data on its own interval.
11. Allow the frontend to request refreshes for specific tables.

Cached Analytics Hub data is tagged by account so multi-account views can be filtered, hydrated, and refreshed safely.

## 6. AWS Data Sources

The backend currently uses these AWS services:

- STS: account identity lookup.
- Cost Explorer: cost breakdown, total cost, service spend, trends, forecasts, and resource cost.
- Budgets: budget data.
- ACM: certificate expiry watch.
- ECS: clusters, services, tasks, events, and service structure.
- CloudWatch: CPU, memory, network, ECS service metrics, and idle checks.
- EC2: instance inventory and state.
- Resource Groups Tagging API: project metadata where available.
- Compute Optimizer: utilization recommendations for EC2, EBS, Lambda, and ECS services.

Utilization Insights are based on AWS Compute Optimizer where possible:

- `Overprovisioned` is treated as underused.
- `Underprovisioned` is treated as overused.
- Output includes resource type, id, name, region, status, severity, finding, reason, suggested action, current configuration, recommended configuration, metrics, source, and console URL.

Compute Optimizer must be enabled in the AWS account, and the backend role/user must have the required permissions.

## 7. AWS API Surface

Current AWS endpoints include:

- `GET /api/v1/aws/accounts`
- `GET /api/v1/aws/analytics-hub/snapshot`
- `GET /api/v1/aws/analytics-hub/storage-status`
- `POST /api/v1/aws/analytics-hub/refresh`
- `POST /api/v1/aws/cost-breakdown`
- `POST /api/v1/aws/total-cost`
- `POST /api/v1/aws/service-costs`
- `POST /api/v1/aws/trends-forecast`
- `POST /api/v1/aws/budget`
- `POST /api/v1/aws/resource-cost`
- `POST /api/v1/aws/ec2/idle-check`
- `POST /api/v1/aws/idle-resources`
- `POST /api/v1/aws/certificates/expiring`
- `POST /api/v1/aws/ecs/insights`

Analytics Hub table refresh keys include:

- `all`
- `accounts`
- `financial`
- `certificates`
- `utilization`
- `idle`

The utilization table key refreshes utilization-related cached data, including Compute Optimizer resource findings.

## 8. Analytics Hub Snapshot Model

Analytics Hub data is represented per account. The important account-level snapshot fields are:

- account key
- AWS account id
- region
- project name and owner metadata
- 30-day total cost
- 30-day service spend rows
- monthly cost trend
- expiring certificates
- ECS clusters
- utilization resource findings
- idle resource findings

The backend persists a full snapshot in:

```text
backend/data/analytics_hub_snapshot.json
```

It also appends table-level records to:

```text
backend/data/analytics_hub_tables.jsonl
```

The JSONL cache supports table-specific hydration and makes it possible to reuse recent cached account/table data without blocking initial UI load.

SQLite stores queryable Analytics Hub data in these tables:

- `aws_accounts`
- `analytics_snapshots`
- `certificates`
- `utilization_findings`
- `idle_resources`
- `financial_service_spend`
- `priority_findings`
- `refresh_runs`

SQLite writes are best effort. If SQLite fails, refresh continues and the app uses the existing JSON/JSONL fallback.

The frontend status pill calls `GET /api/v1/aws/analytics-hub/storage-status` and shows whether the embedded DB is connected, which storage source is active, row counts, and a short note that no external DB server or DB restart is required.

## 9. Analytics Hub Frontend

The main frontend page is:

```text
my-app/src/pages/AnalyticsHub.tsx
```

Current Analytics Hub design:

- Loads cached AWS intelligence first.
- Shows operational status in a compact `Status` pill.
- Avoids long explanatory header text in the main cockpit.
- Supports account filtering.
- Supports table-specific refresh controls.
- Allows selected table/context rows to be discussed in chat.

Upper feature cards:

- Detect Idle Resources
- Certificate Expiry Watch
- Utilization Insights
- Proactive Recommendations
- Unified Troubleshooting Chat
- Action Plan Generator
- Priority Issue Tracker

The last three are restored only as compact upper cards. They do not have full lower table sections.

Compact workflow modals:

- `Proactive Recommendations`: summarizes optimization opportunities from idle, utilization, certificate, and financial signals.
- `Action Plan Generator`: turns highest-priority current signals into remediation steps.
- `Priority Issue Tracker`: ranks current issues by severity and risk.

These modal rows are generated locally in the frontend from already-loaded cached data:

- `snapshot`
- `utilizationRows`
- `idleResourceRows`
- `certificateItems`
- financial spend rows

The modals can send their generated rows into chat through the existing discussion flow. No new backend endpoint or schema was added for these cards.

Lower Analytics Hub sections currently remain:

- Financial Impact
- Utilization Insights
- Detect Idle Resources
- Account Summary / ECS Insight
- Certificates

There are no full lower sections for `Proactive Recommendations`, `Action Plan Generator`, or `Priority Issue Tracker`.

## 10. Important Frontend UX Details

Financial Impact:

- Has table and chart views.
- Supports account filtering.
- Should use cached snapshot data first and refresh only when requested.

Detect Idle Resources:

- Uses a fixed-height resource window for large result sets.
- Overflow scrolls inside that window instead of expanding the whole page.

ECS Insight:

- Presents ECS clusters, services, and tasks as a tree.
- Branch/leaf relationships are shown with animated connector lines.
- Related CSS is in `my-app/src/styles/globals.css`.

Utilization Insights:

- Displays underused and overused resources.
- Uses AWS Compute Optimizer data from the backend.
- Shows reasons and recommended actions.

Status:

- Cache readiness, update time, and selected account count are hidden inside a compact pill instead of always being expanded.

Guide:

- The tour/guide content is kept in the guide area rather than taking space in the main header.

## 11. Chat System

The chat backend supports:

- Create/list/rename/delete chats.
- Fetch chat messages.
- Stream assistant responses over SSE.
- Rerun previous messages.
- Persist chat history to JSONL.
- Use deterministic AWS tool routing first.
- Use LLM fallback only when routing is ambiguous.
- Use cached archive data as provisional context.
- Use live AWS data as the final source of truth unless the user is explicitly discussing cached Analytics Hub rows.

The tool catalog is:

```text
backend/app/chat/tool_catalog.py
```

It defines tool names, endpoint paths, trigger phrases, required inputs, optional inputs, cache behavior, and response expectations.

Current catalog coverage includes account, cost, budget, trend, resource cost, idle, certificate, and ECS-related tools. Analytics Hub workflow cards currently reuse frontend data and send context to chat rather than invoking a separate workflow-card backend tool.

## 12. Chat Persistence

Chat history is stored in:

```text
backend/data/chat_context.jsonl
```

Behavior:

- Recent chats keep full message history.
- Older chats are compacted into summaries.
- The frontend contract remains unchanged.
- Latest successful tool context can be reused for follow-up questions.
- New AWS calls are made when scope changes or refresh is requested.

This prevents unbounded memory growth while preserving useful context across backend restarts.

## 13. API Response Archive

AWS API responses are archived in:

```text
backend/data/api_response_archive.jsonl
```

The archive keeps a bounded number of recent records per endpoint. It is used for provisional cache-assisted chat context and debugging, not as the final source of truth for live AWS answers.

## 14. Performance And Smoothness Strategy

The app is being optimized around these principles:

- Serve cached Analytics Hub data immediately.
- Read Analytics Hub data from SQLite first when usable.
- Fall back to JSON/JSONL cache if SQLite is empty, missing, or fails.
- Fetch missing AWS data in the background after startup.
- Tag cached data by account.
- Refresh only the requested table when possible.
- Keep large lists inside scrollable windows.
- Avoid page-level layout jumps while data loads.
- Keep expensive cloud calls out of first paint when cached data exists.
- Use JSONL for append-friendly table cache records.
- Use SQLite for queryable Analytics Hub operational tables.
- Use atomic snapshot writes to avoid corrupted reads.
- Keep frontend workflow cards local until backend-generated recommendations are explicitly required.

## 15. Known Limitations And Design Notes

- Compute Optimizer recommendations depend on AWS account opt-in, supported services, and IAM permissions.
- The proactive/action/priority cards are currently frontend-generated summaries from cached data, not backend LLM-generated plans.
- Backend LLM reasoning can be added later for recommendation wording, but this pass intentionally avoided new endpoints and schema changes.
- Some ECS discovery defaults may depend on configured or expected cluster names in the backend service.
- JSONL table cache is still append-friendly fallback storage; SQLite is the queryable local Analytics Hub store.
- The snapshot can be stale until the interval refresh or user-triggered refresh completes.
- Frontend build may require running outside the local sandbox in this environment because Node can hit an EPERM while scanning parent directories.

## 16. Useful Discussion Questions For ChatGPT

Use this context to discuss:

- How to improve Analytics Hub cache invalidation and table refresh strategy.
- Whether `analytics_hub_tables.jsonl` should evolve into SQLite or another embedded store.
- How to add backend LLM-generated recommendations while preserving deterministic source data.
- How to rank utilization, idle, certificate, and financial findings into one shared severity model.
- How to make Compute Optimizer failures visible without overwhelming the user.
- How to reduce first-load visual jitter in the React page.
- How to structure IAM permissions for least-privilege Analytics Hub access.
- How to make ECS cluster discovery dynamic instead of relying on expected cluster names.
