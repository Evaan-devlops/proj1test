# AWS Insights API

FastAPI service for querying AWS cost, budget, forecast, resource, and EC2 idle insights across one or more configured AWS accounts.

## Features

- Multi-account AWS support via `.env` aliases such as `dev` and `prod`
- Cost Explorer endpoints for total cost, service costs, top service breakdown, trends, and forecast
- AWS Budgets lookup by budget name
- Resource-level cost lookup by Cost Explorer `RESOURCE_ID`
- EC2 idle detection using CloudWatch CPU and network metrics
- Append-only JSONL archive of every API response for later analysis or RAG ingestion

## Requirements

- Python 3.12+
- AWS credentials for each configured account
- Access to the AWS APIs used by this app:
  - Cost Explorer
  - Budgets
  - CloudWatch
  - STS

## Setup

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
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

## Configuration

AWS accounts are loaded from `.env` using `AWS_ACCOUNT_KEYS`.

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
AWS_ACCOUNT__PROD__ACCOUNT_ID=210987654321
```

Notes:

- `AWS_ACCOUNT__<KEY>__ACCOUNT_ID` is optional. If omitted, the app resolves it with STS `GetCallerIdentity`.
- Accounts missing `ACCESS_KEY_ID` or `SECRET_ACCESS_KEY` are ignored.
- If `account_keys` is omitted in a request body, the API queries all configured accounts.
- Default region is `us-east-1`.

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

Every API call is appended to:

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

The archive is append-only and intended to be a stable JSONL source for downstream ingestion.
