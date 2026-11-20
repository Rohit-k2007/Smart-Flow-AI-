from datetime import datetime, timezone

from fastapi import APIRouter
from pydantic import BaseModel

from app.core.config import settings
from app.schemas.common import ApiEnvelope, success_response

router = APIRouter(tags=["health"])


class HealthData(BaseModel):
    status: str
    application: str
    api_version: str
    timestamp: datetime


@router.get("/health", response_model=ApiEnvelope[HealthData])
async def health() -> dict[str, object]:
    now = datetime.now(timezone.utc)
    return success_response(
        "API is healthy.",
        HealthData(
            status="ok",
            application=settings.app_name,
            api_version=settings.app_version,
            timestamp=now,
        ),
    )
