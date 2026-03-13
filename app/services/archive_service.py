from __future__ import annotations

import json
from collections.abc import Mapping
from datetime import UTC, datetime
from pathlib import Path
from threading import Lock
from typing import Any
from uuid import uuid4


class ApiResponseArchiveService:
    schema_version = "2026-03-13"

    def __init__(self, archive_path: str = "data/api_response_archive.jsonl") -> None:
        self.archive_path = Path(archive_path)
        self.archive_path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = Lock()

    def append_record(
        self,
        *,
        endpoint: str,
        request_payload: dict[str, Any] | None,
        response_payload: dict[str, Any],
    ) -> None:
        normalized_request = self._normalize_request_payload(request_payload)
        requested_accounts = self._extract_requested_accounts(response_payload, normalized_request)
        account_results = self._build_account_results(endpoint, response_payload)
        summary = self._build_summary(endpoint, requested_accounts, account_results)
        facets = self._build_facets(endpoint, normalized_request, requested_accounts, account_results)
        record = {
            "schema_version": self.schema_version,
            "record_id": str(uuid4()),
            "recorded_at_utc": datetime.now(UTC).isoformat(),
            "endpoint": endpoint,
            "request_payload": normalized_request,
            "requested_accounts": requested_accounts,
            "account_results": account_results,
            "summary": summary,
            "facets": facets,
            "rag_text": self._build_rag_text(
                endpoint=endpoint,
                requested_accounts=requested_accounts,
                normalized_request=normalized_request,
                account_results=account_results,
                summary=summary,
            ),
        }

        with self._lock:
            with self.archive_path.open("a", encoding="utf-8") as archive_file:
                archive_file.write(
                    json.dumps(
                        record,
                        ensure_ascii=True,
                        separators=(",", ":"),
                        sort_keys=True,
                    )
                )
                archive_file.write("\n")

    def _normalize_request_payload(self, request_payload: dict[str, Any] | None) -> dict[str, Any]:
        if not request_payload:
            return {}
        return {
            key: value
            for key, value in request_payload.items()
            if value is not None
        }

    def _extract_requested_accounts(
        self,
        response_payload: dict[str, Any],
        request_payload: dict[str, Any],
    ) -> list[str]:
        requested_accounts = response_payload.get("requested_accounts")
        if isinstance(requested_accounts, list):
            return requested_accounts

        account_keys = request_payload.get("account_keys")
        if isinstance(account_keys, list):
            return account_keys

        return []

    def _build_account_results(
        self,
        endpoint: str,
        response_payload: dict[str, Any],
    ) -> list[dict[str, Any]]:
        account_results = []

        for account in response_payload.get("succeeded_accounts", []):
            data = account.get("data", {})
            account_results.append(
                {
                    "account_key": account.get("account_key"),
                    "account_id": account.get("account_id"),
                    "status": "success",
                    "data": data,
                    "summary_text": self._account_summary_text(endpoint, account, data),
                }
            )

        for account in response_payload.get("failed_accounts", []):
            account_results.append(
                {
                    "account_key": account.get("account_key"),
                    "account_id": account.get("account_id"),
                    "status": "failed",
                    "error": account.get("error"),
                    "summary_text": self._error_summary_text(account),
                }
            )

        if endpoint.endswith("/accounts"):
            for account in response_payload.get("accounts", []):
                account_results.append(
                    {
                        "account_key": account.get("account_key"),
                        "account_id": account.get("account_id"),
                        "status": "success",
                        "data": account,
                        "summary_text": (
                            f"Account {account.get('account_key')} resolved to "
                            f"{account.get('account_id')} in region {account.get('region')}."
                        ),
                    }
                )

        return account_results

    def _build_summary(
        self,
        endpoint: str,
        requested_accounts: list[str],
        account_results: list[dict[str, Any]],
    ) -> dict[str, Any]:
        succeeded = [item for item in account_results if item.get("status") == "success"]
        failed = [item for item in account_results if item.get("status") == "failed"]

        return {
            "endpoint_type": endpoint.removeprefix("/api/v1/aws/"),
            "requested_account_count": len(requested_accounts),
            "success_count": len(succeeded),
            "failure_count": len(failed),
            "successful_accounts": [item.get("account_key") for item in succeeded if item.get("account_key")],
            "failed_accounts": [item.get("account_key") for item in failed if item.get("account_key")],
        }

    def _build_facets(
        self,
        endpoint: str,
        request_payload: dict[str, Any],
        requested_accounts: list[str],
        account_results: list[dict[str, Any]],
    ) -> dict[str, Any]:
        success_count = sum(1 for item in account_results if item.get("status") == "success")
        failure_count = sum(1 for item in account_results if item.get("status") == "failed")

        return {
            "endpoint_type": endpoint.removeprefix("/api/v1/aws/"),
            "days": request_payload.get("days"),
            "top_n": request_payload.get("top_n"),
            "budget_name": request_payload.get("budget_name"),
            "resource_id": request_payload.get("resource_id"),
            "instance_ids": request_payload.get("instance_ids", []),
            "idle_days": request_payload.get("idle_days"),
            "account_count": len(requested_accounts),
            "success_count": success_count,
            "failure_count": failure_count,
        }

    def _build_rag_text(
        self,
        *,
        endpoint: str,
        requested_accounts: list[str],
        normalized_request: dict[str, Any],
        account_results: list[dict[str, Any]],
        summary: dict[str, Any],
    ) -> str:
        request_bits = []
        if "days" in normalized_request:
            request_bits.append(f"days={normalized_request['days']}")
        if "top_n" in normalized_request:
            request_bits.append(f"top_n={normalized_request['top_n']}")
        if "budget_name" in normalized_request:
            request_bits.append(f"budget_name={normalized_request['budget_name']}")
        if "resource_id" in normalized_request:
            request_bits.append(f"resource_id={normalized_request['resource_id']}")
        if "instance_ids" in normalized_request:
            request_bits.append(f"instance_ids={','.join(normalized_request['instance_ids'])}")
        if "idle_days" in normalized_request:
            request_bits.append(f"idle_days={normalized_request['idle_days']}")

        account_summaries = [
            item["summary_text"]
            for item in account_results
            if item.get("summary_text")
        ]

        parts = [
            f"Endpoint {endpoint}.",
            (
                "Requested accounts: "
                f"{', '.join(requested_accounts) if requested_accounts else 'all configured accounts'}."
            ),
            (
                "Request parameters: "
                f"{'; '.join(request_bits)}."
                if request_bits
                else "Request parameters: none."
            ),
            (
                f"Successes: {summary['success_count']}. Failures: {summary['failure_count']}."
            ),
        ]
        parts.extend(account_summaries)
        return " ".join(parts)

    def _account_summary_text(
        self,
        endpoint: str,
        account: Mapping[str, Any],
        data: Mapping[str, Any],
    ) -> str:
        account_key = account.get("account_key")
        account_id = account.get("account_id")
        endpoint_type = endpoint.removeprefix("/api/v1/aws/")

        if endpoint_type == "cost-breakdown":
            total_cost = data.get("total_cost")
            breakdown = data.get("breakdown", [])
            top_services = ", ".join(
                f"{item.get('service')}={item.get('cost')}"
                for item in breakdown[:3]
            )
            return (
                f"Account {account_key} ({account_id}) cost breakdown total_cost={total_cost}. "
                f"Top services: {top_services or 'none'}."
            )

        if endpoint_type == "total-cost":
            total_cost = data.get("total_cost")
            service_costs = data.get("service_costs", {})
            top_services = self._top_mapping_items(service_costs)
            return (
                f"Account {account_key} ({account_id}) total AWS cost={total_cost}. "
                f"Largest services: {top_services or 'none'}."
            )

        if endpoint_type == "service-costs":
            service_costs = data.get("service_costs", {})
            top_services = self._top_mapping_items(service_costs)
            return (
                f"Account {account_key} ({account_id}) service costs. "
                f"Largest services: {top_services or 'none'}."
            )

        if endpoint_type == "trends-forecast":
            actual = data.get("actual", [])
            forecast = data.get("forecast", [])
            anomalies = data.get("anomalies", [])
            latest_actual = actual[-1] if actual else {}
            latest_forecast = forecast[-1] if forecast else {}
            return (
                f"Account {account_key} ({account_id}) trends and forecast. "
                f"Latest actual={latest_actual.get('cost')} for {latest_actual.get('month')}. "
                f"Latest forecast={latest_forecast.get('projected_cost')} for {latest_forecast.get('month')}. "
                f"Anomaly count={len(anomalies)}."
            )

        if endpoint_type == "budget":
            return (
                f"Account {account_key} ({account_id}) budget {data.get('budget_name')} "
                f"limit={data.get('limit')} actual_spent={data.get('actual_spent')} "
                f"utilization_pct={data.get('utilization_pct')}."
            )

        if endpoint_type == "resource-cost":
            return (
                f"Account {account_key} ({account_id}) resource {data.get('resource_id')} "
                f"total_cost={data.get('total_cost')}."
            )

        if endpoint_type == "ec2/idle-check":
            instances = data.get("instances", [])
            idle_instances = [item.get("instance_id") for item in instances if item.get("idle")]
            return (
                f"Account {account_key} ({account_id}) EC2 idle check across {len(instances)} instances. "
                f"Idle instances: {', '.join(idle_instances) if idle_instances else 'none'}."
            )

        return f"Account {account_key} ({account_id}) returned data for {endpoint_type}."

    def _error_summary_text(self, account: Mapping[str, Any]) -> str:
        return (
            f"Account {account.get('account_key')} ({account.get('account_id')}) failed with error: "
            f"{account.get('error')}."
        )

    def _top_mapping_items(self, values: Any, top_n: int = 3) -> str:
        if not isinstance(values, Mapping):
            return ""

        sorted_items = sorted(
            (
                (str(key), value)
                for key, value in values.items()
                if isinstance(value, int | float)
            ),
            key=lambda item: item[1],
            reverse=True,
        )
        return ", ".join(f"{key}={round(value, 2)}" for key, value in sorted_items[:top_n])
