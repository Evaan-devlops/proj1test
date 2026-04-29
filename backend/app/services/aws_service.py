from __future__ import annotations

import asyncio
import logging
import re
from collections import Counter
from dataclasses import replace
from datetime import UTC, date, datetime, timedelta
from functools import lru_cache
from threading import Lock
from typing import Any, Callable

from botocore.exceptions import BotoCoreError, ClientError
from fastapi import HTTPException

from app.core.config import AwsAccountConfig, settings
from app.schemas.aws import (
    AccountError,
    AccountListItem,
    AccountSuccess,
    AwsAccountsRequest,
    BudgetRequest,
    CostBreakdownRequest,
    Ec2IdleRequest,
    EcsInsightRequest,
    IdleStatusItem,
    ResourceCostRequest,
)
from app.services.aws_clients import AwsClientFactory


logger = logging.getLogger(__name__)


AWS_COST_METRIC = "UnblendedCost"
AWS_MONTHLY_GRANULARITY = "MONTHLY"
PROJECT_NAME_TAG_KEYS = {
    "application",
    "applicationname",
    "app",
    "product",
    "productname",
    "project",
    "projectname",
}
PROJECT_OWNER_TAG_KEYS = {
    "applicationowner",
    "businessowner",
    "contact",
    "owner",
    "projectowner",
    "serviceowner",
    "team",
}
ECS_INSIGHT_CLUSTER_NAMES = ("test-vsl-ecs-cluster", "dev-vsl-ecs-cluster")
AccountWorker = Callable[[AwsAccountConfig], Any]
CachedAnalyticsValue = tuple[datetime, Any]


