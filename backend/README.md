# AWS Insights API

FastAPI service for querying AWS cost, budget, forecast, resource, and EC2 idle insights across one or more configured AWS accounts, plus an LLM endpoint that uses VOX OAuth and the Pfizer Vessel OpenAI gateway.

## Features

- Multi-account AWS support via `.env` aliases such as `dev` and `prod`
- Cost Explorer endpoints for total cost, service costs, top service breakdown, trends, and forecast
- AWS Budgets lookup by budget name
- Resource-level cost lookup by Cost Explorer `RESOURCE_ID`
- EC2 idle detection using CloudWatch CPU and network metrics
- VOX token generation with client credentials from `.env`
- LLM question-answer endpoint backed by the Pfizer Vessel OpenAI gateway
- JSONL archive of AWS API responses that keeps the 2 most recent calls per endpoint for comparison
- Persistent chat history in `data/chat_context.jsonl`
- SSE chat streaming compatible with the frontend chat app

## Requirements

- Python 3.12+
- AWS credentials for each configured account
- VOX credentials for the LLM endpoint
- writable persistent storage for JSONL files when deployed outside local development
- Access to the AWS APIs used by this app:
  - Cost Explorer
  - Budgets
  - CloudWatch
  - STS

## Setup

If this code is copied into another machine or another VS Code workspace, follow the steps exactly from the `backend` folder.

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload
```

Generated files note:

- `data/chat_context.jsonl` is created automatically when chat history is first written
- `data/api_response_archive.jsonl` is created automatically when the first AWS result is archived
- Python `__pycache__` folders are generated automatically by Python and do not need to be copied
- frontend `node_modules` and `dist` also do not need to be copied
- for deployed environments, keep these JSONL files on persistent storage if you want chat/archive data to survive restarts

If you are using PowerShell:

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
uvicorn app.main:app --reload
```

If this repository is opened from the top-level folder, run backend commands like this:

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
uvicorn app.main:app --reload
```

API docs:

```text
http://127.0.0.1:8000/docs
```

Health check:

```text
GET http://127.0.0.1:8000/health
```

Frontend-compatible health check:

```text
GET http://127.0.0.1:8000/api/health
```

## Run With Frontend

The frontend is in `../my-app`.

1. Start the backend from the `backend` folder
2. In `my-app/.env.local`, set:

```env
VITE_API_BASE_URL=http://127.0.0.1:8000
```

3. Start the frontend:

```powershell
cd ..\my-app
npm install
npm run dev
```

The chat API already responds in SSE streaming format because the frontend expects streaming events.

Path handling note:

- backend `.env` is resolved from the `backend` folder itself
- `data/chat_context.jsonl` and `data/api_response_archive.jsonl` are also resolved relative to `backend`
- this makes the backend more portable when moved to another VS Code workspace
- in deployed environments, you can point JSONL files to an absolute mounted path such as `/mnt/app-data/...`

## Configuration

AWS accounts are loaded from `AWS_ACCOUNT_KEYS`. Each account can be configured directly in `.env` or by pointing the account at an AWS Secrets Manager secret.

```env
AWS_ACCOUNT_KEYS=dev,prod

AWS_ACCOUNT__DEV__ACCESS_KEY_ID=your_access_key_here
AWS_ACCOUNT__DEV__SECRET_ACCESS_KEY=your_secret_key_here
AWS_ACCOUNT__DEV__SESSION_TOKEN=your_optional_session_token_here
AWS_ACCOUNT__DEV__REGION=us-east-1
AWS_ACCOUNT__DEV__ACCOUNT_ID=123456789012

AWS_ACCOUNT__PROD__ACCESS_KEY_ID=your_access_key_here
AWS_ACCOUNT__PROD__SECRET_ACCESS_KEY=your_secret_key_here
AWS_ACCOUNT__PROD__SESSION_TOKEN=
AWS_ACCOUNT__PROD__REGION=us-east-1

