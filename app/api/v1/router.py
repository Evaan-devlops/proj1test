from fastapi import APIRouter

from app.api.v1.endpoints.aws import router as aws_router


api_router = APIRouter()
api_router.include_router(aws_router, prefix="/aws", tags=["AWS"])

