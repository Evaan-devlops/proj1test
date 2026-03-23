from fastapi import APIRouter

from app.api.v1.endpoints.aws import router as aws_router
from app.api.v1.endpoints.chat import router as chat_router
from app.api.v1.endpoints.llm import router as llm_router


api_router = APIRouter()
api_router.include_router(chat_router, tags=["Chat"])
api_router.include_router(aws_router, prefix="/aws", tags=["AWS"])
api_router.include_router(llm_router, prefix="/llm", tags=["LLM"])
