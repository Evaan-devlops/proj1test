from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path
from threading import Lock
from typing import Any


class ApiResponseArchiveService:
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
        succeeded_accounts = response_payload.get("succeeded_accounts", [])
        failed_accounts = response_payload.get("failed_accounts", [])
        account_results = []

        for account in succeeded_accounts:
            account_results.append(
                {
                    "account_key": account.get("account_key"),
                    "account_id": account.get("account_id"),
                    "status": "success",
                    "data": account.get("data"),
                }
            )

        for account in failed_accounts:
            account_results.append(
                {
                    "account_key": account.get("account_key"),
                    "account_id": account.get("account_id"),
                    "status": "failed",
                    "error": account.get("error"),
                }
            )

        record = {
            "recorded_at_utc": datetime.now(UTC).isoformat(),
            "endpoint": endpoint,
            "request_payload": request_payload or {},
            "requested_accounts": response_payload.get("requested_accounts", []),
            "account_results": account_results,
        }

        with self._lock:
            with self.archive_path.open("a", encoding="utf-8") as archive_file:
                archive_file.write(json.dumps(record, ensure_ascii=True))
                archive_file.write("\n")
