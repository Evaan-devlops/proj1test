from fastapi import FastAPI

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.logging import configure_logging


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