# Optional Secrets Manager mode for any account key:
# AWS_ACCOUNT__DEV__SECRET_ID=aws-insights/dev-account
# AWS_SECRETS_MANAGER_REGION=us-east-1
AWS_ACCOUNT__PROD__ACCOUNT_ID=210987654321

VOX_USER=your_vox_user
VOX_PASSWORD=your_vox_password
TOKEN_URL=https://devfederate.pfizer.com/as/token.oauth2?grant_type=client_credentials
VESSEL_OPENAI_API=https://mule4api-comm-amer-dev.pfizer.com/vessel-openai-api-v1/chatCompletion
VESSEL_OPENAI_PAYLOAD_MODE=model_messages
VESSEL_OPENAI_ENGINE=gpt-4o-mini
VESSEL_OPENAI_TEMPERATURE=0.1
VESSEL_OPENAI_MAX_TOKENS=10000
TOKEN_CACHE_MINUTES=20
TOKEN_REQUEST_TIMEOUT_SECONDS=30
LLM_REQUEST_TIMEOUT_SECONDS=60
APP_DATA_DIR=data
CHAT_CONTEXT_FILE=data/chat_context.jsonl
API_RESPONSE_ARCHIVE_FILE=data/api_response_archive.jsonl
ANALYTICS_HUB_SNAPSHOT_FILE=data/analytics_hub_snapshot.json
ANALYTICS_HUB_TABLE_CACHE_FILE=data/analytics_hub_tables.jsonl
TOOL_CATALOG_INDEX_FILE=data/tool_catalog_index.jsonl
CHAT_RECENT_LIMIT=10
CHAT_CONTEXT_MESSAGE_LIMIT=6
CHAT_CONTEXT_PROMPT_CHAR_LIMIT=2500
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
CORS_ALLOW_METHODS=GET,POST,PATCH,DELETE,OPTIONS
CORS_ALLOW_HEADERS=*
```

Notes:

- `AWS_ACCOUNT__<KEY>__ACCOUNT_ID` is optional. If omitted, the app resolves it with STS `GetCallerIdentity`.
- Accounts missing `ACCESS_KEY_ID` or `SECRET_ACCESS_KEY` are ignored unless `AWS_ACCOUNT__<KEY>__SECRET_ID` is set.
- If `AWS_ACCOUNT__<KEY>__SECRET_ID` is set, the backend reads account credentials from AWS Secrets Manager. The secret value must be JSON with `access_key_id` and `secret_access_key`; optional keys are `session_token`, `region`, and `account_id`.
- The backend process role or host credentials must have `secretsmanager:GetSecretValue` for every configured account secret.
- `AWS_ACCOUNT_KEYS` can include accounts other than the account where this app is deployed. For example, if the app is deployed in the `dev` AWS account, it can still query `prod` as long as `AWS_ACCOUNT_KEYS=dev,prod` and both account credential blocks are present in `.env`.
- If `account_keys` is omitted in a request body, the API queries all configured accounts.
- Default region is `us-east-1`.
- `APP_DATA_DIR` is the simplest way to move JSON/JSONL cache files onto persistent storage in deployed environments.
- `API_RESPONSE_ARCHIVE_FILE` overrides only the AWS archive JSONL path when you need separate control.
- `ANALYTICS_HUB_SNAPSHOT_FILE` is the materialized dashboard snapshot returned immediately on page load.
- `ANALYTICS_HUB_TABLE_CACHE_FILE` is append-only JSONL history for table refreshes. Refreshing one dashboard table appends one record for that table and merges only that table into the materialized snapshot.
- `TOOL_CATALOG_INDEX_FILE` stores the local JSONL semantic index for AWS tool routing. The backend rebuilds it from the tool catalog on startup.
- `CORS_ALLOWED_ORIGINS` should contain the frontend origin in local development and in deployed environments when frontend and backend are on different domains.
- If frontend and backend are served from the same origin through a reverse proxy, CORS may not be needed, but the current backend supports explicit origins for both local and deployed setups.
- `VESSEL_OPENAI_ENGINE` is read from `.env` so you can switch models later without code changes.
- `TOKEN_URL` can keep `grant_type=client_credentials` in the query string. The backend sends only VOX basic auth plus that URL to obtain the token.
- `VESSEL_OPENAI_PAYLOAD_MODE=model_messages` is the right setting for the Pfizer gateways shown so far, including `.../chatCompletion` and `.../vox-genai-api/completions`.
- `TOKEN_CACHE_MINUTES=20` is the fallback token reuse window when the VOX OAuth response does not include a usable `expires_in`.
- The backend reuses the cached token until it is near expiry instead of regenerating it on every LLM request.
- The LLM payload is controlled by `VESSEL_OPENAI_PAYLOAD_MODE`: `model_messages` sends `{"model": "...", "messages": [...]}`, while `engine_prompt` sends `{"engine": "...", "prompt": "..."}`.
- `CHAT_RECENT_LIMIT=10` means only the 10 most recently updated chats keep full messages.
- `CHAT_CONTEXT_MESSAGE_LIMIT=6` means only the most recent 6 messages from the active chat are added as prompt memory.
- `CHAT_CONTEXT_PROMPT_CHAR_LIMIT=2500` caps chat memory size before it is sent to the LLM.

## AWS Deployment

This app can be deployed in one AWS account and still query other AWS accounts.

Example:

- deploy the app in `dev`
- keep `AWS_ACCOUNT_KEYS=dev,prod`
- include both `AWS_ACCOUNT__DEV__...` and `AWS_ACCOUNT__PROD__...` variables in the backend `.env`
- the backend will use the configured credentials for each selected account independently

Recommended deployment shape:

1. Deploy the frontend as static files on S3 + CloudFront or AWS Amplify Hosting.
2. Deploy the backend on ECS/Fargate, ECS/EC2, or EC2 behind an Application Load Balancer.
3. Mount persistent storage for JSONL files and point the backend to it with environment variables.
4. Set the frontend `VITE_API_BASE_URL` to the public backend URL.
5. Set `CORS_ALLOWED_ORIGINS` on the backend to the frontend URL when frontend and backend use different origins.

JSONL persistence on AWS:

- this app can continue using JSONL after deployment
- do not keep JSONL only inside an ephemeral container filesystem if you want data to survive task restarts or deployments
- mount persistent storage such as Amazon EFS to the backend container or instance

Analytics Hub refresh model:

- `GET /api/v1/aws/analytics-hub/snapshot` returns the stored snapshot without calling AWS. This makes the dashboard landing page fast.
- `POST /api/v1/aws/analytics-hub/refresh` accepts `{"table_key":"all"}` for a full refresh.
- Table refresh buttons send one of `financial`, `accounts`, `certificates`, `utilization`, or `idle`; only that table's AWS APIs are called and only that section is merged into the snapshot.
- ECS utilization uses AWS ECS APIs plus CloudWatch `AWS/ECS` CPU and memory metrics when available. If metrics are absent, it falls back to running-vs-desired task percentage.
- Idle resource detection uses AWS EC2 inventory plus CloudWatch `AWS/EC2` CPU and network metrics, then stores findings and implications in the Analytics Hub JSONL table cache.
- then point these environment variables to that mounted path

Example deployed backend environment:

```env
AWS_ACCOUNT_KEYS=dev,prod

