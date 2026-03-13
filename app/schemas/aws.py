from __future__ import annotations

from typing import Generic, TypeVar

from pydantic import BaseModel, Field


class AwsAccountsRequest(BaseModel):
    account_keys: list[str] | None = Field(
        default=None,
        description=(
            "Configured AWS account aliases from .env. "
            "Example: ['dev', 'prod']. Omit to query all configured accounts."
        ),
        examples=[["dev"], ["dev", "prod"]],
    )
    days: int = Field(
        default=180,
        ge=1,
        le=365,
        description="Number of past days to inspect for cost APIs.",
    )


class CostBreakdownRequest(AwsAccountsRequest):
    top_n: int = Field(
        default=5,
        ge=1,
        le=50,
        description="How many top services to return before grouping the rest into Other.",
    )


class BudgetRequest(AwsAccountsRequest):
    budget_name: str = Field(
        ...,
        min_length=1,
        description="Existing AWS Budget name to fetch from each selected account.",
        examples=["MonthlyBudget"],
    )


class ResourceCostRequest(AwsAccountsRequest):
    resource_id: str = Field(
        ...,
        min_length=1,
        description="AWS Cost Explorer resource id, for example an EC2 instance id.",
        examples=["i-0123456789abcdef0"],
    )


class Ec2IdleRequest(AwsAccountsRequest):
    instance_ids: list[str] = Field(
        ...,
        min_length=1,
        description="EC2 instance ids to evaluate for idleness.",
        examples=[["i-0123456789abcdef0", "i-0abcdef1234567890"]],
    )
    idle_days: int = Field(
        default=14,
        ge=1,
        le=90,
        description="Number of days of CloudWatch metrics to evaluate.",
    )
    cpu_threshold: float = Field(
        default=1.0,
        ge=0,
        description="Average CPU threshold below which an instance is treated as idle.",
    )
    network_threshold_bytes: float = Field(
        default=102400,
        ge=0,
        description="Combined average daily network threshold below which an instance is treated as idle.",
    )


class ServiceCostItem(BaseModel):
    service: str
    cost: float
    percentage: float | None = None


class CostBreakdownResult(BaseModel):
    total_cost: float
    breakdown: list[ServiceCostItem]


class TotalCostResult(BaseModel):
    total_cost: float
    service_costs: dict[str, float]


class TrendCostItem(BaseModel):
    month: str
    cost: float


class ForecastCostItem(BaseModel):
    month: str
    projected_cost: float


class TrendsForecastResult(BaseModel):
    actual: list[TrendCostItem]
    forecast: list[ForecastCostItem]
    anomalies: list[TrendCostItem]


class BudgetResult(BaseModel):
    budget_name: str
    limit: float
    actual_spent: float
    utilization_pct: float


class ResourceCostResult(BaseModel):
    resource_id: str
    total_cost: float


class IdleStatusItem(BaseModel):
    instance_id: str
    cpu_idle: bool
    network_idle: bool
    idle: bool


T = TypeVar("T")


class AccountSuccess(BaseModel, Generic[T]):
    account_key: str
    account_id: str
    data: T


class AccountError(BaseModel):
    account_key: str
    account_id: str | None = None
    error: str


class AccountListItem(BaseModel):
    account_key: str
    account_id: str
    region: str


class AccountListResponse(BaseModel):
    accounts: list[AccountListItem]


class MultiAccountAggregateResponse(BaseModel, Generic[T]):
    requested_accounts: list[str]
    succeeded_accounts: list[AccountSuccess[T]]
    failed_accounts: list[AccountError]


class MultiAccountCostBreakdownResponse(MultiAccountAggregateResponse[CostBreakdownResult]):
    succeeded_accounts: list[AccountSuccess[CostBreakdownResult]]


class MultiAccountTotalCostResponse(MultiAccountAggregateResponse[TotalCostResult]):
    succeeded_accounts: list[AccountSuccess[TotalCostResult]]


class MultiAccountServiceCostsResult(BaseModel):
    service_costs: dict[str, float]


class MultiAccountServiceCostResponse(MultiAccountAggregateResponse[MultiAccountServiceCostsResult]):
    succeeded_accounts: list[AccountSuccess[MultiAccountServiceCostsResult]]


class MultiAccountTrendsResponse(MultiAccountAggregateResponse[TrendsForecastResult]):
    succeeded_accounts: list[AccountSuccess[TrendsForecastResult]]


class MultiAccountBudgetResponse(MultiAccountAggregateResponse[BudgetResult]):
    succeeded_accounts: list[AccountSuccess[BudgetResult]]


class MultiAccountResourceCostResponse(MultiAccountAggregateResponse[ResourceCostResult]):
    succeeded_accounts: list[AccountSuccess[ResourceCostResult]]


class MultiAccountIdleResult(BaseModel):
    instances: list[IdleStatusItem]


class MultiAccountIdleResponse(MultiAccountAggregateResponse[MultiAccountIdleResult]):
    succeeded_accounts: list[AccountSuccess[MultiAccountIdleResult]]
