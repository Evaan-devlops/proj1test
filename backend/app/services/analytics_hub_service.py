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

    def queue_refresh(self) -> bool:
        if self.is_refresh_in_progress():
            return False

        self._refresh_task = asyncio.create_task(self._refresh_snapshot())
        return True

    async def _refresh_snapshot(self) -> None:
        async with self._refresh_lock:
            try:
                snapshot = await self.aws_service.build_analytics_hub_snapshot()
                payload = AnalyticsHubSnapshot.model_validate(snapshot).model_dump_json(indent=2)
                with self._file_lock:
                    self.snapshot_path.write_text(payload, encoding="utf-8")
            except Exception:
                logger.exception("Analytics Hub snapshot refresh failed")


_analytics_snapshot_service: AnalyticsHubSnapshotService | None = None


def get_analytics_hub_snapshot_service() -> AnalyticsHubSnapshotService:
    global _analytics_snapshot_service
    if _analytics_snapshot_service is None:
        _analytics_snapshot_service = AnalyticsHubSnapshotService()
    return _analytics_snapshot_service
