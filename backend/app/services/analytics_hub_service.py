from __future__ import annotations

import asyncio
import json
import logging
from threading import Lock
from typing import Any

from app.core.config import settings
from app.schemas.aws import AnalyticsHubSnapshot
from app.services.aws_service import AwsInsightsService, get_aws_insights_service


logger = logging.getLogger(__name__)


class AnalyticsHubSnapshotService:
    def __init__(
        self,
        snapshot_path: str | None = None,
        aws_service: AwsInsightsService | None = None,
    ) -> None:
        self.snapshot_path = settings.resolve_path(snapshot_path or settings.analytics_hub_snapshot_file)
        self.snapshot_path.parent.mkdir(parents=True, exist_ok=True)
        self.table_cache_path = settings.resolve_path(settings.analytics_hub_table_cache_file)
        self.table_cache_path.parent.mkdir(parents=True, exist_ok=True)
        self.aws_service = aws_service or get_aws_insights_service()
        self._file_lock = Lock()
        self._refresh_lock = asyncio.Lock()
        self._refresh_task: asyncio.Task[None] | None = None

    def get_snapshot(self) -> dict[str, Any]:
        if not self.snapshot_path.exists():
            return AnalyticsHubSnapshot().model_dump()

        with self._file_lock:
            try:
                raw = self.snapshot_path.read_text(encoding="utf-8")
            except FileNotFoundError:
                return AnalyticsHubSnapshot().model_dump()

        if not raw.strip():
            return AnalyticsHubSnapshot().model_dump()

        return AnalyticsHubSnapshot.model_validate_json(raw).model_dump()

    def is_refresh_in_progress(self) -> bool:
        task = self._refresh_task
        return task is not None and not task.done()

    def queue_refresh(self, table_key: str = "all") -> bool:
        if self.is_refresh_in_progress():
            return False

        self._refresh_task = asyncio.create_task(self._refresh_snapshot(table_key))
        return True

    async def _refresh_snapshot(self, table_key: str) -> None:
        async with self._refresh_lock:
            try:
                normalized_table_key = table_key.strip().lower() if table_key else "all"
                if normalized_table_key == "all":
                    snapshot = await self.aws_service.build_analytics_hub_snapshot()
                else:
                    table_snapshot = await self.aws_service.build_analytics_hub_table_snapshot(normalized_table_key)
                    snapshot = self._merge_table_snapshot(
                        current=self.get_snapshot(),
                        table_snapshot=table_snapshot,
                        table_key=normalized_table_key,
                    )
                payload_model = AnalyticsHubSnapshot.model_validate(snapshot)
                payload = payload_model.model_dump_json(indent=2)
                with self._file_lock:
                    self.snapshot_path.write_text(payload, encoding="utf-8")
                    self._append_table_cache_record(
                        table_key=normalized_table_key,
                        snapshot=payload_model.model_dump(),
                    )
            except Exception:
                logger.exception("Analytics Hub snapshot refresh failed")

    def _merge_table_snapshot(
        self,
        *,
        current: dict[str, Any],
        table_snapshot: dict[str, Any],
        table_key: str,
    ) -> dict[str, Any]:
        field_names = self._table_fields(table_key)
        existing_accounts = {
            account.get("account_key"): self._normalized_account(account)
            for account in current.get("accounts", [])
            if isinstance(account, dict) and account.get("account_key")
        }

        for partial in table_snapshot.get("accounts", []):
            if not isinstance(partial, dict):
                continue
            account_key = partial.get("account_key")
            if not isinstance(account_key, str):
                continue
            merged_account = existing_accounts.get(account_key, self._empty_account(partial))
            merged_account.update(
                {
                    "account_key": account_key,
                    "account_id": partial.get("account_id") or merged_account.get("account_id") or "",
                    "region": partial.get("region") or merged_account.get("region") or "",
                }
            )
            for field_name in field_names:
                if field_name in partial:
                    merged_account[field_name] = partial[field_name]
            existing_accounts[account_key] = self._normalized_account(merged_account)

        errors = [
            error
            for error in current.get("errors", [])
            if isinstance(error, dict) and error.get("table_key") not in {table_key}
        ]
        errors.extend(table_snapshot.get("errors", []))

        accounts = list(existing_accounts.values())
        return {
            "generated_at_utc": table_snapshot.get("generated_at_utc"),
            "account_count": len(accounts),
            "accounts": accounts,
            "errors": errors,
        }

    def _append_table_cache_record(self, *, table_key: str, snapshot: dict[str, Any]) -> None:
        record = {
            "table_key": table_key,
            "generated_at_utc": snapshot.get("generated_at_utc"),
            "account_count": snapshot.get("account_count", 0),
            "accounts": snapshot.get("accounts", []),
            "errors": snapshot.get("errors", []),
        }
        with self.table_cache_path.open("a", encoding="utf-8") as file_obj:
            file_obj.write(json.dumps(record, separators=(",", ":")) + "\n")

    @staticmethod
    def _table_fields(table_key: str) -> set[str]:
        return {
            "accounts": {"project_name", "project_owner"},
            "financial": {"total_cost_30d", "service_spend_30d", "monthly_cost_trend", "project_name", "project_owner"},
            "certificates": {"expiring_certificates"},
            "utilization": {"ecs_clusters", "utilization_resources"},
            "idle": {"idle_resources"},
        }.get(table_key, set())

    def _empty_account(self, account: dict[str, Any]) -> dict[str, Any]:
        return self._normalized_account(
            {
                "account_key": account.get("account_key", ""),
                "account_id": account.get("account_id", ""),
                "region": account.get("region", ""),
            }
        )

    @staticmethod
    def _normalized_account(account: dict[str, Any]) -> dict[str, Any]:
        return {
            "account_key": account.get("account_key") or "",
            "account_id": account.get("account_id") or "",
            "region": account.get("region") or "",
            "project_name": account.get("project_name"),
            "project_owner": account.get("project_owner"),
            "total_cost_30d": float(account.get("total_cost_30d") or 0),
            "service_spend_30d": account.get("service_spend_30d") or [],
            "monthly_cost_trend": account.get("monthly_cost_trend") or [],
            "expiring_certificates": account.get("expiring_certificates") or [],
            "ecs_clusters": account.get("ecs_clusters") or [],
            "utilization_resources": account.get("utilization_resources") or [],
            "idle_resources": account.get("idle_resources") or [],
        }


_analytics_snapshot_service: AnalyticsHubSnapshotService | None = None


def get_analytics_hub_snapshot_service() -> AnalyticsHubSnapshotService:
    global _analytics_snapshot_service
    if _analytics_snapshot_service is None:
        _analytics_snapshot_service = AnalyticsHubSnapshotService()
    return _analytics_snapshot_service