class AwsInsightsService:
    analytics_metadata_cache_ttl = timedelta(hours=6)
    certificate_expiry_cache_ttl = timedelta(minutes=30)

    def __init__(self) -> None:
        self.accounts = settings.get_aws_accounts()
        self._client_factories: dict[str, AwsClientFactory] = {}
        self._analytics_cache_lock = Lock()
        self._project_metadata_cache: dict[str, CachedAnalyticsValue] = {}
        self._certificate_expiry_cache: dict[tuple[str, int], CachedAnalyticsValue] = {}

    def _client_factory(self, account: AwsAccountConfig) -> AwsClientFactory:
        factory = self._client_factories.get(account.key)
        if factory is None:
            factory = AwsClientFactory(account)
            self._client_factories[account.key] = factory
        return factory

    def _ensure_account_id(self, account: AwsAccountConfig) -> AwsAccountConfig:
        if account.account_id:
            return account

        try:
            sts_client = self._client_factory(account).sts()
            identity = sts_client.get_caller_identity()
        except (ClientError, BotoCoreError) as exc:
            raise HTTPException(
                status_code=500,
                detail=(
                    f"Unable to resolve AWS account id for account key '{account.key}'. "
                    "Check AWS credentials and STS access."
                ),
            ) from exc

        resolved_account = replace(account, account_id=identity["Account"])
        self.accounts[account.key] = resolved_account
        self._client_factories[account.key] = AwsClientFactory(resolved_account)
        return resolved_account

    def list_accounts(self) -> list[AccountListItem]:
        accounts: list[AccountListItem] = []
        for account in self.accounts.values():
            resolved_account = self._ensure_account_id(account)
            accounts.append(
                AccountListItem(
                    account_key=resolved_account.key,
                    account_id=resolved_account.account_id,
                    region=resolved_account.region,
                )
            )
        return accounts

    def _resolve_accounts(self, account_keys: list[str] | None) -> list[AwsAccountConfig]:
        if not self.accounts:
            raise HTTPException(
                status_code=500,
                detail="No AWS accounts found in .env. Configure AWS_ACCOUNT_KEYS first.",
            )

        if not account_keys:
            return list(self.accounts.values())

        missing = [key for key in account_keys if key not in self.accounts]
        if missing:
            raise HTTPException(
                status_code=400,
                detail=f"Unknown account keys: {', '.join(missing)}",
            )

        return [self._ensure_account_id(self.accounts[key]) for key in account_keys]

    async def _run_for_accounts(
        self,
        account_keys: list[str] | None,
        worker: AccountWorker,
    ) -> dict[str, Any]:
        accounts = self._resolve_accounts(account_keys)
        semaphore = asyncio.Semaphore(settings.max_parallel_accounts)

        async def run(account: AwsAccountConfig) -> tuple[str, str, Any, str | None]:
            async with semaphore:
                try:
                    data = await asyncio.to_thread(worker, account)
                    return account.key, account.account_id, data, None
                except (ClientError, BotoCoreError, ValueError) as exc:
                    logger.exception("AWS request failed for account %s", account.key)
                    return account.key, account.account_id, None, str(exc)

        results = await asyncio.gather(*(run(account) for account in accounts))
        return self._build_account_response(accounts, results)

    async def get_cost_breakdown(self, payload: CostBreakdownRequest) -> dict[str, Any]:
        return await self._run_for_accounts(
            payload.account_keys,
            lambda account: self._cost_breakdown_worker(account, payload.days, payload.top_n),
        )

    async def get_total_cost(self, payload: AwsAccountsRequest) -> dict[str, Any]:
        return await self._run_for_accounts(
            payload.account_keys,
            lambda account: self._total_cost_worker(account, payload.days),
        )

    async def get_service_costs(self, payload: AwsAccountsRequest) -> dict[str, Any]:
        return await self._run_for_accounts(
            payload.account_keys,
            lambda account: self._service_costs_result(account, payload.days),
        )

    async def get_trends_and_forecast(self, payload: AwsAccountsRequest) -> dict[str, Any]:
        return await self._run_for_accounts(
            payload.account_keys,
            lambda account: self._trends_forecast_worker(account, payload.days),
        )

    async def get_budget(self, payload: BudgetRequest) -> dict[str, Any]:
        return await self._run_for_accounts(
            payload.account_keys,
            lambda account: self._budget_worker(account, payload.budget_name),
        )

    async def get_resource_cost(self, payload: ResourceCostRequest) -> dict[str, Any]:
        return await self._run_for_accounts(
            payload.account_keys,
            lambda account: self._resource_cost_worker(account, payload.days, payload.resource_id),
        )

    async def get_ec2_idle_status(self, payload: Ec2IdleRequest) -> dict[str, Any]:
        return await self._run_for_accounts(
            payload.account_keys,
            lambda account: self._ec2_idle_worker(account, payload),
        )

    async def get_ecs_insights(self, payload: EcsInsightRequest) -> dict[str, Any]:
        return await self._run_for_accounts(
            payload.account_keys,
            lambda account: {
                "clusters": self._ecs_insights_worker(
                    account,
                    cluster_names=payload.cluster_names,
                    service_filter=payload.service_filter,
                )
            },
        )

    async def build_analytics_hub_snapshot(self) -> dict[str, Any]:
        accounts = self._resolve_accounts(None)
        semaphore = asyncio.Semaphore(settings.max_parallel_accounts)

        async def run(account: AwsAccountConfig) -> tuple[dict[str, Any] | None, dict[str, Any] | None]:
            async with semaphore:
                try:
                    snapshot = await asyncio.to_thread(self._analytics_account_snapshot_worker, account)
                    return snapshot, None
                except (ClientError, BotoCoreError, ValueError) as exc:
                    logger.exception("Analytics Hub snapshot failed for account %s", account.key)
                    return None, {
                        "account_key": account.key,
                        "account_id": account.account_id,
                        "region": account.region,
                        "error": str(exc),
                    }

        results = await asyncio.gather(*(run(account) for account in accounts))
        snapshots = [item for item, _ in results if item is not None]
        errors = [error for _, error in results if error is not None]
        return {
            "generated_at_utc": datetime.now(UTC).isoformat(),
            "account_count": len(snapshots),
            "accounts": snapshots,
            "errors": errors,
        }

    def _cost_breakdown_worker(
        self,
        account: AwsAccountConfig,
        days: int,
        top_n: int,
    ) -> dict[str, Any]:
        service_totals = self._service_costs_worker(account, days)
        return self._build_cost_breakdown(service_totals, top_n)

    def _total_cost_worker(self, account: AwsAccountConfig, days: int) -> dict[str, Any]:
        service_costs = self._service_costs_worker(account, days)
        return {
            "total_cost": round(sum(service_costs.values()), 2),
            "service_costs": service_costs,
        }

    def _service_costs_worker(self, account: AwsAccountConfig, days: int) -> dict[str, float]:
        response = self._get_cost_by_service_response(account, days)
        return self._aggregate_service_costs(response)

    def _service_costs_result(self, account: AwsAccountConfig, days: int) -> dict[str, Any]:
        return {"service_costs": self._service_costs_worker(account, days)}

    def _analytics_account_snapshot_worker(self, account: AwsAccountConfig) -> dict[str, Any]:
        service_costs = self._service_costs_worker(account, 30)
        total_cost = round(sum(service_costs.values()), 2)
        monthly_cost_trend = self._monthly_cost_trend_worker(account, 180)
        expiring_certificates = self._acm_expiry_worker(account, 90)
        project_metadata = self._project_metadata_worker(account)
        ecs_clusters = self._ecs_insights_worker(account)

        sorted_services = sorted(service_costs.items(), key=lambda item: item[1], reverse=True)
        top_service_rows = [
            {
                "service": service,
                "cost": round(cost, 2),
            }
            for service, cost in sorted_services[:10]
        ]
        other_cost = round(sum(cost for _, cost in sorted_services[10:]), 2)
        if other_cost > 0:
            top_service_rows.append({"service": "Other", "cost": other_cost})

        return {
            "account_key": account.key,
            "account_id": account.account_id,
            "region": account.region,
            "project_name": project_metadata["project_name"],
            "project_owner": project_metadata["project_owner"],
            "total_cost_30d": total_cost,
            "service_spend_30d": top_service_rows,
            "monthly_cost_trend": monthly_cost_trend,
            "expiring_certificates": expiring_certificates,
            "ecs_clusters": ecs_clusters,
        }

    def _ecs_insights_worker(
        self,
        account: AwsAccountConfig,
        cluster_names: list[str] | None = None,
        service_filter: str | None = None,
    ) -> list[dict[str, Any]]:
        client = self._client_factory(account).ecs()
        clusters: list[dict[str, Any]] = []

        for cluster_name in cluster_names or list(ECS_INSIGHT_CLUSTER_NAMES):
            cluster = self._ecs_cluster_snapshot(client, cluster_name, service_filter=service_filter)
            clusters.append(cluster)

        return clusters

    def _ecs_cluster_snapshot(
        self,
        client: Any,
        cluster_name: str,
        service_filter: str | None = None,
    ) -> dict[str, Any]:
        described_clusters = client.describe_clusters(clusters=[cluster_name]).get("clusters", [])
        cluster = described_clusters[0] if described_clusters else {}
        cluster_arn = cluster.get("clusterArn")
        cluster_status = cluster.get("status") or "MISSING"

        if not cluster_arn:
            return {
                "cluster_name": cluster_name,
                "cluster_arn": None,
                "status": cluster_status,
                "severity": "critical",
                "insight": "ECS cluster was not found or could not be described.",
                "services": [],
            }

        service_arns = self._list_ecs_service_arns(client, cluster_arn)
        services: list[dict[str, Any]] = []
        for batch in self._chunks(service_arns, 10):
            response = client.describe_services(cluster=cluster_arn, services=batch)
            for service in response.get("services", []):
                service_name = service.get("serviceName") or service.get("serviceArn", "").rsplit("/", 1)[-1]
                if service_filter and service_filter.lower() not in service_name.lower():
                    continue
                services.append(self._ecs_service_snapshot(client, cluster_arn, service))

        cluster_severity = self._rollup_severity([service["severity"] for service in services])
        if not services:
            cluster_severity = "warning"
        return {
            "cluster_name": cluster_name,
            "cluster_arn": cluster_arn,
            "status": cluster_status,
            "severity": cluster_severity,
            "insight": self._ecs_cluster_insight(cluster_status, services),
            "services": services,
        }

    def _list_ecs_service_arns(self, client: Any, cluster_arn: str) -> list[str]:
        paginator = client.get_paginator("list_services")
        service_arns: list[str] = []
        for page in paginator.paginate(cluster=cluster_arn):
            service_arns.extend(page.get("serviceArns", []))
        return service_arns

    def _ecs_service_snapshot(self, client: Any, cluster_arn: str, service: dict[str, Any]) -> dict[str, Any]:
        service_arn = service.get("serviceArn", "")
        service_name = service.get("serviceName") or service_arn.rsplit("/", 1)[-1]
        desired_count = int(service.get("desiredCount") or 0)
        running_count = int(service.get("runningCount") or 0)
        pending_count = int(service.get("pendingCount") or 0)
        status = service.get("status") or "UNKNOWN"
        deployments = service.get("deployments", [])
        primary_deployment = next((item for item in deployments if item.get("status") == "PRIMARY"), deployments[0] if deployments else {})
        deployment_status = primary_deployment.get("rolloutState")
        launch_type = primary_deployment.get("launchType")
        task_definition = service.get("taskDefinition")
        events = [
            event.get("message", "")
            for event in service.get("events", [])[:5]
            if event.get("message")
        ]
        tasks = self._ecs_service_tasks(client, cluster_arn, service_name)
        task_severity = self._rollup_severity([task["severity"] for task in tasks])
        service_severity = self._ecs_service_severity(
            status=status,
            desired_count=desired_count,
            running_count=running_count,
            pending_count=pending_count,
            deployment_status=deployment_status,
            task_severity=task_severity,
        )

        return {
            "service_name": service_name,
            "service_arn": service_arn,
            "status": status,
            "desired_count": desired_count,
            "running_count": running_count,
            "pending_count": pending_count,
            "launch_type": launch_type,
            "task_definition": task_definition,
            "deployment_status": deployment_status,
            "severity": service_severity,
            "insight": self._ecs_service_insight(
                status=status,
                desired_count=desired_count,
                running_count=running_count,
                pending_count=pending_count,
                deployment_status=deployment_status,
            ),
            "events": events,
            "tasks": tasks,
        }

    def _ecs_service_tasks(self, client: Any, cluster_arn: str, service_name: str) -> list[dict[str, Any]]:
        task_arns: list[str] = []
        for desired_status in ("RUNNING", "PENDING", "STOPPED"):
            try:
                response = client.list_tasks(
                    cluster=cluster_arn,
                    serviceName=service_name,
                    desiredStatus=desired_status,
                    maxResults=20,
                )
            except ClientError:
                continue
            task_arns.extend(response.get("taskArns", []))

        unique_task_arns = list(dict.fromkeys(task_arns))[:40]
        tasks: list[dict[str, Any]] = []
        for batch in self._chunks(unique_task_arns, 100):
            if not batch:
                continue
            response = client.describe_tasks(cluster=cluster_arn, tasks=batch)
            for task in response.get("tasks", []):
                container_reasons = [
                    item
                    for container in task.get("containers", [])
                    for item in (
                        container.get("reason"),
                        container.get("lastStatus") if container.get("lastStatus") not in {"RUNNING", "PENDING"} else None,
                    )
                    if item
                ]
                last_status = task.get("lastStatus") or "UNKNOWN"
                desired_status = task.get("desiredStatus") or "UNKNOWN"
                health_status = task.get("healthStatus")
                stopped_reason = task.get("stoppedReason")
                severity = self._ecs_task_severity(last_status, desired_status, health_status, stopped_reason)
                task_arn = task.get("taskArn", "")
                tasks.append(
                    {
                        "task_arn": task_arn,
                        "task_id": task_arn.rsplit("/", 1)[-1] if task_arn else "-",
                        "last_status": last_status,
                        "desired_status": desired_status,
                        "health_status": health_status,
                        "launch_type": task.get("launchType"),
                        "stopped_reason": stopped_reason,
                        "container_reasons": container_reasons,
                        "severity": severity,
                    }
                )
        return tasks

    def _ecs_cluster_insight(self, status: str, services: list[dict[str, Any]]) -> str:
        if status != "ACTIVE":
            return f"Cluster status is {status}; expected ACTIVE."
        if not services:
            return "Cluster is active, but no services were returned."
        critical = sum(1 for service in services if service["severity"] == "critical")
        warning = sum(1 for service in services if service["severity"] == "warning")
        if critical:
            return f"{critical} service(s) are affected and need attention."
        if warning:
            return f"{warning} service(s) have warnings."
        return "Cluster is active and selected services are running as expected."

    def _ecs_service_insight(
        self,
        *,
        status: str,
        desired_count: int,
        running_count: int,
        pending_count: int,
        deployment_status: str | None,
    ) -> str:
        if status != "ACTIVE":
            return f"Service status is {status}; expected ACTIVE."
        if running_count < desired_count:
            return f"Only {running_count}/{desired_count} desired task(s) are running."
        if pending_count > 0:
            return f"{pending_count} task(s) are pending."
        if deployment_status and deployment_status not in {"COMPLETED", "SUCCESSFUL"}:
            return f"Deployment rollout state is {deployment_status}."
        return f"Service is active with {running_count}/{desired_count} desired task(s) running."

    def _ecs_service_severity(
        self,
        *,
        status: str,
        desired_count: int,
        running_count: int,
        pending_count: int,
        deployment_status: str | None,
        task_severity: str,
    ) -> str:
        if status != "ACTIVE" or running_count < desired_count:
            return "critical"
        if task_severity == "critical":
            return "critical"
        if pending_count > 0 or task_severity == "warning":
            return "warning"
        if deployment_status and deployment_status not in {"COMPLETED", "SUCCESSFUL"}:
            return "warning"
        return "ok"

    def _ecs_task_severity(
        self,
        last_status: str,
        desired_status: str,
        health_status: str | None,
        stopped_reason: str | None,
    ) -> str:
        if stopped_reason or last_status == "STOPPED":
            return "critical"
        if desired_status == "RUNNING" and last_status != "RUNNING":
            return "warning"
        if health_status and health_status not in {"HEALTHY", "UNKNOWN"}:
            return "warning"
        return "ok"

    @staticmethod
    def _rollup_severity(severities: list[str]) -> str:
        if "critical" in severities:
            return "critical"
        if "warning" in severities:
            return "warning"
        return "ok"

    @staticmethod
    def _chunks(values: list[str], size: int) -> list[list[str]]:
        return [values[index : index + size] for index in range(0, len(values), size)]

    def _trends_forecast_worker(self, account: AwsAccountConfig, days: int) -> dict[str, Any]:
        client = self._client_factory(account).ce()
        start, end = self._date_range(days)

        cost_response = client.get_cost_and_usage(
            TimePeriod={"Start": start, "End": end},
            Granularity=AWS_MONTHLY_GRANULARITY,
            Metrics=[AWS_COST_METRIC],
        )

        actual = [
            {
                "month": item["TimePeriod"]["Start"],
                "cost": round(float(item["Total"]["UnblendedCost"]["Amount"]), 2),
            }
            for item in cost_response["ResultsByTime"]
        ]

        forecast_end = self._forecast_end(end, settings.default_forecast_months)
        forecast_response = client.get_cost_forecast(
            TimePeriod={"Start": end, "End": forecast_end},
            Metric="UNBLENDED_COST",
            Granularity=AWS_MONTHLY_GRANULARITY,
        )

        forecast = [
            {
                "month": item["TimePeriod"]["Start"],
                "projected_cost": round(float(item["MeanValue"]), 2),
            }
            for item in forecast_response["ForecastResultsByTime"]
        ]

        actual_costs = [item["cost"] for item in actual]
        average_cost = sum(actual_costs) / len(actual_costs) if actual_costs else 0.0
        threshold = average_cost * 1.3
        anomalies = [item for item in actual if item["cost"] > threshold]

        return {"actual": actual, "forecast": forecast, "anomalies": anomalies}

    def _monthly_cost_trend_worker(self, account: AwsAccountConfig, days: int) -> list[dict[str, Any]]:
        client = self._client_factory(account).ce()
        start, end = self._date_range(days)
        cost_response = client.get_cost_and_usage(
            TimePeriod={"Start": start, "End": end},
            Granularity=AWS_MONTHLY_GRANULARITY,
            Metrics=[AWS_COST_METRIC],
        )
        return [
            {
                "month": item["TimePeriod"]["Start"],
                "cost": round(float(item["Total"]["UnblendedCost"]["Amount"]), 2),
            }
            for item in cost_response["ResultsByTime"]
        ]

    def _budget_worker(self, account: AwsAccountConfig, budget_name: str) -> dict[str, Any]:
        client = self._client_factory(account).budgets()
        budget = client.describe_budget(
            AccountId=account.account_id,
            BudgetName=budget_name,
        )["Budget"]

        budget_limit = float(budget["BudgetLimit"]["Amount"])
        actual_spent = float(budget["CalculatedSpend"]["ActualSpend"]["Amount"])
        utilization_pct = round((actual_spent / budget_limit) * 100, 2) if budget_limit else 0.0

        return {
            "budget_name": budget_name,
            "limit": round(budget_limit, 2),
            "actual_spent": round(actual_spent, 2),
            "utilization_pct": utilization_pct,
        }

    def _resource_cost_worker(
        self,
        account: AwsAccountConfig,
        days: int,
        resource_id: str,
    ) -> dict[str, Any]:
        client = self._client_factory(account).ce()
        start, end = self._date_range(days)

        response = client.get_cost_and_usage(
            TimePeriod={"Start": start, "End": end},
            Granularity=AWS_MONTHLY_GRANULARITY,
            Metrics=[AWS_COST_METRIC],
            Filter={
                "Dimensions": {
                    "Key": "RESOURCE_ID",
                    "Values": [resource_id],
                }
            },
        )

        total_cost = sum(
            float(item["Total"]["UnblendedCost"]["Amount"])
            for item in response["ResultsByTime"]
        )
        return {"resource_id": resource_id, "total_cost": round(total_cost, 2)}

    def _ec2_idle_worker(self, account: AwsAccountConfig, payload: Ec2IdleRequest) -> dict[str, Any]:
        cloudwatch = self._client_factory(account).cloudwatch()
        return {
            "instances": [
                self._instance_idle_status(
                    cloudwatch=cloudwatch,
                    instance_id=instance_id,
                    days=payload.idle_days,
                    cpu_threshold=payload.cpu_threshold,
                    network_threshold_bytes=payload.network_threshold_bytes,
                )
                for instance_id in payload.instance_ids
            ]
        }

    def _acm_expiry_worker(self, account: AwsAccountConfig, days: int) -> list[dict[str, Any]]:
        cache_key = (account.key, days)
        cached_rows = self._get_cached_analytics_value(
            self._certificate_expiry_cache,
            cache_key,
            self.certificate_expiry_cache_ttl,
        )
        if cached_rows is not None:
            return cached_rows

        client = self._client_factory(account).acm()
        paginator = client.get_paginator("list_certificates")
        now_utc = datetime.now(UTC)
        cutoff = now_utc + timedelta(days=days)
        rows: list[dict[str, Any]] = []

        for page in paginator.paginate(CertificateStatuses=["ISSUED", "PENDING_VALIDATION", "INACTIVE"]):
            for summary in page.get("CertificateSummaryList", []):
                certificate_arn = summary.get("CertificateArn")
                if not certificate_arn:
                    continue
                details = client.describe_certificate(CertificateArn=certificate_arn).get("Certificate", {})
                not_after = details.get("NotAfter")
                if not isinstance(not_after, datetime):
                    continue
                not_after_utc = not_after.astimezone(UTC)
                if not_after_utc > cutoff:
                    continue
                days_to_expiry = max(0, (not_after_utc.date() - now_utc.date()).days)
                rows.append(
                    {
                        "certificate_arn": certificate_arn,
                        "domain_name": details.get("DomainName") or summary.get("DomainName") or "-",
                        "expiry_date": not_after_utc.date().isoformat(),
                        "days_to_expiry": days_to_expiry,
                    }
                )

        rows.sort(key=lambda item: item["expiry_date"])
        trimmed_rows = rows[:20]
        self._set_cached_analytics_value(self._certificate_expiry_cache, cache_key, trimmed_rows)
        return trimmed_rows

    def _project_metadata_worker(self, account: AwsAccountConfig) -> dict[str, str | None]:
        cached_metadata = self._get_cached_analytics_value(
            self._project_metadata_cache,
            account.key,
            self.analytics_metadata_cache_ttl,
        )
        if cached_metadata is not None:
            return cached_metadata

        try:
            client = self._client_factory(account).tagging()
            paginator = client.get_paginator("get_resources")
            project_names: Counter[str] = Counter()
            project_owners: Counter[str] = Counter()

            for page in paginator.paginate(ResourcesPerPage=100, TagsPerPage=100):
                for resource in page.get("ResourceTagMappingList", []):
                    tags = resource.get("Tags", [])
                    for tag in tags:
                        key = self._normalize_tag_key(tag.get("Key", ""))
                        value = self._clean_tag_value(tag.get("Value"))
                        if not key or not value:
                            continue
                        if key in PROJECT_NAME_TAG_KEYS:
                            project_names[value] += 1
                        if key in PROJECT_OWNER_TAG_KEYS:
                            project_owners[value] += 1
        except (ClientError, BotoCoreError):
            logger.warning(
                "Unable to read resource tags for Analytics Hub account %s; project metadata will be omitted.",
                account.key,
            )
            return {
                "project_name": None,
                "project_owner": None,
            }

        metadata = {
            "project_name": self._most_common_tag_value(project_names),
            "project_owner": self._most_common_tag_value(project_owners),
        }
        self._set_cached_analytics_value(self._project_metadata_cache, account.key, metadata)
        return metadata

    def _get_cached_analytics_value(
        self,
        cache: dict[Any, CachedAnalyticsValue],
        key: Any,
        ttl: timedelta,
    ) -> Any | None:
        with self._analytics_cache_lock:
            cached_item = cache.get(key)
            if cached_item is None:
                return None
            cached_at, value = cached_item
            if datetime.now(UTC) - cached_at > ttl:
                cache.pop(key, None)
                return None
            return value

    def _set_cached_analytics_value(
        self,
        cache: dict[Any, CachedAnalyticsValue],
        key: Any,
        value: Any,
    ) -> None:
        with self._analytics_cache_lock:
            cache[key] = (datetime.now(UTC), value)

    @staticmethod
    def _normalize_tag_key(value: str) -> str:
        return re.sub(r"[^a-z0-9]+", "", value.strip().lower())

    @staticmethod
    def _clean_tag_value(value: Any) -> str | None:
        if not isinstance(value, str):
            return None
        cleaned = value.strip()
        if not cleaned:
            return None
        if cleaned.lower() in {"-", "n/a", "na", "none", "null", "unknown"}:
            return None
        return cleaned

    @staticmethod
    def _most_common_tag_value(counter: Counter[str]) -> str | None:
        if not counter:
            return None
        highest_count = max(counter.values())
        candidates = sorted(value for value, count in counter.items() if count == highest_count)
        return candidates[0] if candidates else None

    def _instance_idle_status(
        self,
        cloudwatch: Any,
        instance_id: str,
        days: int,
        cpu_threshold: float,
        network_threshold_bytes: float,
    ) -> dict[str, Any]:
        end_time = datetime.now(UTC)
        start_time = end_time - timedelta(days=days)
        metrics = self._get_instance_metric_averages(
            cloudwatch=cloudwatch,
            instance_id=instance_id,
            start_time=start_time,
            end_time=end_time,
        )
        cpu_points = metrics["CPUUtilization"]
        average_network_in = metrics["NetworkIn"]
        average_network_out = metrics["NetworkOut"]
        cpu_idle = bool(cpu_points) and all(value < cpu_threshold for value in cpu_points)
        network_idle = (average_network_in + average_network_out) < network_threshold_bytes

        return IdleStatusItem(
            instance_id=instance_id,
            cpu_idle=cpu_idle,
            network_idle=network_idle,
            idle=cpu_idle and network_idle,
        ).model_dump()

    def _get_cost_by_service_response(
        self,
        account: AwsAccountConfig,
        days: int,
    ) -> dict[str, Any]:
        client = self._client_factory(account).ce()
        start, end = self._date_range(days)
        return client.get_cost_and_usage(
            TimePeriod={"Start": start, "End": end},
            Granularity=AWS_MONTHLY_GRANULARITY,
            Metrics=[AWS_COST_METRIC],
            GroupBy=[{"Type": "DIMENSION", "Key": "SERVICE"}],
        )

    def _build_cost_breakdown(
        self,
        service_totals: dict[str, float],
        top_n: int,
    ) -> dict[str, Any]:
        total_cost = round(sum(service_totals.values()), 2)
        sorted_items = sorted(
            service_totals.items(),
            key=lambda item: item[1],
            reverse=True,
        )
        top_items = sorted_items[:top_n]
        other_cost = round(sum(cost for _, cost in sorted_items[top_n:]), 2)

        breakdown = [
            self._build_service_breakdown_item(
                service=service,
                cost=round(cost, 2),
                total_cost=total_cost,
            )
            for service, cost in top_items
        ]
        if other_cost > 0:
            breakdown.append(
                self._build_service_breakdown_item(
                    service="Other",
                    cost=other_cost,
                    total_cost=total_cost,
                )
            )

        return {"total_cost": total_cost, "breakdown": breakdown}

    def _build_service_breakdown_item(
        self,
        *,
        service: str,
        cost: float,
        total_cost: float,
    ) -> dict[str, Any]:
        percentage = round((cost / total_cost) * 100, 4) if total_cost else 0.0
        return {
            "service": service,
            "cost": cost,
            "percentage": percentage,
        }

    def _build_account_response(
        self,
        accounts: list[AwsAccountConfig],
        results: list[tuple[str, str, Any, str | None]],
    ) -> dict[str, Any]:
        succeeded_accounts: list[AccountSuccess[Any]] = []
        failed_accounts: list[AccountError] = []

        for account_key, account_id, data, error in results:
            if error:
                failed_accounts.append(
                    AccountError(
                        account_key=account_key,
                        account_id=account_id,
                        error=error,
                    )
                )
                continue

            succeeded_accounts.append(
                AccountSuccess(
                    account_key=account_key,
                    account_id=account_id,
                    data=data,
                )
            )

        return {
            "requested_accounts": [account.key for account in accounts],
            "succeeded_accounts": succeeded_accounts,
            "failed_accounts": failed_accounts,
        }

    def _aggregate_service_costs(self, response: dict[str, Any]) -> dict[str, float]:
        service_costs: dict[str, float] = {}
        for result in response["ResultsByTime"]:
            for group in result["Groups"]:
                service_name = group["Keys"][0]
                amount = float(group["Metrics"]["UnblendedCost"]["Amount"])
                service_costs[service_name] = service_costs.get(service_name, 0.0) + amount

        return {
            service_name: round(amount, 2)
            for service_name, amount in service_costs.items()
        }

    def _get_instance_metric_averages(
        self,
        cloudwatch: Any,
        instance_id: str,
        start_time: datetime,
        end_time: datetime,
    ) -> dict[str, Any]:
        query_definitions = [
            ("cpu", "CPUUtilization"),
            ("network_in", "NetworkIn"),
            ("network_out", "NetworkOut"),
        ]
        response = cloudwatch.get_metric_data(
            MetricDataQueries=[
                {
                    "Id": query_id,
                    "MetricStat": {
                        "Metric": {
                            "Namespace": "AWS/EC2",
                            "MetricName": metric_name,
                            "Dimensions": [{"Name": "InstanceId", "Value": instance_id}],
                        },
                        "Period": 86400,
                        "Stat": "Average",
                    },
                    "ReturnData": True,
                }
                for query_id, metric_name in query_definitions
            ],
            StartTime=start_time,
            EndTime=end_time,
            ScanBy="TimestampAscending",
        )

        results_by_id = {
            item["Id"]: [float(value) for value in item.get("Values", [])]
            for item in response.get("MetricDataResults", [])
        }
        network_in_values = results_by_id.get("network_in", [])
        network_out_values = results_by_id.get("network_out", [])

        return {
            "CPUUtilization": results_by_id.get("cpu", []),
            "NetworkIn": (
                sum(network_in_values) / len(network_in_values)
                if network_in_values
                else 0.0
            ),
            "NetworkOut": (
                sum(network_out_values) / len(network_out_values)
                if network_out_values
                else 0.0
            ),
        }

    @staticmethod
    def _date_range(days: int) -> tuple[str, str]:
        end_date = datetime.now(UTC).date()
        start_date = end_date - timedelta(days=days)
        return start_date.isoformat(), end_date.isoformat()

    @staticmethod
    def _forecast_end(end_date: str, months: int) -> str:
        end_dt = date.fromisoformat(end_date)
        future = end_dt + timedelta(days=months * 30)
        return future.replace(day=1).isoformat()


@lru_cache(maxsize=1)
def get_aws_insights_service() -> AwsInsightsService:
    return AwsInsightsService()


# Backward-compatible alias for older imports that used the singular name.
AwsInsightService = AwsInsightsService
