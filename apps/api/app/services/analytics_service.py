from fastapi import HTTPException, status

from app.schemas.analytics import AnalyticsCollection

ANALYTICS_UNAVAILABLE_REASON = "Analytics are unavailable because no completed simulation runs exist."


def get_comparison() -> AnalyticsCollection:
    return AnalyticsCollection(available=False, items=[], reason=ANALYTICS_UNAVAILABLE_REASON)


def get_performance() -> AnalyticsCollection:
    return AnalyticsCollection(available=False, items=[], reason=ANALYTICS_UNAVAILABLE_REASON)


def get_report(run_id: str) -> None:
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"No completed report exists for run '{run_id}'.",
    )
