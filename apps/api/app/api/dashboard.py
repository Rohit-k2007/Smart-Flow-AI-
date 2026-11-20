from fastapi import APIRouter

from app.schemas.common import ApiEnvelope, success_response
from app.schemas.dashboard import DashboardSummary
from app.services.dashboard_service import get_summary

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary", response_model=ApiEnvelope[DashboardSummary])
async def dashboard_summary() -> dict[str, object]:
    return success_response("Dashboard summary status retrieved.", get_summary())
