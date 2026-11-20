import asyncio
import logging
from datetime import datetime, timezone
from typing import Any, Literal

import httpx
from pydantic import BaseModel

from app.core.config import settings

logger = logging.getLogger(__name__)

IntegrationStatus = Literal[
    "NOT_CONFIGURED",
    "CONNECTING",
    "CONNECTED",
    "DEGRADED",
    "UNAVAILABLE",
]


class HereProviderError(Exception):
    status_code: int = 502

    def __init__(self, message: str, status_code: int | None = None) -> None:
        super().__init__(message)
        if status_code is not None:
            self.status_code = status_code


class HereProviderResponse(BaseModel):
    available: bool
    status: IntegrationStatus
    items: list[dict[str, Any]]
    reason: str


class HereTrafficService:
    def __init__(self) -> None:
        self.status: IntegrationStatus = (
            "NOT_CONFIGURED" if not settings.here_api_key.strip() else "UNAVAILABLE"
        )
        self._timeout_seconds = 5.0
        self._max_attempts = 3

    def get_status(self) -> dict[str, Any]:
        configured = bool(settings.here_api_key.strip())
        return {
            "provider": "HERE Traffic API v7",
            "city": settings.here_city,
            "configured": configured,
            "status": self.status,
            "base_url": settings.here_traffic_base_url,
            "latitude": settings.here_latitude,
            "longitude": settings.here_longitude,
            "radius_meters": settings.here_radius_meters,
            "api_key_configured": configured,
        }

    def _area(self) -> str:
        return (
            f"circle:{settings.here_latitude},{settings.here_longitude};"
            f"r={settings.here_radius_meters}"
        )

    async def _request(self, endpoint: str) -> httpx.Response:
        if not settings.here_api_key.strip():
            self.status = "NOT_CONFIGURED"
            raise HereProviderError("HERE_API_KEY is not configured.", 503)

        url = f"{settings.here_traffic_base_url.rstrip('/')}/{endpoint.lstrip('/')}"
        params = {
            "apiKey": settings.here_api_key,
            "in": self._area(),
            "locationReferencing": "shape",
        }

        self.status = "CONNECTING"
        last_error: Exception | None = None

        async with httpx.AsyncClient(timeout=self._timeout_seconds) as client:
            for attempt in range(1, self._max_attempts + 1):
                try:
                    response = await client.get(url, params=params)
                except httpx.TimeoutException as exc:
                    last_error = exc
                    logger.warning(
                        "HERE %s request timed out (attempt %d/%d).",
                        endpoint,
                        attempt,
                        self._max_attempts,
                    )
                except httpx.RequestError as exc:
                    last_error = exc
                    logger.warning(
                        "HERE %s request failed (attempt %d/%d): %s",
                        endpoint,
                        attempt,
                        self._max_attempts,
                        type(exc).__name__,
                    )
                else:
                    if response.status_code == 401 or response.status_code == 403:
                        self.status = "UNAVAILABLE"
                        raise HereProviderError(
                            "HERE rejected the configured credentials.",
                            502,
                        )
                    if response.status_code == 429:
                        if attempt < self._max_attempts:
                            await asyncio.sleep(min(2 ** (attempt - 1), 2.0))
                            continue
                        self.status = "DEGRADED"
                        raise HereProviderError(
                            "HERE Traffic API rate limit exceeded.",
                            429,
                        )
                    if response.status_code in (502, 503, 504):
                        if attempt < self._max_attempts:
                            await asyncio.sleep(min(2 ** (attempt - 1), 2.0))
                            continue
                    if response.is_error:
                        self.status = "UNAVAILABLE"
                        raise HereProviderError(
                            f"HERE Traffic API returned HTTP {response.status_code}.",
                            502,
                        )
                    try:
                        response.json()
                    except ValueError:
                        self.status = "UNAVAILABLE"
                        raise HereProviderError(
                            "HERE returned invalid JSON.",
                            502,
                        )
                    self.status = "CONNECTED"
                    return response

                if attempt < self._max_attempts:
                    await asyncio.sleep(min(2 ** (attempt - 1), 2.0))

        self.status = "UNAVAILABLE"
        if isinstance(last_error, httpx.TimeoutException):
            raise HereProviderError("HERE Traffic API request timed out.", 504)
        raise HereProviderError(
            "HERE Traffic API could not be reached.",
            502,
        )

    async def get_flow(self) -> HereProviderResponse:
        response = await self._request("flow")
        try:
            payload = response.json()
        except ValueError as exc:
            raise HereProviderError("HERE returned invalid JSON.", 502) from exc

        if not isinstance(payload, dict):
            raise HereProviderError("HERE returned an invalid flow response.", 502)

        raw_items = payload.get("results")
        if raw_items is None:
            raw_items = payload.get("flow")
        if raw_items is None:
            raw_items = payload.get("routes")
        if raw_items is None:
            raw_items = []
        if not isinstance(raw_items, list):
            raise HereProviderError("HERE returned an invalid flow response.", 502)

        if any(not isinstance(item, dict) for item in raw_items):
            raise HereProviderError("HERE returned an invalid flow segment.", 502)
        items = [
            self._normalize_flow_item(item, payload.get("sourceUpdated"))
            for item in raw_items
        ]
        if not items:
            return HereProviderResponse(
                available=False,
                status="CONNECTED",
                items=[],
                reason="HERE returned no traffic flow segments for the Jaipur area.",
            )
        return HereProviderResponse(
            available=True,
            status="CONNECTED",
            items=items,
            reason="HERE traffic flow data retrieved.",
        )

    async def get_incidents(self) -> HereProviderResponse:
        response = await self._request("incidents")
        try:
            payload = response.json()
        except ValueError as exc:
            raise HereProviderError("HERE returned invalid JSON.", 502) from exc

        if not isinstance(payload, dict):
            raise HereProviderError("HERE returned an invalid incident response.", 502)

        raw_items = payload.get("incidents")
        if raw_items is None:
            raw_items = payload.get("results")
        if raw_items is None:
            raw_items = []
        if not isinstance(raw_items, list):
            raise HereProviderError("HERE returned an invalid incident response.", 502)

        if any(not isinstance(item, dict) for item in raw_items):
            raise HereProviderError("HERE returned an invalid incident.", 502)
        items = [
            self._normalize_incident_item(item, payload.get("sourceUpdated"))
            for item in raw_items
        ]
        if not items:
            return HereProviderResponse(
                available=False,
                status="CONNECTED",
                items=[],
                reason="HERE returned no incidents for the Jaipur area.",
            )
        return HereProviderResponse(
            available=True,
            status="CONNECTED",
            items=items,
            reason="HERE incident data retrieved.",
        )

    async def health(self) -> dict[str, Any]:
        result = await self.get_flow()
        return {
            "provider": "HERE Traffic API v7",
            "provider_status": "CONNECTED",
            "backend_status": "ok",
            "configured": True,
            "flow_available": result.available,
            "timestamp": datetime.now(timezone.utc),
        }

    def _normalize_flow_item(
        self,
        item: dict[str, Any],
        response_timestamp: Any = None,
    ) -> dict[str, Any]:
        location = item.get("location") if isinstance(item.get("location"), dict) else {}
        current_flow = item.get("currentFlow") if isinstance(item.get("currentFlow"), dict) else {}
        if not current_flow:
            current_flow = item

        speed_mps = current_flow.get("speed")
        free_flow_mps = current_flow.get("freeFlow")
        reference = location.get("reference") or item.get("locationReference")
        if isinstance(reference, dict):
            reference = reference.get("id") or reference.get("reference")
        if reference is None:
            segment_ref = location.get("segmentRef")
            segments = segment_ref.get("segments") if isinstance(segment_ref, dict) else None
            if isinstance(segments, list) and segments and isinstance(segments[0], dict):
                reference = segments[0].get("ref")
        road_reference = reference or item.get("id")
        geometry = location.get("shape") or location.get("geometry") or item.get("geometry")
        timestamp = (
            current_flow.get("sourceUpdated")
            or item.get("sourceUpdated")
            or item.get("updated")
            or item.get("timestamp")
            or response_timestamp
        )

        return {
            "road_segment_reference": road_reference,
            "speed_mps": speed_mps,
            "speed_kph": self._mps_to_kph(speed_mps),
            "free_flow_speed_mps": free_flow_mps,
            "free_flow_speed_kph": self._mps_to_kph(free_flow_mps),
            "jam_factor": current_flow.get("jamFactor"),
            "confidence": current_flow.get("confidence"),
            "traversability": current_flow.get("traversability"),
            "road_geometry": geometry,
            "provider_timestamp": timestamp,
        }

    def _normalize_incident_item(
        self,
        item: dict[str, Any],
        response_timestamp: Any = None,
    ) -> dict[str, Any]:
        location = item.get("location") if isinstance(item.get("location"), dict) else {}
        incident = item.get("incident") if isinstance(item.get("incident"), dict) else item
        reference = location.get("reference") or item.get("locationReference")
        if isinstance(reference, dict):
            reference = reference.get("id") or reference.get("reference")
        if reference is None:
            segment_ref = location.get("segmentRef")
            segments = segment_ref.get("segments") if isinstance(segment_ref, dict) else None
            if isinstance(segments, list) and segments and isinstance(segments[0], dict):
                reference = segments[0].get("ref")
        type_description = incident.get("typeDescription")
        if isinstance(type_description, dict):
            type_description = type_description.get("value")
        return {
            "id": incident.get("id") or item.get("id"),
            "incident_type": incident.get("type") or incident.get("incidentType"),
            "summary": (
                incident.get("summary")
                or type_description
                or incident.get("description")
            ),
            "description": incident.get("description"),
            "start_time": incident.get("startTime"),
            "end_time": incident.get("endTime"),
            "criticality": incident.get("criticality"),
            "status": incident.get("status"),
            "road_closed": incident.get("roadClosed"),
            "road_segment_reference": reference,
            "road_geometry": (
                location.get("shape")
                or location.get("geometry")
                or item.get("geometry")
            ),
            "provider_timestamp": (
                incident.get("sourceUpdated")
                or incident.get("updated")
                or incident.get("timestamp")
                or response_timestamp
            ),
        }

    @staticmethod
    def _mps_to_kph(value: Any) -> float | None:
        if isinstance(value, (int, float)):
            return round(float(value) * 3.6, 3)
        return None


here_traffic_service = HereTrafficService()
