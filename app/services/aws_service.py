from __future__ import annotations

import asyncio
import logging
from dataclasses import replace
from datetime import UTC, date, datetime, timedelta
from functools import lru_cache
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
    IdleStatusItem,
    ResourceCostRequest,
)
from app.services.aws_clients import AwsClientFactory


logger = logging.getLogger(__name__)


class AwsInsightsService:
    def __init__(self) -> None:
        self.accounts = settings.get_aws_accounts()
        self._client_factories: dict[str, AwsClientFactory] = {}

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
        return [
            AccountListItem(
                account_key=resolved_account.key,
                account_id=resolved_account.account_id,
                region=resolved_account.region,
            )
            for account in self.accounts.values()
            for resolved_account in [self._ensure_account_id(account)]
        ]

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
        worker: Callable[[AwsAccountConfig], Any],
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
        successes = []
        failures = []

        for account_key, account_id, data, error in results:
            if error:
                failures.append(
                    AccountError(
                        account_key=account_key,
                        account_id=account_id,
                        error=error,
                    )
                )
            else:
                successes.append(
                    AccountSuccess(
                        account_key=account_key,
                        account_id=account_id,
                        data=data,
                    )
                )

        return {
            "requested_accounts": [account.key for account in accounts],
            "succeeded_accounts": successes,
            "failed_accounts": failures,
        }

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
            lambda account: {"service_costs": self._service_costs_worker(account, payload.days)},
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

    def _cost_breakdown_worker(
        self,
        account: AwsAccountConfig,
        days: int,
        top_n: int,
    ) -> dict[str, Any]:
        service_totals = self._service_costs_worker(account, days)
        total_cost = sum(service_totals.values())

        sorted_items = sorted(
            service_totals.items(),
            key=lambda item: item[1],
            reverse=True,
        )

        breakdown = [
            {"service": service, "cost": round(cost, 2)}
            for service, cost in sorted_items[:top_n]
        ]
        remaining = sorted_items[top_n:]
        if remaining:
            breakdown.append(
                {
                    "service": "Other",
                    "cost": round(sum(cost for _, cost in remaining), 2),
                }
            )

        for item in breakdown:
            item["percentage"] = round((item["cost"] / total_cost) * 100, 4) if total_cost else 0.0

        return {"total_cost": round(total_cost, 2), "breakdown": breakdown}

    def _total_cost_worker(self, account: AwsAccountConfig, days: int) -> dict[str, Any]:
        service_costs = self._service_costs_worker(account, days)
        return {
            "total_cost": round(sum(service_costs.values()), 2),
            "service_costs": service_costs,
        }

    def _service_costs_worker(self, account: AwsAccountConfig, days: int) -> dict[str, float]:
        response = self._get_cost_by_service_response(account, days)
        return self._aggregate_service_costs(response)

    def _trends_forecast_worker(self, account: AwsAccountConfig, days: int) -> dict[str, Any]:
        client = self._client_factory(account).ce()
        start, end = self._date_range(days)

        cost_response = client.get_cost_and_usage(
            TimePeriod={"Start": start, "End": end},
            Granularity="MONTHLY",
            Metrics=["UnblendedCost"],
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
            Granularity="MONTHLY",
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
            Granularity="MONTHLY",
            Metrics=["UnblendedCost"],
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
            Granularity="MONTHLY",
            Metrics=["UnblendedCost"],
            GroupBy=[{"Type": "DIMENSION", "Key": "SERVICE"}],
        )

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