AWS_ACCOUNT__DEV__ACCESS_KEY_ID=...
AWS_ACCOUNT__DEV__SECRET_ACCESS_KEY=...
AWS_ACCOUNT__DEV__REGION=us-east-1

AWS_ACCOUNT__PROD__ACCESS_KEY_ID=...
AWS_ACCOUNT__PROD__SECRET_ACCESS_KEY=...
AWS_ACCOUNT__PROD__REGION=us-east-1

APP_DATA_DIR=/mnt/app-data/aws-insights
CHAT_CONTEXT_FILE=/mnt/app-data/aws-insights/chat_context.jsonl
API_RESPONSE_ARCHIVE_FILE=/mnt/app-data/aws-insights/api_response_archive.jsonl

CORS_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

If you run more than one backend instance:

- JSONL files should still live on shared persistent storage
- operationally, the safest setup is a single backend writer instance unless you explicitly validate multi-writer behavior on the shared filesystem

If you run one backend instance with persistent mounted storage, JSONL behavior will remain closest to local development.

Helpful AWS references:

- CloudFront secure static website: https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/getting-started-secure-static-website-cloudformation-template.html
- ECS task definition parameters: https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_definition_parameters-managed-instances.html
- Amazon EFS volumes for ECS tasks: https://docs.aws.amazon.com/AmazonECS/latest/developerguide/efs-volumes.html

