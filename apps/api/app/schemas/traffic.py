from typing import Literal

from pydantic import BaseModel

CongestionLevel = Literal["low", "medium", "high", "critical"]


class Intersection(BaseModel):
    id: str
    name: str
    latitude: float
    longitude: float
    signal_state: Literal["green", "yellow", "red"] | None = None
    geometry: dict[str, object] | list[object] | None = None


class TrafficMetric(BaseModel):
    intersection_id: str
    vehicle_count: int
    queue_length: int
    average_wait_seconds: float
    congestion: CongestionLevel


class TrafficCollection(BaseModel):
    available: bool
    items: list[Intersection | TrafficMetric | dict[str, object]]
    reason: str


class PredictionCollection(BaseModel):
    available: bool
    items: list[dict[str, object]]
    reason: str


class TrafficLiveData(BaseModel):
    available: bool
    status: Literal["CONNECTED", "DEGRADED", "UNAVAILABLE"]
    city: str
    flow_available: bool
    flow_items: list[dict[str, object]]
    incidents_available: bool
    incidents: list[dict[str, object]]
    last_updated_at: str | None
    is_stale: bool
    persistence_status: Literal["PERSISTED", "NOT_CONFIGURED", "UNAVAILABLE"]
    persistence_reason: str | None
    reason: str
