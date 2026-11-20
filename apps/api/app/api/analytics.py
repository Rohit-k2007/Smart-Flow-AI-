from fastapi import APIRouter

from app.schemas.analytics import AnalyticsCollection
from app.schemas.common import ApiEnvelope, success_response
from app.services import analytics_service

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/comparison", response_model=ApiEnvelope[AnalyticsCollection])
async def comparison() -> dict[str, object]:
    return success_response("Comparison availability retrieved.", analytics_service.get_comparison())


@router.get("/performance", response_model=ApiEnvelope[AnalyticsCollection])
async def performance() -> dict[str, object]:
    return success_response("Performance availability retrieved.", analytics_service.get_performance())
