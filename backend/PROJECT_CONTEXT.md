# Backend Project Context

## Current Scope

This repository now has:

- `my-app/` as the frontend chat application
- `backend/` as the FastAPI backend
- AWS analytics APIs under `backend/app/api/v1/endpoints/aws.py`
- LLM utility APIs under `backend/app/api/v1/endpoints/llm.py`
- archived AWS response data under `backend/data/api_response_archive.jsonl`

## What Has Been Done

### Backend split from frontend

The Python backend files were moved into `backend/` so the repository now has a clean top-level separation:

- frontend: `my-app/`
- backend: `backend/`

### AWS APIs and archive flow

AWS endpoints already exist for:

- accounts
- cost breakdown
- total cost
- service costs
- trends and forecast
- budget
- resource cost
- EC2 idle check

Every AWS API response is archived into `backend/data/api_response_archive.jsonl`.

### Chat history persistence

Chat history is now persisted in:

- `backend/data/chat_context.jsonl`

What is stored there:

- chat metadata
- message history for recent chats
- compacted summaries for older chats

Concepts used:

- JSONL-backed persistence
- bounded full-history retention
- summary compaction for older chats

Why:

- chat history now survives backend restarts
- frontend chat history can continue to use the same backend chat endpoints
- older conversation context can still be retained without keeping unlimited full transcripts in memory

Issue if not applied:

- chat history would disappear on every restart
- backend and frontend chat state would drift
- older context would be lost entirely or storage would grow without control

### Archive retention

The archive now keeps only the 2 most recent records per endpoint.

Concept used:
- bounded retention by endpoint

Why:
- recent data is enough for quick comparison
- prevents the archive from growing indefinitely

Issue if not applied:
- archive file would grow forever
- slower reads for chat and debugging
- noisier stale data for cache-assisted answers

### AWS endpoint schema improvements

Swagger descriptions and examples were improved, especially for `cost-breakdown`.

Concept used:
- schema-first API documentation

Why:
- callers can understand inputs and outputs directly in Swagger/OpenAPI
- future chat orchestration can rely on clearer contracts

Issue if not applied:
- ambiguous request shapes
- harder agent/tool routing
- more frontend/backend integration mistakes

### AWS endpoint refactoring

Repeated endpoint validation and archive-writing logic was centralized.

Concepts used:
- DRY
- single-responsibility helpers
- centralized response shaping

Why:
- fewer repeated blocks in endpoint handlers
- easier to add future AWS endpoints
- less chance of inconsistent validation or archive behavior

Issue if not applied:
- repetitive code across endpoints
- harder maintenance
- higher regression risk when behavior changes

### LLM support

LLM support was added with:

- VOX token generation from `.env`
- downstream Vessel OpenAI call
- LLM answer endpoint
- LLM health-check endpoint

Concepts used:
- env-driven configuration
- structured error responses
- token caching

Why:
- model and endpoints can be changed without code edits
- frontend can distinguish configuration failure vs token failure vs LLM failure

Issue if not applied:
- hardcoded credentials and model
- poor debugging
- repeated token requests

## Chat API Direction

### Chosen direction

Use:

- one chat orchestrator that behaves like a single agent
- one deterministic data layer
- one final response composer

Do not use:

- multiple cooperating agents for archive lookup and live API calling

### Agent and tools: what was actually implemented

Yes, an agent-style flow was added, but it is a single orchestrator pattern, not a multi-agent system.

What acts as the agent:

- `backend/app/services/chat_service.py`

What acts as the tools:

- `backend/app/chat/tool_catalog.py`
- existing AWS service methods in `backend/app/services/aws_service.py`
- archive lookup in `backend/app/services/archive_service.py`
- final text generation in `backend/app/services/llm_service.py`

Important clarification:

- there is no separate agent framework with tool-calling threads or agent-to-agent delegation
- the orchestration logic is coded directly inside `ChatService`
- the tool catalog is a compact code-based registry that tells the orchestrator what each backend AWS capability does

Why this approach was used:

