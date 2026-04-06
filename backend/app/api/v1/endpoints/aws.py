from typing import TypeVar

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.schemas.aws import (
    AccountListResponse,
    AnalyticsHubRefreshResponse,
    AnalyticsHubSnapshotResponse,
    AwsAccountsRequest,
    BudgetRequest,
    CostBreakdownRequest,
    Ec2IdleRequest,
    MultiAccountBudgetResponse,
    MultiAccountCostBreakdownResponse,
    MultiAccountIdleResponse,
    MultiAccountResourceCostResponse,
    MultiAccountServiceCostResponse,
    MultiAccountTotalCostResponse,
    MultiAccountTrendsResponse,
    ResourceCostRequest,
)
from app.services.archive_service import ApiResponseArchiveService
from app.services.analytics_hub_service import (
    AnalyticsHubSnapshotService,
    get_analytics_hub_snapshot_service,
)
from app.services.aws_service import AwsInsightsService, get_aws_insights_service


router = APIRouter()
archive_service = ApiResponseArchiveService()
TResponseModel = TypeVar("TResponseModel", bound=BaseModel)


def _archive_response(
    *,
    endpoint: str,
    response: BaseModel,
    request_payload: BaseModel | None = None,
) -> None:
    archive_service.append_record(
        endpoint=endpoint,
        request_payload=request_payload.model_dump() if request_payload is not None else None,
        response_payload=response.model_dump(),
    )


def _validate_and_archive_response(
    *,
    endpoint: str,
    response_model: type[TResponseModel],
    service_response: dict,
    request_payload: BaseModel,
) -> TResponseModel:
    response = response_model.model_validate(service_response)
    _archive_response(
        endpoint=endpoint,
        request_payload=request_payload,
        response=response,
    )
    return response


@router.get(
    "/accounts",
    response_model=AccountListResponse,
    summary="List configured AWS accounts",
)
async def list_accounts(
    service: AwsInsightsService = Depends(get_aws_insights_service),
) -> AccountListResponse:
    response = AccountListResponse(accounts=service.list_accounts())
    _archive_response(endpoint="/api/v1/aws/accounts", response=response)
    return response


@router.get(
    "/analytics-hub/snapshot",
    response_model=AnalyticsHubSnapshotResponse,
    summary="Get the latest stored Analytics Hub snapshot",
)
async def analytics_hub_snapshot(
    service: AnalyticsHubSnapshotService = Depends(get_analytics_hub_snapshot_service),
) -> AnalyticsHubSnapshotResponse:
    return AnalyticsHubSnapshotResponse(
        snapshot=service.get_snapshot(),
        refresh_in_progress=service.is_refresh_in_progress(),
    )


@router.post(
    "/analytics-hub/refresh",
    response_model=AnalyticsHubRefreshResponse,
    summary="Queue a background refresh for Analytics Hub data",
)
async def refresh_analytics_hub_snapshot(
    service: AnalyticsHubSnapshotService = Depends(get_analytics_hub_snapshot_service),
) -> AnalyticsHubRefreshResponse:
    queued = service.queue_refresh()
    return AnalyticsHubRefreshResponse(
        queued=queued,
        refresh_in_progress=service.is_refresh_in_progress(),
    )


@router.post(
    "/cost-breakdown",
    response_model=MultiAccountCostBreakdownResponse,
    summary="Get top AWS service cost breakdown",
    description=(
        "Returns the highest-cost AWS services for each selected account over the requested "
        "time range. Any services beyond `top_n` are grouped into `Other`."
    ),
)
async def cost_breakdown(
    payload: CostBreakdownRequest,
    service: AwsInsightsService = Depends(get_aws_insights_service),
) -> MultiAccountCostBreakdownResponse:
    return _validate_and_archive_response(
        endpoint="/api/v1/aws/cost-breakdown",
        response_model=MultiAccountCostBreakdownResponse,
        service_response=await service.get_cost_breakdown(payload),
        request_payload=payload,
    )


@router.post(
    "/total-cost",
    response_model=MultiAccountTotalCostResponse,
    summary="Get total AWS cost and service totals",
)
async def total_cost(
    payload: AwsAccountsRequest,
    service: AwsInsightsService = Depends(get_aws_insights_service),
) -> MultiAccountTotalCostResponse:
    return _validate_and_archive_response(
        endpoint="/api/v1/aws/total-cost",
        response_model=MultiAccountTotalCostResponse,
        service_response=await service.get_total_cost(payload),
        request_payload=payload,
    )


@router.post(
    "/service-costs",
    response_model=MultiAccountServiceCostResponse,
    summary="Get cost grouped by AWS service",
)
async def service_costs(
    payload: AwsAccountsRequest,
    service: AwsInsightsService = Depends(get_aws_insights_service),
) -> MultiAccountServiceCostResponse:
    return _validate_and_archive_response(
        endpoint="/api/v1/aws/service-costs",
        response_model=MultiAccountServiceCostResponse,
        service_response=await service.get_service_costs(payload),
        request_payload=payload,
    )


@router.post(
    "/trends-forecast",
    response_model=MultiAccountTrendsResponse,
    summary="Get spend trend and forecast",
)
async def trends_forecast(
    payload: AwsAccountsRequest,
    service: AwsInsightsService = Depends(get_aws_insights_service),
) -> MultiAccountTrendsResponse:
    return _validate_and_archive_response(
        endpoint="/api/v1/aws/trends-forecast",
        response_model=MultiAccountTrendsResponse,
        service_response=await service.get_trends_and_forecast(payload),
        request_payload=payload,
    )


@router.post(
    "/budget",
    response_model=MultiAccountBudgetResponse,
    summary="Get AWS budget utilization",
)
async def budget(
    payload: BudgetRequest,
    service: AwsInsightsService = Depends(get_aws_insights_service),
) -> MultiAccountBudgetResponse:
    return _validate_and_archive_response(
        endpoint="/api/v1/aws/budget",
        response_model=MultiAccountBudgetResponse,
        service_response=await service.get_budget(payload),
        request_payload=payload,
    )


@router.post(
    "/resource-cost",
    response_model=MultiAccountResourceCostResponse,
    summary="Get cost for a specific AWS resource id",
)
async def resource_cost(
    payload: ResourceCostRequest,
    service: AwsInsightsService = Depends(get_aws_insights_service),
) -> MultiAccountResourceCostResponse:
    return _validate_and_archive_response(
        endpoint="/api/v1/aws/resource-cost",
        response_model=MultiAccountResourceCostResponse,
        service_response=await service.get_resource_cost(payload),
        request_payload=payload,
    )


@router.post(
    "/ec2/idle-check",
    response_model=MultiAccountIdleResponse,
    summary="Check whether EC2 instances look idle",
)
async def ec2_idle_check(
    payload: Ec2IdleRequest,
    service: AwsInsightsService = Depends(get_aws_insights_service),
) -> MultiAccountIdleResponse:
    return _validate_and_archive_response(
        endpoint="/api/v1/aws/ec2/idle-check",
        response_model=MultiAccountIdleResponse,
        service_response=await service.get_ec2_idle_status(payload),
        request_payload=payload,
    )
