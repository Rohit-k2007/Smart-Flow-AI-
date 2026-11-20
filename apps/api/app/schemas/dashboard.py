from pydantic import BaseModel


class DashboardSummary(BaseModel):
    available: bool
    state: str
    active_runs: int | None
    intersection_count: int | None
    average_wait_seconds: float | None
    reason: str
