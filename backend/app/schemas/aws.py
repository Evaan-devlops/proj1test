from __future__ import annotations

from typing import Generic, TypeVar

from pydantic import BaseModel, Field


class AwsSchemaBase(BaseModel):
    model_config = {
        "json_schema_extra": {},
    }


class AwsAccountsRequest(AwsSchemaBase):
    account_keys: list[str] | None = Field(
        default=None,
        description=(
            "Configured AWS account aliases from `.env`, such as `dev` or `prod`. "
            "If omitted, the API runs the request for all configured accounts."
        ),
        examples=[["dev"], ["dev", "prod"]],
    )
    days: int = Field(
        default=180,
        ge=1,
        le=365,
        description=(
            "How many previous days of AWS cost data to inspect. "
            "For example, `30` means last 30 days and `180` means roughly last 6 months."
        ),
        examples=[30, 180],
    )


class CostBreakdownRequest(AwsAccountsRequest):
    top_n: int = Field(
        default=5,
        ge=1,
        le=50,
        description=(
            "How many highest-cost AWS services to return explicitly. "
            "Any remaining services are grouped into `Other`."
        ),
        examples=[5, 10],
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "account_keys": ["dev"],
                "days": 180,
                "top_n": 5,
            }
        }
    }


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
    service: str = Field(
        ...,
        description="AWS service name returned by Cost Explorer, such as Amazon Textract.",
    )
    cost: float = Field(
        ...,
        description="Total cost for the service within the requested time range.",
    )
    percentage: float | None = Field(
        default=None,
        description="Percentage contribution of this service to the account total cost.",
    )


class CostBreakdownResult(AwsSchemaBase):
    total_cost: float = Field(
        ...,
        description="Combined AWS cost across all returned services for this account.",
    )
    breakdown: list[ServiceCostItem] = Field(
        ...,
        description="Top services by cost, plus `Other` when additional services exist.",
    )


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
    account_key: str = Field(
        ...,
        description="Configured account alias from `.env`, such as `dev`.",
    )
    account_id: str = Field(
        ...,
        description="Resolved AWS account id for the configured account alias.",
    )
    data: T = Field(
        ...,
        description="Endpoint-specific successful result for this account.",
    )


class AccountError(BaseModel):
    account_key: str = Field(
        ...,
        description="Configured account alias from `.env`, such as `dev`.",
    )
    account_id: str | None = Field(
        default=None,
        description="Resolved AWS account id when available.",
    )
    error: str = Field(
        ...,
        description="Human-readable error returned for this account.",
    )


class AccountListItem(BaseModel):
    account_key: str
    account_id: str
    region: str


class AccountListResponse(BaseModel):
    accounts: list[AccountListItem]


class MultiAccountAggregateResponse(AwsSchemaBase, Generic[T]):
    requested_accounts: list[str] = Field(
        ...,
        description="Account aliases that were selected for this request.",
    )
    succeeded_accounts: list[AccountSuccess[T]] = Field(
        ...,
        description="Per-account results for accounts processed successfully.",
    )
    failed_accounts: list[AccountError] = Field(
        ...,
        description="Per-account errors for accounts that failed.",
    )


class MultiAccountCostBreakdownResponse(MultiAccountAggregateResponse[CostBreakdownResult]):
    succeeded_accounts: list[AccountSuccess[CostBreakdownResult]]

    model_config = {
        "json_schema_extra": {
            "example": {
                "requested_accounts": ["dev"],
                "succeeded_accounts": [
                    {
                        "account_key": "dev",
                        "account_id": "420737321821",
                        "data": {
                            "total_cost": 473478.42,
                            "breakdown": [
                                {
                                    "service": "Amazon Textract",
                                    "cost": 121977.09,
                                    "percentage": 25.7619,
                                },
                                {
                                    "service": "Amazon OpenSearch Service",
                                    "cost": 118775.64,
                                    "percentage": 25.0858,
                                },
                                {
                                    "service": "AWS CloudTrail",
                                    "cost": 23063.59,
                                    "percentage": 4.8711,
                                },
                                {
                                    "service": "Amazon Relational Database Service",
                                    "cost": 18803.63,
                                    "percentage": 3.9714,
                                },
                                {
                                    "service": "AmazonCloudWatch",
                                    "cost": 18470.51,
                                    "percentage": 3.901,
                                },
                                {
                                    "service": "Other",
                                    "cost": 172387.96,
                                    "percentage": 36.4088,
                                },
                            ],
                        },
                    }
                ],
                "failed_accounts": [],
            }
        }
    }


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
