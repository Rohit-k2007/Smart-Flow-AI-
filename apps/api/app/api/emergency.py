from fastapi import APIRouter, status

from app.schemas.common import ApiEnvelope, success_response
from app.schemas.emergency import EmergencyCollection, EmergencyCreate
from app.services.emergency_service import emergency_service

router = APIRouter(prefix="/traffic/emergency", tags=["emergency"])


@router.post("", status_code=status.HTTP_201_CREATED)
async def submit_emergency(request: EmergencyCreate) -> dict[str, object]:
    event = await emergency_service.submit(request)
    return success_response(
        "Emergency request recorded; no vehicle detection or signal priority was performed.",
        event,
    )


@router.get("", response_model=ApiEnvelope[EmergencyCollection])
async def emergency_events() -> dict[str, object]:
    return success_response(
        "Emergency request history retrieved.",
        EmergencyCollection(
            available=True,
            items=await emergency_service.list_events(),
            reason="Records are user-submitted and stored in process memory; they are not live detections.",
        ),
    )


@router.get("/history", response_model=ApiEnvelope[EmergencyCollection])
async def emergency_history() -> dict[str, object]:
    return await emergency_events()
