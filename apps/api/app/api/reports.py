from fastapi import APIRouter

from app.services.analytics_service import get_report

router = APIRouter(tags=["reports"])


@router.get("/reports/{run_id}")
async def report(run_id: str) -> None:
    return get_report(run_id)
