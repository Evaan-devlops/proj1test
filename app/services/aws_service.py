from __future__ import annotations

import asyncio
import logging
from datetime import UTC, date, datetime, timedelta
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

    def list_accounts(self) -> list[AccountListItem]:
        return [
            AccountListItem(
                account_key=account.key,
                account_id=account.account_id,
                region=account.region,
            )
            for account in self.accounts.values()
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

        return [self.accounts[key] for key in account_keys]

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
        client = AwsClientFactory(account).ce()
        start, end = self._date_range(days)

        response = client.get_cost_and_usage(
            TimePeriod={"Start": start, "End": end},
            Granularity="MONTHLY",
            Metrics=["UnblendedCost"],
            GroupBy=[{"Type": "DIMENSION", "Key": "SERVICE"}],
        )

        service_totals: dict[str, float] = {}
        total_cost = 0.0

        for result in response["ResultsByTime"]:
            for item in result["Groups"]:
                service_name = item["Keys"][0]
                cost = float(item["Metrics"]["UnblendedCost"]["Amount"])
                total_cost += cost
                service_totals[service_name] = service_totals.get(service_name, 0.0) + cost

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
        client = AwsClientFactory(account).ce()
        start, end = self._date_range(days)

        response = client.get_cost_and_usage(
            TimePeriod={"Start": start, "End": end},
            Granularity="MONTHLY",
            Metrics=["UnblendedCost"],
            GroupBy=[{"Type": "DIMENSION", "Key": "SERVICE"}],
        )

        service_costs: dict[str, float] = {}
        for result in response["ResultsByTime"]:
            for group in result["Groups"]:
                service_name = group["Keys"][0]
                amount = float(group["Metrics"]["UnblendedCost"]["Amount"])
                service_costs[service_name] = round(
                    service_costs.get(service_name, 0.0) + amount,
                    2,
                )

        return service_costs

    def _trends_forecast_worker(self, account: AwsAccountConfig, days: int) -> dict[str, Any]:
        client = AwsClientFactory(account).ce()
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
        client = AwsClientFactory(account).budgets()
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
        client = AwsClientFactory(account).ce()
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
        cloudwatch = AwsClientFactory(account).cloudwatch()
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
        cpu_idle = self._average_metric_below_threshold(
            cloudwatch=cloudwatch,
            metric_name="CPUUtilization",
            instance_id=instance_id,
            start_time=start_time,
            end_time=end_time,
            threshold=cpu_threshold,
        )
        average_network_in = self._average_metric_value(
            cloudwatch=cloudwatch,
            metric_name="NetworkIn",
            instance_id=instance_id,
            start_time=start_time,
            end_time=end_time,
        )
        average_network_out = self._average_metric_value(
            cloudwatch=cloudwatch,
            metric_name="NetworkOut",
            instance_id=instance_id,
            start_time=start_time,
            end_time=end_time,
        )
        network_idle = (average_network_in + average_network_out) < network_threshold_bytes

        return IdleStatusItem(
            instance_id=instance_id,
            cpu_idle=cpu_idle,
            network_idle=network_idle,
            idle=cpu_idle and network_idle,
        ).model_dump()

    def _average_metric_below_threshold(
        self,
        cloudwatch: Any,
        metric_name: str,
        instance_id: str,
        start_time: datetime,
        end_time: datetime,
        threshold: float,
    ) -> bool:
        datapoints = self._get_metric_datapoints(
            cloudwatch,
            metric_name,
            instance_id,
            start_time,
            end_time,
        )
        if not datapoints:
            return False
        return all(float(item["Average"]) < threshold for item in datapoints)

    def _average_metric_value(
        self,
        cloudwatch: Any,
        metric_name: str,
        instance_id: str,
        start_time: datetime,
        end_time: datetime,
    ) -> float:
        datapoints = self._get_metric_datapoints(
            cloudwatch,
            metric_name,
            instance_id,
            start_time,
            end_time,
        )
        if not datapoints:
            return 0.0
        return sum(float(item["Average"]) for item in datapoints) / len(datapoints)

    def _get_metric_datapoints(
        self,
        cloudwatch: Any,
        metric_name: str,
        instance_id: str,
        start_time: datetime,
        end_time: datetime,
    ) -> list[dict[str, Any]]:
        response = cloudwatch.get_metric_statistics(
            Namespace="AWS/EC2",
            MetricName=metric_name,
            Dimensions=[{"Name": "InstanceId", "Value": instance_id}],
            StartTime=start_time,
            EndTime=end_time,
            Period=86400,
            Statistics=["Average"],
        )
        return response.get("Datapoints", [])

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


def get_aws_insights_service() -> AwsInsightsService:
    return AwsInsightsService()
