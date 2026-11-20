from pydantic import BaseModel


class AnalyticsCollection(BaseModel):
    available: bool
    items: list[dict[str, object]]
    reason: str


class ReportData(BaseModel):
    available: bool
    run_id: str
    reason: str
