from datetime import datetime
from typing import Literal

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from app.schemas.common import ApiEnvelope, success_response
from app.services.here_traffic_service import (
    HereProviderError,
    here_traffic_service,
)

router = APIRouter(prefix="/integrations/here", tags=["HERE traffic"])


class HereStatusData(BaseModel):
    provider: str
    city: str
    configured: bool
    status: Literal["NOT_CONFIGURED", "CONNECTING", "CONNECTED", "DEGRADED", "UNAVAILABLE"]
    base_url: str
    latitude: float
    longitude: float
    radius_meters: int
    api_key_configured: bool


class HereHealthData(BaseModel):
    provider: str
    provider_status: Literal["CONNECTED"]
    backend_status: str
    configured: bool
    flow_available: bool
    timestamp: datetime


class HereFlowData(BaseModel):
    available: bool
    status: Literal["NOT_CONFIGURED", "CONNECTING", "CONNECTED", "DEGRADED", "UNAVAILABLE"]
    items: list[dict[str, object]]
    reason: str


class HereIncidentData(BaseModel):
    available: bool
    status: Literal["NOT_CONFIGURED", "CONNECTING", "CONNECTED", "DEGRADED", "UNAVAILABLE"]
    items: list[dict[str, object]]
    reason: str


def _provider_http_error(exc: HereProviderError) -> HTTPException:
    if exc.status_code == 503:
        return HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc))
    if exc.status_code == 504:
        return HTTPException(status_code=status.HTTP_504_GATEWAY_TIMEOUT, detail=str(exc))
    if exc.status_code == 429:
        return HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=str(exc))
    return HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc))


@router.get("/status", response_model=ApiEnvelope[HereStatusData])
async def here_status() -> dict[str, object]:
    data = HereStatusData.model_validate(here_traffic_service.get_status())
    return success_response("HERE integration status retrieved.", data)


@router.get("/health", response_model=ApiEnvelope[HereHealthData])
async def here_health() -> dict[str, object]:
    try:
        data = HereHealthData.model_validate(await here_traffic_service.health())
    except HereProviderError as exc:
        raise _provider_http_error(exc) from exc
    return success_response("HERE provider connectivity is healthy.", data)


@router.get("/flow", response_model=ApiEnvelope[HereFlowData])
async def here_flow() -> dict[str, object]:
    try:
        result = await here_traffic_service.get_flow()
    except HereProviderError as exc:
        raise _provider_http_error(exc) from exc
    data = HereFlowData.model_validate(result.model_dump())
    return success_response("HERE traffic flow retrieved.", data)


@router.get("/incidents", response_model=ApiEnvelope[HereIncidentData])
async def here_incidents() -> dict[str, object]:
    try:
        result = await here_traffic_service.get_incidents()
    except HereProviderError as exc:
        raise _provider_http_error(exc) from exc
    data = HereIncidentData.model_validate(result.model_dump())
    return success_response("HERE incidents retrieved.", data)
