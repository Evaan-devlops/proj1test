# AWS Insights API

## Run

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload
```

Swagger UI:

```text
http://127.0.0.1:8000/docs
```

## Response archive for future RAG

Every API hit is appended to:

```text
data/api_response_archive.jsonl
```

Format:

```json
{
  "recorded_at_utc": "2026-03-13T10:20:30.000000+00:00",
  "endpoint": "/api/v1/aws/cost-breakdown",
  "request_payload": {
    "account_keys": ["dev"],
    "days": 30,
    "top_n": 5
  },
  "response_payload": {
    "requested_accounts": ["dev"],
    "succeeded_accounts": [],
    "failed_accounts": []
  }
}
```

This file is append-only. Each new API response is written as one new JSON line so future agentic RAG pipelines can process it incrementally.

## .env format

Use one alias per AWS account.

```env
AWS_ACCOUNT_KEYS=dev,prod

AWS_ACCOUNT__DEV__ACCOUNT_ID=123456789012
AWS_ACCOUNT__DEV__ACCESS_KEY_ID=...
AWS_ACCOUNT__DEV__SECRET_ACCESS_KEY=...
AWS_ACCOUNT__DEV__SESSION_TOKEN=...
AWS_ACCOUNT__DEV__REGION=us-east-1
```

If you only have one account, keep just one alias in `AWS_ACCOUNT_KEYS`.

## Request examples

List configured accounts:

```http
GET /api/v1/aws/accounts
```

Cost breakdown for one account:

```json
{
  "account_keys": ["dev"],
  "days": 30,
  "top_n": 5
}
```

Cost breakdown for multiple accounts:

```json
{
  "account_keys": ["dev", "prod"],
  "days": 90,
  "top_n": 10
}
```

Budget request:

```json
{
  "account_keys": ["dev"],
  "days": 30,
  "budget_name": "MonthlyBudget"
}
```

EC2 idle check:

```json
{
  "account_keys": ["dev", "prod"],
  "instance_ids": ["i-0123456789abcdef0"],
  "idle_days": 14,
  "cpu_threshold": 1.0,
  "network_threshold_bytes": 102400
}
```

## Swagger output shape

Every POST endpoint returns:

- `requested_accounts`: account aliases requested by frontend
- `succeeded_accounts`: list of successful account responses
- `failed_accounts`: list of account-level AWS errors

Each item in `succeeded_accounts` contains:

- `account_key`
- `account_id`
- `data`
