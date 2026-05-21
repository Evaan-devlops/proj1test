from __future__ import annotations

import json
import logging
import sqlite3
from contextlib import contextmanager
from datetime import UTC, datetime
from pathlib import Path
from threading import Lock
from typing import Any, Iterator

from app.core.config import settings
from app.schemas.aws import AnalyticsHubSnapshot


logger = logging.getLogger(__name__)


TABLE_NAMES = (
    "aws_accounts",
    "analytics_snapshots",
    "certificates",
    "utilization_findings",
    "idle_resources",
    "financial_service_spend",
    "priority_findings",
    "refresh_runs",
)


class AnalyticsSqliteService:
    def __init__(self, db_file: str | Path | None = None) -> None:
        self.db_path = settings.resolve_path(db_file or settings.analytics_sqlite_db_file)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = Lock()
        self._initialized = False
        self._snapshot_cache: dict[tuple[str, ...], tuple[str, dict[str, Any]]] = {}
        self._table_counts_cache: tuple[str, dict[str, int]] | None = None

    def initialize(self) -> None:
        try:
            with self._connect() as connection:
                connection.execute("PRAGMA journal_mode=WAL")
                connection.execute("PRAGMA synchronous=NORMAL")
                self._create_schema(connection)
            self._initialized = True
            logger.info("Analytics SQLite storage initialized at %s", self.db_path)
        except Exception:
            self._initialized = False
            logger.exception("Analytics SQLite initialization failed")

    def ensure_initialized(self) -> bool:
        if not self._initialized:
            self.initialize()
        return self._initialized

    def upsert_snapshot(self, snapshot: dict[str, Any], *, snapshot_key: str = "analytics_hub") -> None:
        if not self.ensure_initialized():
            return
        try:
            payload = AnalyticsHubSnapshot.model_validate(snapshot).model_dump()
            now = self._now()
            with self._lock, self._connect() as connection:
                account_keys = [
                    account.get("account_key")
                    for account in payload.get("accounts", [])
                    if account.get("account_key")
                ]
                self._prune_missing_accounts(connection, account_keys)
                for account in payload.get("accounts", []):
                    self._upsert_account(connection, account, now)
                    self._insert_snapshot_record(connection, snapshot_key, account, now)
                    self._replace_account_certificates(connection, account, now)
                    self._replace_account_utilization(connection, account, now)
                    self._replace_account_idle_resources(connection, account, now)
                    self._replace_account_financial_spend(connection, account, now)
                    self._replace_account_priority_findings(connection, account, now)
                connection.commit()
                self._invalidate_caches_unlocked()
            logger.info("Analytics SQLite table counts after snapshot write: %s", self.table_counts())
        except Exception:
            logger.exception("Analytics SQLite snapshot write failed; continuing with JSON/JSONL cache.")

    def read_latest_snapshot(self, account_keys: list[str] | None = None) -> dict[str, Any] | None:
        if not self.ensure_initialized():
            return None
        try:
            with self._connect() as connection:
                version = self._accounts_version(connection, account_keys)
                cache_key = tuple(sorted(account_keys or ()))
                cached = self._snapshot_cache.get(cache_key)
                if cached is not None and cached[0] == version:
                    return cached[1]
                if account_keys:
                    placeholders = ",".join("?" for _ in account_keys)
                    rows = connection.execute(
                        f"""
                        SELECT raw_json, updated_at
                        FROM aws_accounts
                        WHERE account_key IN ({placeholders})
                        ORDER BY account_key
                        """,
                        account_keys,
                    ).fetchall()
                else:
                    rows = connection.execute(
                        "SELECT raw_json, updated_at FROM aws_accounts ORDER BY account_key"
                    ).fetchall()
            accounts: list[dict[str, Any]] = []
            updated_at_values: list[str] = []
            for row in rows:
                raw_json = row["raw_json"]
                if not raw_json:
                    continue
                try:
                    account = json.loads(raw_json)
                except json.JSONDecodeError:
                    continue
                if isinstance(account, dict):
                    accounts.append(account)
                    if row["updated_at"]:
                        updated_at_values.append(str(row["updated_at"]))
            if not accounts:
                logger.info("Analytics SQLite has no usable snapshot rows; using JSONL fallback.")
                return None
            snapshot = {
                "generated_at_utc": max(updated_at_values) if updated_at_values else self._now(),
                "account_count": len(accounts),
                "accounts": accounts,
                "errors": [],
            }
            payload = AnalyticsHubSnapshot.model_validate(snapshot).model_dump()
            self._snapshot_cache[cache_key] = (version, payload)
            return payload
        except Exception:
            logger.exception("Analytics SQLite snapshot read failed; using JSONL fallback.")
            return None

    def prune_to_account_keys(self, account_keys: list[str]) -> None:
        if not account_keys or not self.ensure_initialized():
            return
        try:
            with self._lock, self._connect() as connection:
                self._prune_missing_accounts(connection, account_keys)
                placeholders = ",".join("?" for _ in account_keys)
                connection.execute(
                    f"DELETE FROM analytics_snapshots WHERE account_key NOT IN ({placeholders})",
                    account_keys,
                )
                connection.commit()
                self._invalidate_caches_unlocked()
            logger.info("Analytics SQLite pruned to configured account keys: %s", ", ".join(account_keys))
        except Exception:
            logger.exception("Analytics SQLite account pruning failed.")

    def start_refresh_run(self, table_key: str, account_key: str | None = None) -> int | None:
        if not self.ensure_initialized():
            return None
        try:
            now = self._now()
            with self._lock, self._connect() as connection:
                cursor = connection.execute(
                    """
                    INSERT INTO refresh_runs(table_key, account_key, status, started_at, finished_at, error)
                    VALUES (?, ?, ?, ?, NULL, NULL)
                    """,
                    (table_key, account_key, "running", now),
                )
                connection.commit()
                self._table_counts_cache = None
                return int(cursor.lastrowid)
        except Exception:
            logger.exception("Analytics SQLite refresh run start failed.")
            return None

    def finish_refresh_run(self, run_id: int | None, *, status: str, error: str | None = None) -> None:
        if run_id is None or not self.ensure_initialized():
            return
        try:
            with self._lock, self._connect() as connection:
                connection.execute(
                    """
                    UPDATE refresh_runs
                    SET status = ?, finished_at = ?, error = ?
                    WHERE id = ?
                    """,
                    (status, self._now(), error, run_id),
                )
                connection.commit()
                self._table_counts_cache = None
            logger.info("Analytics SQLite refresh run %s finished with status=%s", run_id, status)
        except Exception:
            logger.exception("Analytics SQLite refresh run finish failed.")

    def table_counts(self) -> dict[str, int]:
        if not self.ensure_initialized():
            return {table_name: 0 for table_name in TABLE_NAMES}
        try:
            with self._connect() as connection:
                version = self._storage_version(connection)
                if self._table_counts_cache is not None and self._table_counts_cache[0] == version:
                    return self._table_counts_cache[1]
                counts = {
                    table_name: int(connection.execute(f"SELECT COUNT(*) AS count FROM {table_name}").fetchone()["count"])
                    for table_name in TABLE_NAMES
                }
                self._table_counts_cache = (version, counts)
                return counts
        except Exception:
            logger.exception("Analytics SQLite table count read failed.")
            return {table_name: 0 for table_name in TABLE_NAMES}

    def last_refresh_run(self) -> dict[str, Any] | None:
        if not self.ensure_initialized():
            return None
        try:
            with self._connect() as connection:
                row = connection.execute(
                    """
                    SELECT id, table_key, account_key, status, started_at, finished_at, error
                    FROM refresh_runs
                    ORDER BY id DESC
                    LIMIT 1
                    """
                ).fetchone()
            return dict(row) if row is not None else None
        except Exception:
            logger.exception("Analytics SQLite last refresh run read failed.")
            return None

    def storage_status(self, *, json_snapshot_exists: bool, jsonl_table_cache_exists: bool) -> dict[str, Any]:
        counts = self.table_counts()
        has_sqlite_data = any(
            counts.get(table_name, 0) > 0
            for table_name in (
                "aws_accounts",
                "certificates",
                "utilization_findings",
                "idle_resources",
                "financial_service_spend",
                "priority_findings",
            )
        )
        return {
            "sqlite_enabled": True,
            "db_connected": self.ensure_initialized(),
            "db_file": str(self.db_path),
            "db_exists": self.db_path.exists(),
            "table_counts": counts,
            "last_refresh_run": self.last_refresh_run(),
            "json_snapshot_exists": json_snapshot_exists,
            "jsonl_table_cache_exists": jsonl_table_cache_exists,
            "active_storage_source": "sqlite" if has_sqlite_data else "jsonl_fallback",
            "portable_mode": True,
            "portable_note": "SQLite is embedded in backend/data; copy the data folder with the code. No external database server or manual restart is required.",
        }

    @contextmanager
    def _connect(self) -> Iterator[sqlite3.Connection]:
        connection = sqlite3.connect(self.db_path, timeout=10)
        connection.row_factory = sqlite3.Row
        try:
            connection.execute("PRAGMA busy_timeout=10000")
            connection.execute("PRAGMA foreign_keys=ON")
            yield connection
        finally:
            connection.close()

    def _create_schema(self, connection: sqlite3.Connection) -> None:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS aws_accounts (
                account_key TEXT PRIMARY KEY,
                account_id TEXT,
                region TEXT,
                project_name TEXT,
                owner TEXT,
                raw_json TEXT,
                updated_at TEXT
            );

            CREATE TABLE IF NOT EXISTS analytics_snapshots (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                snapshot_key TEXT,
                account_key TEXT,
                account_id TEXT,
                region TEXT,
                raw_json TEXT,
                created_at TEXT
            );

            CREATE TABLE IF NOT EXISTS certificates (
                certificate_arn TEXT PRIMARY KEY,
                account_key TEXT,
                account_id TEXT,
                region TEXT,
                domain_name TEXT,
                status TEXT,
                expires_at TEXT,
                days_to_expiry INTEGER,
                risk TEXT,
                in_use_by_json TEXT,
                renewal_type TEXT,
                recommended_action TEXT,
                raw_json TEXT,
                updated_at TEXT
            );

            CREATE TABLE IF NOT EXISTS utilization_findings (
                id TEXT PRIMARY KEY,
                account_key TEXT,
                account_id TEXT,
                region TEXT,
                resource_type TEXT,
                resource_id TEXT,
                resource_name TEXT,
                finding TEXT,
                severity TEXT,
                reason TEXT,
                current_config_json TEXT,
                recommended_config_json TEXT,
                metrics_json TEXT,
                suggested_action TEXT,
                source TEXT,
                raw_json TEXT,
                updated_at TEXT
            );

            CREATE TABLE IF NOT EXISTS idle_resources (
                id TEXT PRIMARY KEY,
                account_key TEXT,
                account_id TEXT,
                region TEXT,
                resource_type TEXT,
                resource_id TEXT,
                resource_name TEXT,
                reason TEXT,
                estimated_monthly_saving REAL,
                raw_json TEXT,
                updated_at TEXT
            );

            CREATE TABLE IF NOT EXISTS financial_service_spend (
                id TEXT PRIMARY KEY,
                account_key TEXT,
                account_id TEXT,
                region TEXT,
                service_name TEXT,
                amount REAL,
                currency TEXT,
                period_start TEXT,
                period_end TEXT,
                raw_json TEXT,
                updated_at TEXT
            );

            CREATE TABLE IF NOT EXISTS priority_findings (
                id TEXT PRIMARY KEY,
                source TEXT,
                account_key TEXT,
                account_id TEXT,
                region TEXT,
                resource_type TEXT,
                resource_id TEXT,
                title TEXT,
                severity TEXT,
                score INTEGER,
                impact_type TEXT,
                impact_text TEXT,
                evidence_json TEXT,
                recommended_action TEXT,
                estimated_monthly_saving REAL,
                days_remaining INTEGER,
                raw_json TEXT,
                updated_at TEXT
            );

            CREATE TABLE IF NOT EXISTS refresh_runs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                table_key TEXT,
                account_key TEXT,
                status TEXT,
                started_at TEXT,
                finished_at TEXT,
                error TEXT
            );

            CREATE INDEX IF NOT EXISTS idx_certificates_account_expiry
                ON certificates(account_key, days_to_expiry);
            CREATE INDEX IF NOT EXISTS idx_certificates_risk
                ON certificates(risk);
            CREATE INDEX IF NOT EXISTS idx_utilization_account_severity
                ON utilization_findings(account_key, severity);
            CREATE INDEX IF NOT EXISTS idx_utilization_type_finding
                ON utilization_findings(resource_type, finding);
            CREATE INDEX IF NOT EXISTS idx_idle_account_saving
                ON idle_resources(account_key, estimated_monthly_saving);
            CREATE INDEX IF NOT EXISTS idx_financial_account_service
                ON financial_service_spend(account_key, service_name);
            CREATE INDEX IF NOT EXISTS idx_priority_score
                ON priority_findings(score);
            CREATE INDEX IF NOT EXISTS idx_priority_account_severity
                ON priority_findings(account_key, severity);
            CREATE INDEX IF NOT EXISTS idx_refresh_table_account
                ON refresh_runs(table_key, account_key);
            """
        )
        connection.commit()

    def _invalidate_caches_unlocked(self) -> None:
        self._snapshot_cache.clear()
        self._table_counts_cache = None

    def _storage_version(self, connection: sqlite3.Connection) -> str:
        values = []
        for table_name in TABLE_NAMES:
            row = connection.execute(
                f"SELECT COUNT(*) AS count, COALESCE(MAX(rowid), 0) AS max_rowid FROM {table_name}"
            ).fetchone()
            values.append(f"{table_name}:{row['count']}:{row['max_rowid']}")
        return "|".join(values)

    def _accounts_version(self, connection: sqlite3.Connection, account_keys: list[str] | None) -> str:
        if account_keys:
            placeholders = ",".join("?" for _ in account_keys)
            row = connection.execute(
                f"""
                SELECT COUNT(*) AS count, COALESCE(MAX(updated_at), '') AS max_updated_at
                FROM aws_accounts
                WHERE account_key IN ({placeholders})
                """,
                account_keys,
            ).fetchone()
        else:
            row = connection.execute(
                """
                SELECT COUNT(*) AS count, COALESCE(MAX(updated_at), '') AS max_updated_at
                FROM aws_accounts
                """
            ).fetchone()
        return f"{row['count']}:{row['max_updated_at']}"

    def _upsert_account(self, connection: sqlite3.Connection, account: dict[str, Any], now: str) -> None:
        connection.execute(
            """
            INSERT INTO aws_accounts(account_key, account_id, region, project_name, owner, raw_json, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(account_key) DO UPDATE SET
                account_id = excluded.account_id,
                region = excluded.region,
                project_name = excluded.project_name,
                owner = excluded.owner,
                raw_json = excluded.raw_json,
                updated_at = excluded.updated_at
            """,
            (
                account.get("account_key"),
                account.get("account_id"),
                account.get("region"),
                account.get("project_name"),
                account.get("project_owner"),
                self._json(account),
                now,
            ),
        )

    def _prune_missing_accounts(self, connection: sqlite3.Connection, account_keys: list[str]) -> None:
        if not account_keys:
            return
        placeholders = ",".join("?" for _ in account_keys)
        for table_name in (
            "aws_accounts",
            "certificates",
            "utilization_findings",
            "idle_resources",
            "financial_service_spend",
            "priority_findings",
        ):
            connection.execute(
                f"DELETE FROM {table_name} WHERE account_key NOT IN ({placeholders})",
                account_keys,
            )

    def _insert_snapshot_record(
        self,
        connection: sqlite3.Connection,
        snapshot_key: str,
        account: dict[str, Any],
        now: str,
    ) -> None:
        connection.execute(
            """
            INSERT INTO analytics_snapshots(snapshot_key, account_key, account_id, region, raw_json, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                snapshot_key,
                account.get("account_key"),
                account.get("account_id"),
                account.get("region"),
                self._json(account),
                now,
            ),
        )

    def _replace_account_certificates(self, connection: sqlite3.Connection, account: dict[str, Any], now: str) -> None:
        account_key = account.get("account_key")
        connection.execute("DELETE FROM certificates WHERE account_key = ?", (account_key,))
        for certificate in account.get("expiring_certificates") or []:
            days_to_expiry = int(certificate.get("days_to_expiry") or 0)
            connection.execute(
                """
                INSERT OR REPLACE INTO certificates(
                    certificate_arn, account_key, account_id, region, domain_name, status,
                    expires_at, days_to_expiry, risk, in_use_by_json, renewal_type,
                    recommended_action, raw_json, updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    certificate.get("certificate_arn"),
                    account_key,
                    account.get("account_id"),
                    account.get("region"),
                    certificate.get("domain_name"),
                    certificate.get("status"),
                    certificate.get("expiry_date"),
                    days_to_expiry,
                    self._certificate_risk(days_to_expiry),
                    self._json(certificate.get("in_use_by") or []),
                    certificate.get("renewal_type") or certificate.get("renewal_eligibility"),
                    self._certificate_action(days_to_expiry),
                    self._json(certificate),
                    now,
                ),
            )

    def _replace_account_utilization(self, connection: sqlite3.Connection, account: dict[str, Any], now: str) -> None:
        account_key = account.get("account_key")
        connection.execute("DELETE FROM utilization_findings WHERE account_key = ?", (account_key,))
        for resource in account.get("utilization_resources") or []:
            resource_id = resource.get("resource_id") or resource.get("resource_name") or resource.get("source")
            row_id = self._row_id(account_key, resource.get("resource_type"), resource_id)
            connection.execute(
                """
                INSERT OR REPLACE INTO utilization_findings(
                    id, account_key, account_id, region, resource_type, resource_id, resource_name,
                    finding, severity, reason, current_config_json, recommended_config_json,
                    metrics_json, suggested_action, source, raw_json, updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    row_id,
                    account_key,
                    account.get("account_id"),
                    resource.get("region") or account.get("region"),
                    resource.get("resource_type"),
                    resource_id,
                    resource.get("resource_name"),
                    resource.get("finding") or resource.get("utilization_status"),
                    resource.get("severity"),
                    resource.get("reason"),
                    self._json(resource.get("current_configuration") or {}),
                    self._json(resource.get("recommended_configuration")),
                    self._json(resource.get("metrics") or {}),
                    resource.get("suggested_action"),
                    resource.get("source"),
                    self._json(resource),
                    now,
                ),
            )

    def _replace_account_idle_resources(self, connection: sqlite3.Connection, account: dict[str, Any], now: str) -> None:
        account_key = account.get("account_key")
        connection.execute("DELETE FROM idle_resources WHERE account_key = ?", (account_key,))
        for resource in account.get("idle_resources") or []:
            resource_id = resource.get("resource_id") or resource.get("name")
            row_id = self._row_id(account_key, resource.get("resource_type"), resource_id)
            connection.execute(
                """
                INSERT OR REPLACE INTO idle_resources(
                    id, account_key, account_id, region, resource_type, resource_id,
                    resource_name, reason, estimated_monthly_saving, raw_json, updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    row_id,
                    account_key,
                    account.get("account_id"),
                    resource.get("region") or account.get("region"),
                    resource.get("resource_type"),
                    resource_id,
                    resource.get("name"),
                    resource.get("finding") or resource.get("signal") or resource.get("implication"),
                    resource.get("estimated_monthly_waste"),
                    self._json(resource),
                    now,
                ),
            )

    def _replace_account_financial_spend(self, connection: sqlite3.Connection, account: dict[str, Any], now: str) -> None:
        account_key = account.get("account_key")
        connection.execute("DELETE FROM financial_service_spend WHERE account_key = ?", (account_key,))
        for item in account.get("service_spend_30d") or []:
            service_name = item.get("service")
            row_id = self._row_id(account_key, "service_spend_30d", service_name)
            connection.execute(
                """
                INSERT OR REPLACE INTO financial_service_spend(
                    id, account_key, account_id, region, service_name, amount, currency,
                    period_start, period_end, raw_json, updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    row_id,
                    account_key,
                    account.get("account_id"),
                    account.get("region"),
                    service_name,
                    float(item.get("cost") or 0),
                    item.get("currency") or "USD",
                    item.get("period_start") or "last_30_days",
                    item.get("period_end") or now,
                    self._json(item),
                    now,
                ),
            )

    def _replace_account_priority_findings(self, connection: sqlite3.Connection, account: dict[str, Any], now: str) -> None:
        account_key = account.get("account_key")
        connection.execute("DELETE FROM priority_findings WHERE account_key = ?", (account_key,))
        for finding in self._priority_findings_for_account(account):
            connection.execute(
                """
                INSERT OR REPLACE INTO priority_findings(
                    id, source, account_key, account_id, region, resource_type, resource_id,
                    title, severity, score, impact_type, impact_text, evidence_json,
                    recommended_action, estimated_monthly_saving, days_remaining, raw_json, updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    finding["id"],
                    finding["source"],
                    account_key,
                    account.get("account_id"),
                    finding["region"],
                    finding["resource_type"],
                    finding["resource_id"],
                    finding["title"],
                    finding["severity"],
                    finding["score"],
                    finding["impact_type"],
                    finding["impact_text"],
                    self._json(finding["evidence"]),
                    finding["recommended_action"],
                    finding.get("estimated_monthly_saving"),
                    finding.get("days_remaining"),
                    self._json(finding["raw"]),
                    now,
                ),
            )

    def _priority_findings_for_account(self, account: dict[str, Any]) -> list[dict[str, Any]]:
        findings: list[dict[str, Any]] = []
        account_key = account.get("account_key")
        region = account.get("region") or ""
        for certificate in account.get("expiring_certificates") or []:
            days = int(certificate.get("days_to_expiry") or 0)
            severity = self._certificate_severity(days)
            findings.append(
                {
                    "id": self._row_id(account_key, "certificate", certificate.get("certificate_arn")),
                    "source": "certificate",
                    "region": region,
                    "resource_type": "ACM certificate",
                    "resource_id": certificate.get("certificate_arn"),
                    "title": certificate.get("domain_name") or "Certificate expiry",
                    "severity": severity,
                    "score": self._priority_score(severity, impact_type="outage", days_remaining=days),
                    "impact_type": "outage" if days <= 30 else "operational",
                    "impact_text": f"Certificate expires in {days} day{'s' if days != 1 else ''}.",
                    "evidence": [f"expiry_date={certificate.get('expiry_date')}", f"days_to_expiry={days}"],
                    "recommended_action": self._certificate_action(days),
                    "days_remaining": days,
                    "raw": certificate,
                }
            )
        for resource in account.get("utilization_resources") or []:
            status = str(resource.get("utilization_status") or "")
            if status == "balanced" and resource.get("severity") == "ok":
                continue
            severity = self._ops_severity(resource.get("severity"), high_when=status == "overused")
            findings.append(
                {
                    "id": self._row_id(account_key, "utilization", resource.get("resource_id")),
                    "source": "utilization",
                    "region": resource.get("region") or region,
                    "resource_type": resource.get("resource_type"),
                    "resource_id": resource.get("resource_id"),
                    "title": resource.get("resource_name") or resource.get("resource_id") or "Utilization finding",
                    "severity": severity,
                    "score": self._priority_score(
                        severity,
                        impact_type="performance" if status == "overused" else "cost",
                        estimated_monthly_saving=75 if status == "underused" else None,
                    ),
                    "impact_type": "performance" if status == "overused" else "cost",
                    "impact_text": resource.get("reason") or resource.get("finding") or status,
                    "evidence": [
                        str(resource.get("finding") or ""),
                        str(resource.get("reason") or ""),
                    ],
                    "recommended_action": resource.get("suggested_action") or "",
                    "estimated_monthly_saving": 75 if status == "underused" else None,
                    "raw": resource,
                }
            )
        for resource in account.get("idle_resources") or []:
            severity = self._ops_severity(resource.get("severity"))
            savings = resource.get("estimated_monthly_waste")
            findings.append(
                {
                    "id": self._row_id(account_key, "idle", resource.get("resource_id")),
                    "source": "idle",
                    "region": resource.get("region") or region,
                    "resource_type": resource.get("resource_type"),
                    "resource_id": resource.get("resource_id"),
                    "title": resource.get("name") or resource.get("resource_id") or "Idle resource",
                    "severity": severity,
                    "score": self._priority_score(severity, impact_type="cost", estimated_monthly_saving=savings),
                    "impact_type": "cost",
                    "impact_text": resource.get("implication") or resource.get("finding") or "",
                    "evidence": [
                        str(resource.get("finding") or ""),
                        str(resource.get("signal") or ""),
                    ],
                    "recommended_action": resource.get("suggested_action") or "",
                    "estimated_monthly_saving": savings,
                    "raw": resource,
                }
            )
        return findings

    @staticmethod
    def _now() -> str:
        return datetime.now(UTC).isoformat()

    @staticmethod
    def _json(value: Any) -> str:
        return json.dumps(value, separators=(",", ":"), default=str)

    @staticmethod
    def _row_id(*parts: Any) -> str:
        return "::".join(str(part or "-") for part in parts)

    @staticmethod
    def _certificate_risk(days_to_expiry: int) -> str:
        if days_to_expiry <= 7:
            return "critical"
        if days_to_expiry <= 15:
            return "high"
        if days_to_expiry <= 30:
            return "medium"
        if days_to_expiry <= 60:
            return "low"
        return "healthy"

    def _certificate_severity(self, days_to_expiry: int) -> str:
        risk = self._certificate_risk(days_to_expiry)
        return "info" if risk == "healthy" else risk

    @staticmethod
    def _certificate_action(days_to_expiry: int) -> str:
        if days_to_expiry <= 30:
            return "Confirm certificate owner, ACM renewal eligibility, DNS validation, and attached services."
        return "Keep certificate on the renewal watch list and verify ownership before the next review."

    @staticmethod
    def _ops_severity(severity: Any, *, high_when: bool = False) -> str:
        if severity == "critical":
            return "critical"
        if high_when:
            return "high"
        if severity == "warning":
            return "medium"
        return "info"

    @staticmethod
    def _priority_score(
        severity: str,
        *,
        impact_type: str,
        estimated_monthly_saving: float | None = None,
        days_remaining: int | None = None,
    ) -> int:
        score = {
            "critical": 100,
            "high": 75,
            "medium": 45,
            "low": 20,
            "info": 5,
        }.get(severity, 5)
        if impact_type == "outage":
            score += 20
        if impact_type == "security":
            score += 15
        if days_remaining is not None and days_remaining <= 7:
            score += 10
        if estimated_monthly_saving is not None and estimated_monthly_saving > 50:
            score += 10
        return score


_analytics_sqlite_service: AnalyticsSqliteService | None = None


def get_analytics_sqlite_service() -> AnalyticsSqliteService:
    global _analytics_sqlite_service
    if _analytics_sqlite_service is None:
        _analytics_sqlite_service = AnalyticsSqliteService()
    return _analytics_sqlite_service
