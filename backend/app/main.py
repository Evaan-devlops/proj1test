from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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

cors_allowed_origins = settings.get_cors_allowed_origins()
if cors_allowed_origins:
    allow_all_origins = "*" in cors_allowed_origins
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"] if allow_all_origins else cors_allowed_origins,
        allow_credentials=not allow_all_origins,
        allow_methods=settings.get_cors_allow_methods(),
        allow_headers=settings.get_cors_allow_headers(),
    )

app.include_router(api_router, prefix=settings.api_v1_prefix)


@app.get("/health", tags=["Health"])
async def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/health", response_model=HealthResponse, tags=["Health"])
async def frontend_health_check() -> HealthResponse:
    from time import time

    return HealthResponse(version=app.version, serverTimeMs=int(time() * 1000))
