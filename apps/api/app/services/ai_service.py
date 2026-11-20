from fastapi import HTTPException, status

from app.schemas.ai import AIStatus
from app.schemas.simulation import ControllerMode

AI_UNAVAILABLE_REASON = "The AI controller is not configured."


def get_status() -> AIStatus:
    return AIStatus(
        configured=False,
        available=False,
        controller_mode=None,
        reason=AI_UNAVAILABLE_REASON,
    )


def get_decisions() -> dict[str, object]:
    return {
        "available": False,
        "items": [],
        "reason": "No AI decision engine is configured; no decisions are available.",
    }


def set_mode(mode: ControllerMode) -> None:
    del mode
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail=AI_UNAVAILABLE_REASON,
    )
