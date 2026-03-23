# Chat Data Flow

This file explains how a user prompt moves through the backend and how the streamed response reaches the frontend.

## High-Level Flow

```text
Frontend chat UI
  -> POST /api/v1/chats/{chat_id}/stream
  -> Chat endpoint
  -> ChatService orchestrator
  -> Query context extraction
  -> Deterministic router
  -> LLM planner fallback only if routing is ambiguous
  -> Recent AWS archive lookup
  -> Live AWS backend tool call
  -> LLM answer composer
  -> SSE events back to frontend
```

## Request Processing

1. Frontend sends the user message to `POST /api/v1/chats/{chat_id}/stream`.
2. Backend creates the user message and a placeholder assistant message in the chat store.
3. Backend immediately streams a `start` SSE event.
4. Backend streams an early `delta` event so the UI shows progress quickly.

## Context Used For The Chat Answer

The effective LLM context is built from these sources:

1. System/task guidance embedded in `ChatService`
2. Current user prompt
3. Tool catalog from `app/chat/tool_catalog.py`
4. Conversation memory from `data/chat_context.jsonl`
5. Recent AWS API archive data from `data/api_response_archive.jsonl`
6. Fresh live AWS API response

## How `chat_context.jsonl` Is Used

For the current chat thread only, the backend loads:

- `summary_text` from older compacted history
- the most recent chat messages, limited by `CHAT_CONTEXT_MESSAGE_LIMIT`

Defaults:

- `CHAT_RECENT_LIMIT=10`
- `CHAT_CONTEXT_MESSAGE_LIMIT=6`
- `CHAT_CONTEXT_PROMPT_CHAR_LIMIT=2500`

Meaning:

- only the 10 most recently updated chats keep full message history
- older chats are compacted into `summary_text`
- only the latest 6 messages from the active chat are passed forward as prompt memory
- the rendered conversation context is truncated to 2500 characters before sending to the LLM

## Routing Logic

Routing happens in this order:

1. Deterministic rules check the current user query.
2. Trigger phrases from the tool catalog are scored.
3. Entity hints such as resource ids and EC2 instance ids boost matching for certain tools.
4. If routing is still unclear, the LLM planner is called with a compact prompt and tool catalog.
5. If required fields are missing, the backend returns a follow-up question instead of guessing.

## Follow-Up Reuse Logic

After the first successful live tool call in a chat session, the backend stores the latest successful tool context inside `data/chat_context.jsonl`.

That stored session context includes:

- last successful tool name
- last endpoint
- last request payload
- last live result
- last archive timestamp

For later follow-up questions, the backend first decides whether the latest session dataset is enough.

It reuses the latest session dataset when:

- the query looks like a follow-up
- the user is asking for explanation, summary, comparison, or subset reasoning
- the query does not ask for a different tool
- the query does not change scope such as days, top N, budget name, resource id, instance ids, or selected accounts
- the user does not explicitly ask for refresh/recheck/latest now

It makes a new AWS call when:

- the follow-up changes time range
- the follow-up changes tool or intent
- the follow-up changes account scope outside the last fetched dataset
- the follow-up changes budget/resource/instance scope
- the user explicitly asks for refresh/current/latest now

## Cache And Fresh Data

After routing:

1. Backend checks `data/api_response_archive.jsonl` for the 2 most recent matching records for that endpoint.
2. If a matching cached record exists, it streams a provisional cached preview.
3. Backend then calls the live AWS API through `AwsInsightsService`.
4. If the live call succeeds, that fresh result is also written back into `data/api_response_archive.jsonl`.
5. Live AWS data is treated as the source of truth.
6. If the live call fails but a cached record exists, the backend can fall back to the archived answer and mark it as archived.

## Final Answer Creation

1. Backend sends the current question, compact conversation memory, selected tool info, cached record if relevant, and live AWS result to the LLM composer.
2. If LLM composition succeeds, that answer becomes the final assistant message.
3. If LLM composition fails, backend falls back to deterministic text formatting from the live AWS JSON.

## SSE Response Format

The frontend expects streaming and the backend already sends it in SSE format.

Current event types:

- `start`
- `delta`
- `final`
- `error`

Typical sequence:

```text
start -> delta -> delta -> final
```

Error sequence:

```text
start -> delta -> error
```

## Files Involved

- `app/api/v1/endpoints/chat.py`
- `app/services/chat_service.py`
- `app/services/chat_store_service.py`
- `app/chat/tool_catalog.py`
- `app/services/archive_service.py`
- `app/services/aws_service.py`
- `app/services/llm_service.py`
- `data/chat_context.jsonl`
- `data/api_response_archive.jsonl`
