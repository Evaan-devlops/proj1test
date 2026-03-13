from fastapi import APIRouter, Depends

from app.schemas.aws import (
    AccountListResponse,
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
from app.services.aws_service import AwsInsightsService, get_aws_insights_service


router = APIRouter()
archive_service = ApiResponseArchiveService()


@router.get(
    "/accounts",
    response_model=AccountListResponse,
    summary="List configured AWS accounts",
)
async def list_accounts(
    service: AwsInsightsService = Depends(get_aws_insights_service),
) -> AccountListResponse:
    response = AccountListResponse(accounts=service.list_accounts())
    archive_service.append_record(
        endpoint="/api/v1/aws/accounts",
        request_payload=None,
        response_payload=response.model_dump(),
    )
    return response


@router.post(
    "/cost-breakdown",
    response_model=MultiAccountCostBreakdownResponse,
    summary="Get top AWS service cost breakdown",
)
async def cost_breakdown(
    payload: CostBreakdownRequest,
    service: AwsInsightsService = Depends(get_aws_insights_service),
) -> MultiAccountCostBreakdownResponse:
    response = MultiAccountCostBreakdownResponse.model_validate(
        await service.get_cost_breakdown(payload)
    )
    archive_service.append_record(
        endpoint="/api/v1/aws/cost-breakdown",
        request_payload=payload.model_dump(),
        response_payload=response.model_dump(),
    )
    return response


@router.post(
    "/total-cost",
    response_model=MultiAccountTotalCostResponse,
    summary="Get total AWS cost and service totals",
)
async def total_cost(
    payload: AwsAccountsRequest,
    service: AwsInsightsService = Depends(get_aws_insights_service),
) -> MultiAccountTotalCostResponse:
    response = MultiAccountTotalCostResponse.model_validate(
        await service.get_total_cost(payload)
    )
    archive_service.append_record(
        endpoint="/api/v1/aws/total-cost",
        request_payload=payload.model_dump(),
        response_payload=response.model_dump(),
    )
    return response


@router.post(
    "/service-costs",
    response_model=MultiAccountServiceCostResponse,
    summary="Get cost grouped by AWS service",
)
async def service_costs(
    payload: AwsAccountsRequest,
    service: AwsInsightsService = Depends(get_aws_insights_service),
) -> MultiAccountServiceCostResponse:
    response = MultiAccountServiceCostResponse.model_validate(
        await service.get_service_costs(payload)
    )
    archive_service.append_record(
        endpoint="/api/v1/aws/service-costs",
        request_payload=payload.model_dump(),
        response_payload=response.model_dump(),
    )
    return response


@router.post(
    "/trends-forecast",
    response_model=MultiAccountTrendsResponse,
    summary="Get spend trend and forecast",
)
async def trends_forecast(
    payload: AwsAccountsRequest,
    service: AwsInsightsService = Depends(get_aws_insights_service),
) -> MultiAccountTrendsResponse:
    response = MultiAccountTrendsResponse.model_validate(
        await service.get_trends_and_forecast(payload)
    )
    archive_service.append_record(
        endpoint="/api/v1/aws/trends-forecast",
        request_payload=payload.model_dump(),
        response_payload=response.model_dump(),
    )
    return response


@router.post(
    "/budget",
    response_model=MultiAccountBudgetResponse,
    summary="Get AWS budget utilization",
)
async def budget(
    payload: BudgetRequest,
    service: AwsInsightsService = Depends(get_aws_insights_service),
) -> MultiAccountBudgetResponse:
    response = MultiAccountBudgetResponse.model_validate(
        await service.get_budget(payload)
    )
    archive_service.append_record(
        endpoint="/api/v1/aws/budget",
        request_payload=payload.model_dump(),
        response_payload=response.model_dump(),
    )
    return response


@router.post(
    "/resource-cost",
    response_model=MultiAccountResourceCostResponse,
    summary="Get cost for a specific AWS resource id",
)
async def resource_cost(
    payload: ResourceCostRequest,
    service: AwsInsightsService = Depends(get_aws_insights_service),
) -> MultiAccountResourceCostResponse:
    response = MultiAccountResourceCostResponse.model_validate(
        await service.get_resource_cost(payload)
    )
    archive_service.append_record(
        endpoint="/api/v1/aws/resource-cost",
        request_payload=payload.model_dump(),
        response_payload=response.model_dump(),
    )
    return response


@router.post(
    "/ec2/idle-check",
    response_model=MultiAccountIdleResponse,
    summary="Check whether EC2 instances look idle",
)
async def ec2_idle_check(
    payload: Ec2IdleRequest,
    service: AwsInsightsService = Depends(get_aws_insights_service),
) -> MultiAccountIdleResponse:
    response = MultiAccountIdleResponse.model_validate(
        await service.get_ec2_idle_status(payload)
    )
    archive_service.append_record(
        endpoint="/api/v1/aws/ec2/idle-check",
        request_payload=payload.model_dump(),
        response_payload=response.model_dump(),
    )
    return response
