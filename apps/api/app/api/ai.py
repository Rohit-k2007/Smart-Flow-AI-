from fastapi import APIRouter

from app.schemas.ai import AIStatus, AIDecisions, ControllerModeRequest
from app.schemas.common import ApiEnvelope, success_response
from app.services import ai_service

router = APIRouter(prefix="/ai", tags=["AI control"])


@router.get("/status", response_model=ApiEnvelope[AIStatus])
async def ai_status() -> dict[str, object]:
    return success_response("AI controller status retrieved.", ai_service.get_status())


@router.get("/decisions", response_model=ApiEnvelope[AIDecisions])
async def ai_decisions() -> dict[str, object]:
    return success_response("AI decision availability retrieved.", ai_service.get_decisions())


@router.post("/controller/mode")
async def set_controller_mode(request: ControllerModeRequest) -> dict[str, object]:
    ai_service.set_mode(request.mode)
    return success_response("Controller mode updated.", ai_service.get_status())