## API Endpoints

Base path: `/api/v1/aws`

### `GET /accounts`

Returns configured accounts after resolving each account id.

### `POST /cost-breakdown`

Returns top AWS services by unblended cost for each selected account.

```json
{
  "account_keys": ["dev", "prod"],
  "days": 30,
  "top_n": 5
}
```

### `POST /total-cost`

Returns total cost plus service totals for each selected account.

```json
{
  "account_keys": ["dev"],
  "days": 30
}
```

### `POST /service-costs`

Returns service-level costs for each selected account.

```json
{
  "account_keys": ["dev", "prod"],
  "days": 90
}
```

### `POST /trends-forecast`

Returns monthly actual spend, forecast, and simple anomaly detection for each selected account.

```json
{
  "account_keys": ["dev"],
  "days": 180
}
```

### `POST /budget`

Returns AWS budget utilization for each selected account.

```json
{
  "account_keys": ["dev"],
  "days": 30,
  "budget_name": "MonthlyBudget"
}
```

### `POST /resource-cost`

Returns cost for a specific Cost Explorer `RESOURCE_ID`.

```json
{
  "account_keys": ["dev"],
  "days": 30,
  "resource_id": "i-0123456789abcdef0"
}
```

### `POST /ec2/idle-check`

Checks whether EC2 instances appear idle based on CloudWatch CPU and network averages.

```json
{
  "account_keys": ["dev", "prod"],
  "days": 30,
  "instance_ids": ["i-0123456789abcdef0"],
  "idle_days": 14,
  "cpu_threshold": 1.0,
  "network_threshold_bytes": 102400
}
```

Base path: `/api/v1/llm`

### `POST /answer`

Generates or reuses a cached VOX access token, sends the prompt to the configured Vessel OpenAI gateway, and returns a concise answer.

```json
{
  "query": "What is the total AWS cost for the dev account?",
  "context": "The dev account total AWS cost for the last 30 days is 120.50 USD."
}
```

Response:

```json
{
  "answer": "The total AWS cost for the dev account is 120.50 USD.",
  "prompt": "Answer the question using the context below.\n\nContext:\nThe dev account total AWS cost for the last 30 days is 120.50 USD.\n\nQuestion:\nWhat is the total AWS cost for the dev account?\n\nProvide a concise answer.\nIf you don't find the info in the context, do not guess.\nSay that the info is not found in the document.",
  "engine": "gpt-4o-mini",
  "provider_request_id": "optional-request-id"
}
```

If token generation or the LLM call fails, the API returns an HTTP error with a structured `detail` object so the frontend can identify whether the failure came from `token_generation` or `llm_call`.

### `GET /health-check`

Reuses the cached token when it is still valid, otherwise generates a new one from `TOKEN_URL`, returns the access token, and sends a minimal prompt to the configured Vessel OpenAI gateway so you can verify both token generation and LLM connectivity.

Response:

```json
{
  "status": "ok",
  "message": "Token generation and downstream LLM call both succeeded.",
  "access_token": "eyJhbGciOi...",
  "token_type": "Bearer",
  "expires_at": "2026-03-23T12:34:56.000000+00:00",
  "token_provider_status_code": 200,
  "llm_provider_status_code": 200,
  "engine": "gpt-4o-mini",
  "llm_answer": "HEALTHCHECK_OK",
  "prompt": "Reply with HEALTHCHECK_OK only.",
  "payload_mode": "model_messages",
  "request_payload": {
    "model": "gpt-4o-mini",
    "messages": [
      {
        "role": "user",
        "content": "Reply with HEALTHCHECK_OK only."
      }
    ]
  },
  "token_cache_source": "cache",
  "provider_request_id": "optional-request-id"
}
```

