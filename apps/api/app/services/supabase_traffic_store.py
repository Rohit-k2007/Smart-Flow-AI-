import logging
from datetime import datetime, timezone
from typing import Any
from urllib.parse import quote

import httpx

from app.core.config import settings
from app.services.here_traffic_service import HereProviderResponse
from app.services.supabase_read_client import supabase_read_client

logger = logging.getLogger(__name__)


class SupabaseTrafficStore:
    def __init__(self) -> None:
        self._timeout_seconds = 8.0

    @property
    def configured(self) -> bool:
        return bool(
            settings.supabase_url.strip()
            and settings.supabase_service_role_key.strip()
        )

    async def get_intersections(self) -> list[dict[str, Any]]:
        if not supabase_read_client.configured:
            return []

        try:
            return await supabase_read_client.get_rows(
                "intersections",
                select="id,name,latitude,longitude,geometry",
                filters={"city": f"eq.{settings.here_city}", "order": "name.asc"},
            )
        except RuntimeError as exc:
            logger.warning("Supabase intersection query failed: %s", type(exc).__name__)
            raise RuntimeError("The intersection catalog is temporarily unavailable.") from exc

    async def persist_live_data(
        self,
        flow: HereProviderResponse | None,
        incidents: HereProviderResponse | None,
        error: str | None = None,
    ) -> tuple[str, str | None]:
        if not self.configured:
            return "NOT_CONFIGURED", "Supabase persistence is not configured."

        now = datetime.now(timezone.utc).isoformat()
        try:
            async with httpx.AsyncClient(timeout=self._timeout_seconds) as client:
                if flow is not None:
                    rows = [self._observation_row(item) for item in flow.items]
                    if rows:
                        await self._insert(
                            client,
                            "traffic_observations",
                            rows,
                            "provider,city,provider_reference,provider_timestamp",
                        )
                if incidents is not None:
                    rows = [self._incident_row(item) for item in incidents.items]
                    if rows:
                        await self._insert(
                            client,
                            "traffic_incidents",
                            rows,
                            "provider,city,provider_reference,provider_timestamp",
                        )
                await self._insert(
                    client,
                    "provider_sync_logs",
                    [{
                        "provider": "HERE",
                        "city": settings.here_city,
                        "status": "DEGRADED" if error else "SUCCEEDED",
                        "observations_received": len(flow.items) if flow else 0,
                        "incidents_received": len(incidents.items) if incidents else 0,
                        "error_code": "PROVIDER_UNAVAILABLE" if error else None,
                        "message": error,
                        "completed_at": now,
                    }],
                )
        except (httpx.HTTPError, ValueError, RuntimeError) as exc:
            logger.warning("Supabase traffic persistence failed: %s", type(exc).__name__)
            return "UNAVAILABLE", "Live HERE data was retrieved, but persistence failed."

        return "PERSISTED", None

    async def _insert(
        self,
        client: httpx.AsyncClient,
        table: str,
        rows: list[dict[str, Any]],
        on_conflict: str | None = None,
    ) -> None:
        url = f"{settings.supabase_url.rstrip('/')}/rest/v1/{quote(table)}"
        response = await client.post(
            url,
            json=rows,
            params={"on_conflict": on_conflict} if on_conflict else None,
            headers={
                **self._headers(),
                "Prefer": (
                    "resolution=merge-duplicates,return=minimal"
                    if on_conflict
                    else "return=minimal"
                ),
            },
        )
        if response.is_error:
            raise RuntimeError(f"Supabase rejected {table} persistence.")

    @staticmethod
    def _headers() -> dict[str, str]:
        key = settings.supabase_service_role_key
        return {
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        }

    @staticmethod
    def _observation_row(item: dict[str, Any]) -> dict[str, Any]:
        return {
            "provider": "HERE",
            "city": settings.here_city,
            "provider_reference": item.get("road_segment_reference"),
            "speed_mps": item.get("speed_mps"),
            "free_flow_speed_mps": item.get("free_flow_speed_mps"),
            "jam_factor": item.get("jam_factor"),
            "confidence": item.get("confidence"),
            "traversability": item.get("traversability"),
            "geometry": item.get("road_geometry"),
            "provider_timestamp": item.get("provider_timestamp"),
        }

    @staticmethod
    def _incident_row(item: dict[str, Any]) -> dict[str, Any]:
        return {
            "provider": "HERE",
            "city": settings.here_city,
            "provider_reference": item.get("id"),
            "incident_type": item.get("incident_type"),
            "summary": item.get("summary"),
            "description": item.get("description"),
            "start_time": item.get("start_time"),
            "end_time": item.get("end_time"),
            "criticality": item.get("criticality"),
            "status": item.get("status"),
            "road_closed": item.get("road_closed"),
            "road_segment_reference": item.get("road_segment_reference"),
            "geometry": item.get("road_geometry"),
            "provider_timestamp": item.get("provider_timestamp"),
        }


supabase_traffic_store = SupabaseTrafficStore()