- faster than multi-agent coordination
- easier to debug when a wrong endpoint is chosen
- smaller prompts
- simpler control over cached vs live data

Issue if not applied:

- too many moving parts for a relatively small backend
- harder tracing of why a response was produced
- more latency before the frontend receives a streamed answer

### Routing strategy

Chosen approach:

- deterministic routing rules first
- LLM fallback only when routing is ambiguous

Why this was chosen:

- faster than always invoking an LLM planner
- easier to debug
- lower prompt size
- lower cost
- more predictable endpoint selection

Issue if not applied:

- large planner prompt
- slower routing
- harder debugging when the wrong API is chosen

### Tool catalog

Endpoint knowledge should live mostly in code, not in one huge system prompt.

This has been prepared in:

- `backend/app/chat/tool_catalog.py`

Purpose:

- maintain a compact catalog of available AWS tools
- define what each endpoint is for
- define required inputs
- define likely trigger phrases
- support deterministic routing and compact LLM fallback prompts

What the catalog contains for each tool:

- `tool_name`
- backend endpoint path
- summary
- when to use it
- expected response shape
- required inputs
- optional inputs
- cache value
- whether a live call is required
- trigger phrases

Current tools in the catalog:

- `accounts`
- `cost_breakdown`
- `total_cost`
- `service_costs`
- `trends_forecast`
- `budget`
- `resource_cost`
- `ec2_idle_check`

This means the orchestrator does not need a huge system prompt to remember what every API does. Most of that knowledge is encoded in Python.

### Implemented orchestration logic

The chat flow currently works in this order:

```text
Frontend SSE
-> Chat API
-> ChatService orchestrator
-> Query context extraction
-> Router
-> Cache check
-> Live AWS call
-> LLM compose
-> SSE final
```

1. The frontend sends a chat message to the SSE chat endpoint.
2. `ChatService` creates or reuses chat messages in the persisted chat store.
3. It emits an immediate streaming status update so the UI responds quickly.
4. It extracts structured query context from the user text:
   - account keys
   - days
   - top N
   - budget name
   - resource id
   - instance ids
   - idle days
5. It tries deterministic routing first using trigger-phrase scoring from the tool catalog.
6. If routing is still ambiguous, it uses a compact LLM planner prompt that only asks for one `tool_name`.
7. If required fields are missing, it stops and returns a follow-up question instead of guessing.
8. It checks the JSONL archive for a recent matching record for that endpoint and request shape.
9. If a cached match exists, it streams a provisional cached preview.
10. It calls the live AWS backend method for fresh data.
11. It sends live data to the LLM to compose the final response.
12. If the LLM summarization fails, it falls back to a deterministic text answer.
13. It stores the final assistant message and emits the final SSE event.

### How backend chat history now behaves

The backend chat store is no longer only in-memory.

Implemented in:

- `backend/app/services/chat_store_service.py`

What it does now:

- loads existing chats from `backend/data/chat_context.jsonl` on startup
- writes chat updates back to the same file after create, rename, delete, send, rerun, and assistant updates
- keeps all chats in the backend list for the frontend
- keeps only the 10 most recently updated chats with full message history
- compacts chats older than the most recent 10 into summaries
- returns a synthetic summary message when an older compacted chat is reopened in the frontend

How summary compaction works:

- chats are ordered by `updated_at_ms`
- chats after the latest 10 are compacted
- their current messages are summarized into `summary_text`
- full stored messages for those compacted chats are cleared
- if new messages arrive later in that same chat, they are stored normally and the older compacted summary remains available

Why this design was chosen:

- keeps the frontend contract unchanged
- preserves recent chats in full detail
- prevents unbounded transcript growth
- still gives the orchestrator older context when needed

Issue if not applied:

- JSONL would grow with full transcripts forever
- reopened old chats would either be lost or too expensive to keep fully
- context retention would not scale even for a moderate number of chats

### Specific logic implemented inside the orchestrator

Deterministic routing logic:

- special-case rule for account-list questions
- trigger-phrase scoring across all catalog tools
- extra score boost when a resource id is present for `resource_cost`
- extra score boost when EC2 instance ids are present for `ec2_idle_check`

