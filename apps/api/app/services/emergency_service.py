import asyncio
from datetime import datetime, timezone
from uuid import uuid4

from app.schemas.emergency import EmergencyCreate, EmergencyEvent


class EmergencyService:
    def __init__(self) -> None:
        self._lock = asyncio.Lock()
        self._events: list[EmergencyEvent] = []

    async def submit(self, request: EmergencyCreate) -> EmergencyEvent:
        event = EmergencyEvent(
            id=str(uuid4()),
            vehicle_type=request.vehicle_type,
            intersection_id=request.intersection_id,
            direction=request.direction,
            priority=request.priority,
            status="submitted",
            priority_applied=False,
            created_at=datetime.now(timezone.utc),
            note="User-submitted request stored in process memory only; no detection or signal priority was performed.",
        )
        async with self._lock:
            self._events.insert(0, event)
        return event

    async def list_events(self) -> list[EmergencyEvent]:
        async with self._lock:
            return list(self._events)


emergency_service = EmergencyService()
