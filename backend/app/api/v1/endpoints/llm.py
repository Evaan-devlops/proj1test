from fastapi import APIRouter, Depends

from app.schemas.llm import (
    LlmAnswerRequest,
    LlmAnswerResponse,
    LlmHealthCheckResponse,
)
from app.services.llm_service import LlmService, get_llm_service


router = APIRouter()


@router.post(
    "/answer",
    response_model=LlmAnswerResponse,
    summary="Answer a question using supplied context via the configured LLM gateway",
)
async def answer_question(
    payload: LlmAnswerRequest,
    service: LlmService = Depends(get_llm_service),
) -> LlmAnswerResponse:
    return await service.answer_question(payload)


@router.get(
    "/health-check",
    response_model=LlmHealthCheckResponse,
    summary="Verify VOX token generation and downstream LLM connectivity",
)
async def llm_health_check(
    service: LlmService = Depends(get_llm_service),
) -> LlmHealthCheckResponse:
    return await service.health_check()