Entity extraction logic:

- reads selected account keys from frontend if provided
- otherwise infers account keys from the query text using configured `AWS_ACCOUNT_KEYS`
- parses time windows like last/past N days, weeks, or months
- parses `top N`
- parses quoted or named budget names
- parses AWS-style resource ids and EC2 instance ids
- parses idle-day thresholds

Follow-up logic:

- budget queries require `budget_name`
- resource cost queries require `resource_id`
- EC2 idle checks require one or more `instance_ids`

Cache logic:

- only checks the 2 recent archived records kept for that endpoint
- matches by endpoint first
- narrows by requested account keys when available
- also compares key request fields like `days` and `top_n`
- uses cache as provisional context only, not as final truth

Final answer logic:

- live AWS response is treated as the source of truth
- cached JSONL data is passed only as optional supporting context
- if LLM answer generation fails, a deterministic fallback response is built from the live JSON

Conversation memory logic:

- `ChatService` now reads archived summary plus recent chat messages from the chat store
- that conversation context is included in the LLM planner fallback prompt
- the same context is included in the final answer-composition prompt
- recent chat messages are limited by `CHAT_CONTEXT_MESSAGE_LIMIT`, currently default `6`
- older compacted history is stored in each chat record as `summary_text`
- rendered conversation memory is trimmed by `CHAT_CONTEXT_PROMPT_CHAR_LIMIT`, currently default `2500`
- the latest successful tool call per chat is also stored in `chat_context.jsonl`
- later follow-up questions can reuse that latest session dataset without a new AWS call
- a new AWS call is made only when the follow-up changes scope or explicitly requests refresh

Why:

- follow-up questions can reuse prior chat context
- summarized older chats still contribute context even after full messages are compacted away

Reference:

- `backend/CHAT_DATA_FLOW.md`

## Frontend Account Sidebar

The frontend currently hardcodes account options in:

- `my-app/src/features/chat/components/AccountsSidebar.tsx`

Target behavior:

- account options should come from the backend, not from hardcoded `DEV` / `PROD`

Relevant backend source:

- `.env` variable `AWS_ACCOUNT_KEYS`
- existing backend endpoint `GET /api/v1/aws/accounts`

Note:

`GET /api/v1/aws/accounts` currently resolves AWS account ids too. That may be enough for the frontend account picker, but if a lighter config-only endpoint is needed later, it can be added.

## Recommended Next Steps

## Chat API Implementation

The backend now includes a real chat surface aligned with the frontend contract:

- `GET /api/v1/health`
- `POST /api/v1/chats`
- `GET /api/v1/chats`
- `PATCH /api/v1/chats/{chat_id}`
- `DELETE /api/v1/chats/{chat_id}`
- `GET /api/v1/chats/{chat_id}/messages`
- `POST /api/v1/chats/{chat_id}/stream`
- `POST /api/v1/chats/{chat_id}/messages/{user_message_id}/rerun/stream`

Concepts used:

- SSE for progressive assistant output
- deterministic tool routing first
- compact LLM fallback for ambiguous routing
- cache-assisted provisional context from JSONL
- live AWS call as final source of truth
- JSONL-backed chat persistence to match frontend chat/history behavior across restarts

Why:

- frontend already supports streaming
- user gets fast progress feedback
- backend remains debuggable
- prompt size stays small because endpoint knowledge lives in code

Issue if not applied:

- slower synchronous waiting
- harder endpoint selection debugging
- oversized system prompts
- no structured path from cached data to live refreshed answer

## Recommended Next Steps

1. Expand Swagger descriptions and examples for all AWS endpoints using real archive samples.
2. Improve deterministic entity extraction for budget names, resource ids, and time ranges.
3. Add explicit SSE event types for planning/cache/live status if the frontend should render those states differently later.
4. Use archive data only as provisional context and still call live AWS APIs for freshness by default.
5. Consider summarizing chat history with the LLM instead of deterministic string compaction if summary quality becomes important.
