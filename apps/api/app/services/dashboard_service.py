from app.schemas.dashboard import DashboardSummary


def get_summary() -> DashboardSummary:
    return DashboardSummary(
        available=False,
        state="inactive",
        active_runs=None,
        intersection_count=None,
        average_wait_seconds=None,
        reason="No simulation engine is connected; traffic measurements are unavailable.",
    )