This endpoint returns the full access token intentionally for debugging, so it should only be used in trusted environments. It also shows whether the token came from `self._token_payload` cache and the exact downstream JSON payload used.

Base path: `/api/v1`

### `POST /chats/{chat_id}/stream`

Streams the assistant response using Server-Sent Events. This is the main endpoint used by the frontend chat app.

Event types:

- `start`
- `delta`
- `final`
- `error`

### `POST /chats/{chat_id}/messages/{user_message_id}/rerun/stream`

Streams a regenerated assistant response after the user edits a previous prompt.

## Request Defaults And Limits

- `days`: default `180`, min `1`, max `365`
- `top_n`: default `5`, min `1`, max `50`
- `idle_days`: default `14`, min `1`, max `90`
- `cpu_threshold`: default `1.0`
- `network_threshold_bytes`: default `102400`

## Response Shape

Every multi-account POST endpoint returns this top-level structure:

```json
{
  "requested_accounts": ["dev", "prod"],
  "succeeded_accounts": [
    {
      "account_key": "dev",
      "account_id": "123456789012",
      "data": {}
    }
  ],
  "failed_accounts": [
    {
      "account_key": "prod",
      "account_id": "210987654321",
      "error": "Access denied"
    }
  ]
}
```

`GET /accounts` returns:

```json
{
  "accounts": [
    {
      "account_key": "dev",
      "account_id": "123456789012",
      "region": "us-east-1"
    }
  ]
}
```

## Response Archive

Every AWS API call is written to:

```text
data/api_response_archive.jsonl
```

Each line is one JSON object:

```json
{
  "recorded_at_utc": "2026-03-13T10:20:30.000000+00:00",
  "endpoint": "/api/v1/aws/cost-breakdown",
  "request_payload": {
    "account_keys": ["dev", "prod"],
    "days": 30,
    "top_n": 5
  },
  "requested_accounts": ["dev", "prod"],
  "account_results": [
    {
      "account_key": "dev",
      "account_id": "123456789012",
      "status": "success",
      "data": {
        "total_cost": 100.25,
        "breakdown": []
      }
    },
    {
      "account_key": "prod",
      "account_id": "210987654321",
      "status": "failed",
      "error": "Access denied"
    }
  ]
}
```

The archive keeps only the 2 most recent records for each endpoint, so you can compare recent runs without letting the file grow indefinitely.

Chat-triggered AWS tool calls also write their fresh live results into this same archive. During chat, the backend can show a provisional answer from the latest matching archived record while the live AWS refresh is still running, then replace it with the refreshed answer when the live call completes.

For later follow-up questions in the same chat, the backend now prefers the latest successful session dataset and avoids a new AWS call unless the follow-up changes scope, changes tool, or explicitly asks for refresh.

## Chat Context Storage

Chat history is written to:

```text
data/chat_context.jsonl
```

What each chat record stores:

- chat metadata
- full messages for the 10 most recent chats
- `summary_text` for older compacted chats

This chat context is used as part of the effective LLM context together with:

- current user prompt
- tool catalog
- recent AWS archive data if relevant
- live AWS data

## Tool Routing

Chat tool selection uses a local semantic router before the LLM planner fallback:

```text
final_score = 0.55 * semantic similarity + 0.25 * deterministic trigger score + 0.20 * entity score
```

The semantic index is written as JSONL at `TOOL_CATALOG_INDEX_FILE`. If `faiss-cpu` is installed, the backend uses a FAISS `IndexFlatIP` index for vector search. If FAISS is unavailable on the host, routing falls back to the same normalized cosine scoring in Python so the app still runs.

The catalog includes tools for accounts, cost breakdown, total cost, service costs, trends/forecast, budgets, resource cost, idle resources, specific EC2 idle checks, certificate expiry, and ECS insights.

For a step-by-step explanation of how the user prompt is processed and how the streamed response is created, see:

```text
CHAT_DATA_FLOW.md
```
