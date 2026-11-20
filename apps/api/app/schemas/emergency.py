from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

EmergencyVehicleType = Literal["ambulance", "fire_engine"]
Direction = Literal["north", "east", "south", "west"]


class EmergencyCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    vehicle_type: EmergencyVehicleType
    intersection_id: str = Field(min_length=1, max_length=100)
    direction: Direction
    priority: int = Field(default=1, ge=1, le=5)


class EmergencyEvent(BaseModel):
    id: str
    vehicle_type: EmergencyVehicleType
    intersection_id: str
    direction: Direction
    priority: int
    status: Literal["submitted"]
    priority_applied: bool
    created_at: datetime
    note: str


class EmergencyCollection(BaseModel):
    available: bool
    items: list[EmergencyEvent]
    reason: str
