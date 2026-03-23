from fastapi import FastAPI

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.logging import configure_logging
from app.schemas.chat import HealthResponse


configure_logging()


app = FastAPI(
    title="AWS Insights API",
    version="1.0.0",
    description=(
        "FastAPI service for pulling AWS cost and budget data from one or more "
        "configured AWS accounts."
    ),
)

app.include_router(api_router, prefix=settings.api_v1_prefix)


@app.get("/health", tags=["Health"])
async def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/health", response_model=HealthResponse, tags=["Health"])
async def frontend_health_check() -> HealthResponse:
    from time import time

    return HealthResponse(version=app.version, serverTimeMs=int(time() * 1000))
