from __future__ import annotations

import asyncio
import json
import logging
from threading import Lock
from typing import Any

from app.core.config import settings
from app.schemas.aws import AnalyticsHubSnapshot
from app.services.analytics_sqlite_service import AnalyticsSqliteService, get_analytics_sqlite_service
from app.services.aws_service import AwsInsightsService, get_aws_insights_service


logger = logging.getLogger(__name__)


class AnalyticsHubSnapshotService:
    def __init__(
        self,
        snapshot_path: str | None = None,
        aws_service: AwsInsightsService | None = None,
        sqlite_service: AnalyticsSqliteService | None = None,
    ) -> None:
        self.snapshot_path = settings.resolve_path(snapshot_path or settings.analytics_hub_snapshot_file)
        self.snapshot_path.parent.mkdir(parents=True, exist_ok=True)
        self.table_cache_path = settings.resolve_path(settings.analytics_hub_table_cache_file)
        self.table_cache_path.parent.mkdir(parents=True, exist_ok=True)
        self.aws_service = aws_service or get_aws_insights_service()
        self.sqlite_service = sqlite_service or get_analytics_sqlite_service()
        self._file_lock = Lock()
        self._refresh_lock = asyncio.Lock()
        self._refresh_task: asyncio.Task[None] | None = None
        self._startup_task: asyncio.Task[None] | None = None
        self._periodic_task: asyncio.Task[None] | None = None
        self._snapshot_cache: dict[str, Any] | None = None
        self._snapshot_cache_mtime_ns: int | None = None
        self.sqlite_service.initialize()

    def get_snapshot(self) -> dict[str, Any]:
        configured_account_keys = self._configured_account_keys()
        sqlite_snapshot = self.sqlite_service.read_latest_snapshot(account_keys=configured_account_keys)
        if sqlite_snapshot is not None and sqlite_snapshot.get("accounts"):
            return sqlite_snapshot

        cached_snapshot = self._get_cached_snapshot()
        if cached_snapshot is not None:
            logger.info("Analytics Hub using JSON snapshot cache after SQLite miss.")
            return cached_snapshot

        raw = self._read_snapshot_file()
        if raw is None or not raw.strip():
            logger.info("Analytics Hub JSON snapshot missing; hydrating from JSONL table cache.")
            return self._snapshot_from_table_cache()

        try:
            snapshot = AnalyticsHubSnapshot.model_validate_json(raw).model_dump()
        except ValueError:
            logger.warning("Analytics Hub snapshot file is invalid; rebuilding view from table cache.")
            return self._snapshot_from_table_cache()
        if snapshot.get("accounts"):
            self._set_snapshot_cache(snapshot)
            self._upsert_sqlite_snapshot(snapshot)
            return snapshot
        cached_snapshot = self._snapshot_from_table_cache()
        return cached_snapshot if cached_snapshot.get("accounts") else snapshot

    def is_refresh_in_progress(self) -> bool:
        return any(
            task is not None and not task.done()
            for task in (self._refresh_task, self._startup_task)
        )

    def queue_refresh(self, table_key: str = "all", account_keys: list[str] | None = None) -> bool:
        if self.is_refresh_in_progress():
            return False

        self._refresh_task = asyncio.create_task(self._refresh_snapshot(table_key, account_keys=account_keys))
        return True

    def start_background_maintenance(self) -> None:
        self.sqlite_service.initialize()
        if self._startup_task is None or self._startup_task.done():
            self._startup_task = asyncio.create_task(self._bootstrap_missing_accounts())
        if settings.analytics_hub_refresh_interval_minutes > 0 and (
            self._periodic_task is None or self._periodic_task.done()
        ):
            self._periodic_task = asyncio.create_task(self._periodic_refresh_loop())

    async def _bootstrap_missing_accounts(self) -> None:
        try:
            connected_accounts = self.aws_service.list_accounts()
        except Exception:
            logger.exception("Unable to confirm configured AWS accounts during Analytics Hub startup.")
            return
        connected_account_keys = [account.account_key for account in connected_accounts]
        if not connected_account_keys:
            return
        self.sqlite_service.prune_to_account_keys(connected_account_keys)
        self._hydrate_sqlite_from_existing_cache(account_keys=connected_account_keys)

        snapshot = self.get_snapshot()
        snapshot = self._prune_snapshot_to_accounts(snapshot, set(connected_account_keys))
        cached_account_keys = {
            account.get("account_key")
            for account in snapshot.get("accounts", [])
            if isinstance(account, dict) and self._account_has_cached_data(account)
        }
        missing_account_keys = [
            account_key
            for account_key in connected_account_keys
            if account_key not in cached_account_keys
        ]
        if missing_account_keys:
            logger.info(
                "Analytics Hub cache missing data for account(s): %s. Starting immediate background fetch.",
                ", ".join(missing_account_keys),
            )
            await self._refresh_snapshot("all", account_keys=missing_account_keys)

    def _prune_snapshot_to_accounts(self, snapshot: dict[str, Any], connected_account_keys: set[str]) -> dict[str, Any]:
        accounts = [
            account
            for account in snapshot.get("accounts", [])
            if isinstance(account, dict) and account.get("account_key") in connected_account_keys
        ]
        if len(accounts) == len(snapshot.get("accounts", [])):
            return snapshot
        pruned_snapshot = {
            **snapshot,
            "account_count": len(accounts),
            "accounts": accounts,
            "errors": [
                error
                for error in snapshot.get("errors", [])
                if isinstance(error, dict) and error.get("account_key") in connected_account_keys
            ],
        }
        payload_model = AnalyticsHubSnapshot.model_validate(pruned_snapshot)
        payload = payload_model.model_dump()
        self._write_snapshot(payload)
        self.sqlite_service.prune_to_account_keys(list(connected_account_keys))
        return payload

    async def _periodic_refresh_loop(self) -> None:
        interval_seconds = max(60, settings.analytics_hub_refresh_interval_minutes * 60)
        while True:
            await asyncio.sleep(interval_seconds)
            if self.is_refresh_in_progress():
                continue
            self._refresh_task = asyncio.create_task(self._refresh_snapshot("all"))

    async def _refresh_snapshot(self, table_key: str, account_keys: list[str] | None = None) -> None:
        async with self._refresh_lock:
            normalized_table_key = table_key.strip().lower() if table_key else "all"
            run_id = self.sqlite_service.start_refresh_run(
                normalized_table_key,
                account_key=",".join(account_keys) if account_keys else None,
            )
            try:
                if normalized_table_key == "all" and account_keys is None:
                    snapshot = await self.aws_service.build_analytics_hub_snapshot()
                else:
                    table_snapshot = await self.aws_service.build_analytics_hub_table_snapshot(
                        normalized_table_key,
                        account_keys=account_keys,
                    )
                    snapshot = self._merge_table_snapshot(
                        current=self.get_snapshot(),
                        table_snapshot=table_snapshot,
                        table_key=normalized_table_key,
                    )
                payload_model = AnalyticsHubSnapshot.model_validate(snapshot)
                payload = payload_model.model_dump()
                with self._file_lock:
                    self._write_snapshot_unlocked(payload)
                    self._append_table_cache_record(
                        table_key=normalized_table_key,
                        snapshot=payload,
                        account_keys=account_keys,
                    )
                self._upsert_sqlite_snapshot(payload)
                self.sqlite_service.finish_refresh_run(run_id, status="success")
            except Exception:
                logger.exception("Analytics Hub snapshot refresh failed")
                self.sqlite_service.finish_refresh_run(run_id, status="failed", error="Analytics Hub snapshot refresh failed")

    def get_storage_status(self) -> dict[str, Any]:
        return self.sqlite_service.storage_status(
            json_snapshot_exists=self.snapshot_path.exists(),
            jsonl_table_cache_exists=self.table_cache_path.exists(),
        )

    def _upsert_sqlite_snapshot(self, snapshot: dict[str, Any]) -> None:
        try:
            self.sqlite_service.upsert_snapshot(snapshot)
        except Exception:
            logger.exception("Analytics Hub SQLite write failed; JSON/JSONL cache remains available.")

    def _hydrate_sqlite_from_existing_cache(self, account_keys: list[str] | None = None) -> None:
        try:
            counts = self.sqlite_service.table_counts()
            if counts.get("aws_accounts", 0) > 0:
                return
            raw = self._read_snapshot_file()
            snapshot: dict[str, Any] | None = None
            if raw and raw.strip():
                try:
                    snapshot = AnalyticsHubSnapshot.model_validate_json(raw).model_dump()
                except ValueError:
                    snapshot = None
            if snapshot is None or not snapshot.get("accounts"):
                snapshot = self._snapshot_from_table_cache()
            if account_keys:
                snapshot = self._prune_snapshot_view(snapshot, set(account_keys))
            if snapshot.get("accounts"):
                self.sqlite_service.upsert_snapshot(snapshot)
                logger.info("Analytics SQLite hydrated from existing JSON/JSONL Analytics Hub cache.")
        except Exception:
            logger.exception("Analytics SQLite hydration from JSON/JSONL cache failed.")

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

    def _configured_account_keys(self) -> list[str]:
        return list(self.aws_service.accounts.keys())

    def _prune_snapshot_view(self, snapshot: dict[str, Any], connected_account_keys: set[str]) -> dict[str, Any]:
        accounts = [
            account
            for account in snapshot.get("accounts", [])
            if isinstance(account, dict) and account.get("account_key") in connected_account_keys
        ]
        return {
            **snapshot,
            "account_count": len(accounts),
            "accounts": accounts,
            "errors": [
                error
                for error in snapshot.get("errors", [])
                if isinstance(error, dict) and error.get("account_key") in connected_account_keys
            ],
        }

    def _append_table_cache_record(
        self,
        *,
        table_key: str,
        snapshot: dict[str, Any],
        account_keys: list[str] | None = None,
    ) -> None:
        record = {
            "table_key": table_key,
            "generated_at_utc": snapshot.get("generated_at_utc"),
            "account_count": snapshot.get("account_count", 0),
            "account_keys": account_keys or [
                account.get("account_key")
                for account in snapshot.get("accounts", [])
                if isinstance(account, dict) and account.get("account_key")
            ],
            "accounts": snapshot.get("accounts", []),
            "errors": snapshot.get("errors", []),
        }
        with self.table_cache_path.open("a", encoding="utf-8") as file_obj:
            file_obj.write(json.dumps(record, separators=(",", ":")) + "\n")

    def _get_cached_snapshot(self) -> dict[str, Any] | None:
        cached_snapshot = self._snapshot_cache
        if cached_snapshot is None or self._snapshot_cache_mtime_ns is None:
            return None
        try:
            current_mtime_ns = self.snapshot_path.stat().st_mtime_ns
        except FileNotFoundError:
            return None
        if current_mtime_ns != self._snapshot_cache_mtime_ns:
            return None
        return cached_snapshot

    def _set_snapshot_cache(self, snapshot: dict[str, Any]) -> None:
        try:
            self._snapshot_cache_mtime_ns = self.snapshot_path.stat().st_mtime_ns
        except FileNotFoundError:
            self._snapshot_cache_mtime_ns = None
        self._snapshot_cache = snapshot

    def _read_snapshot_file(self) -> str | None:
        if not self.snapshot_path.exists():
            return None
        with self._file_lock:
            try:
                return self.snapshot_path.read_text(encoding="utf-8")
            except FileNotFoundError:
                return None

    def _write_snapshot(self, snapshot: dict[str, Any]) -> None:
        with self._file_lock:
            self._write_snapshot_unlocked(snapshot)

    def _write_snapshot_unlocked(self, snapshot: dict[str, Any]) -> None:
        payload_model = AnalyticsHubSnapshot.model_validate(snapshot)
        payload_json = payload_model.model_dump_json(indent=2)
        temp_path = self.snapshot_path.with_suffix(f"{self.snapshot_path.suffix}.tmp")
        temp_path.write_text(payload_json, encoding="utf-8")
        temp_path.replace(self.snapshot_path)
        self._snapshot_cache = payload_model.model_dump()
        self._snapshot_cache_mtime_ns = self.snapshot_path.stat().st_mtime_ns

    @staticmethod
    def _table_fields(table_key: str) -> set[str]:
        return {
            "accounts": {"project_name", "project_owner"},
            "financial": {"total_cost_30d", "service_spend_30d", "monthly_cost_trend", "project_name", "project_owner"},
            "certificates": {"expiring_certificates"},
            "utilization": {"ecs_clusters", "utilization_resources"},
            "idle": {"idle_resources"},
            "all": {
                "project_name",
                "project_owner",
                "total_cost_30d",
                "service_spend_30d",
                "monthly_cost_trend",
                "expiring_certificates",
                "ecs_clusters",
                "utilization_resources",
                "idle_resources",
            },
        }.get(table_key, set())

    def _snapshot_from_table_cache(self) -> dict[str, Any]:
        if not self.table_cache_path.exists():
            return AnalyticsHubSnapshot().model_dump()

        snapshot = AnalyticsHubSnapshot().model_dump()
        lines = self._read_recent_table_cache_lines()

        for line in lines:
            if not line.strip():
                continue
            try:
                record = json.loads(line)
            except json.JSONDecodeError:
                continue
            if not isinstance(record, dict):
                continue
            table_key = str(record.get("table_key") or "all").strip().lower()
            table_snapshot = {
                "generated_at_utc": record.get("generated_at_utc"),
                "account_count": record.get("account_count", 0),
                "accounts": record.get("accounts", []),
                "errors": record.get("errors", []),
            }
            snapshot = self._merge_table_snapshot(
                current=snapshot,
                table_snapshot=table_snapshot,
                table_key=table_key,
            )

        payload_model = AnalyticsHubSnapshot.model_validate(snapshot)
        payload = payload_model.model_dump()
        if payload.get("accounts"):
            self._write_snapshot(payload)
            self._upsert_sqlite_snapshot(payload)
        return payload

    def _read_recent_table_cache_lines(self) -> list[str]:
        max_records = max(1, settings.analytics_hub_table_cache_max_records)
        with self._file_lock:
            try:
                lines = self.table_cache_path.read_text(encoding="utf-8").splitlines()
            except FileNotFoundError:
                return []
        return lines[-max_records:]

    @staticmethod
    def _account_has_cached_data(account: dict[str, Any]) -> bool:
        if float(account.get("total_cost_30d") or 0) > 0:
            return True
        for field_name in (
            "service_spend_30d",
            "monthly_cost_trend",
            "expiring_certificates",
            "ecs_clusters",
            "utilization_resources",
            "idle_resources",
        ):
            value = account.get(field_name)
            if isinstance(value, list) and value:
                return True
        return bool(account.get("project_name") or account.get("project_owner"))

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
