import asyncio
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, status

from app.schemas.common import ApiEnvelope, success_response
from app.schemas.traffic import (
    Intersection,
    PredictionCollection,
    TrafficCollection,
    TrafficLiveData,
)
from app.services.here_traffic_service import (
    HereProviderError,
    HereProviderResponse,
    here_traffic_service,
)
from app.services.neon_traffic_store import neon_traffic_store
from app.services import traffic_service

router = APIRouter(prefix="/traffic", tags=["traffic"])


@router.get("/intersections", response_model=ApiEnvelope[TrafficCollection])
async def intersections() -> dict[str, object]:
    try:
        rows = await neon_traffic_store.get_intersections()
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc
    items = [Intersection.model_validate(row) for row in rows]
    return success_response(
        "Jaipur intersection catalog retrieved.",
        TrafficCollection(
            available=bool(items),
            items=items,
            reason=(
                "Configured Jaipur intersections retrieved from the catalog."
                if items
                else "No verified Jaipur intersections are configured in the catalog."
            ),
        ),
    )


@router.get("/live", response_model=ApiEnvelope[TrafficLiveData])
async def live_traffic() -> dict[str, object]:
    async def get_flow() -> HereProviderResponse | HereProviderError:
        try:
            return await here_traffic_service.get_flow()
        except HereProviderError as exc:
            return exc

    async def get_incidents() -> HereProviderResponse | HereProviderError:
        try:
            return await here_traffic_service.get_incidents()
        except HereProviderError as exc:
            return exc

    flow_result, incidents_result = await asyncio.gather(get_flow(), get_incidents())
    flow = flow_result if isinstance(flow_result, HereProviderResponse) else None
    incidents = incidents_result if isinstance(incidents_result, HereProviderResponse) else None
    failures = [
        result
        for result in (flow_result, incidents_result)
        if isinstance(result, HereProviderError)
    ]

    if flow is None and incidents is None:
        error = failures[0]
        error_status = (
            status.HTTP_503_SERVICE_UNAVAILABLE
            if error.status_code == 503
            else status.HTTP_504_GATEWAY_TIMEOUT
            if error.status_code == 504
            else status.HTTP_429_TOO_MANY_REQUESTS
            if error.status_code == 429
            else status.HTTP_502_BAD_GATEWAY
        )
        raise HTTPException(status_code=error_status, detail=str(error)) from error

    failure_reason = "; ".join(str(error) for error in failures) or None
    persistence_status, persistence_reason = await neon_traffic_store.persist_live_data(
        flow,
        incidents,
        failure_reason,
    )
    updated_values = [
        item.get("provider_timestamp")
        for item in (flow.items if flow else []) + (incidents.items if incidents else [])
        if isinstance(item.get("provider_timestamp"), str)
    ]
    latest_updated = max(updated_values) if updated_values else None
    stale = False
    if latest_updated:
        try:
            updated_at = datetime.fromisoformat(latest_updated.replace("Z", "+00:00"))
            if updated_at.tzinfo is None:
                updated_at = updated_at.replace(tzinfo=timezone.utc)
            stale = (datetime.now(timezone.utc) - updated_at).total_seconds() > 900
        except (TypeError, ValueError):
            latest_updated = None

    available = bool(flow and flow.available) or bool(incidents and incidents.available)
    is_degraded = bool(failures) or persistence_status == "UNAVAILABLE"
    status_value = "DEGRADED" if is_degraded else "CONNECTED"
    reason_parts = []
    if failure_reason:
        reason_parts.append(failure_reason)
    if persistence_reason:
        reason_parts.append(persistence_reason)
    if stale:
        reason_parts.append("Provider source timestamps are older than 15 minutes.")
    if not available:
        reason_parts.append("HERE returned no flow segments or incidents for the configured area.")
    if not reason_parts:
        reason_parts.append("Current HERE traffic data retrieved for the configured pilot area.")

    data = TrafficLiveData(
        available=available,
        status=status_value,
        city=here_traffic_service.get_status()["city"],
        flow_available=bool(flow and flow.available),
        flow_items=flow.items if flow else [],
        incidents_available=bool(incidents and incidents.available),
        incidents=incidents.items if incidents else [],
        last_updated_at=latest_updated,
        is_stale=stale,
        persistence_status=persistence_status,
        persistence_reason=persistence_reason,
        reason=" ".join(reason_parts),
    )
    return success_response("Live traffic availability retrieved.", data)


@router.get("/metrics", response_model=ApiEnvelope[TrafficCollection])
async def traffic_metrics() -> dict[str, object]:
    return success_response("Traffic metric availability retrieved.", traffic_service.get_metrics())


@router.get("/congestion", response_model=ApiEnvelope[TrafficCollection])
async def congestion() -> dict[str, object]:
    return success_response("Congestion data availability retrieved.", traffic_service.get_congestion())


@router.get("/prediction", response_model=ApiEnvelope[PredictionCollection])
async def prediction() -> dict[str, object]:
    return success_response("Traffic prediction availability retrieved.", traffic_service.get_predictions())
