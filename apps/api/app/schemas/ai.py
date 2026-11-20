from pydantic import BaseModel, ConfigDict

from app.schemas.simulation import ControllerMode


class AIStatus(BaseModel):
    configured: bool
    available: bool
    controller_mode: ControllerMode | None
    reason: str


class ControllerModeRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    mode: ControllerMode


class AIDecisions(BaseModel):
    available: bool
    items: list[dict[str, object]]
    reason: str
