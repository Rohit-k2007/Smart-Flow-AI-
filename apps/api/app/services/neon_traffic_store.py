import logging
from datetime import datetime, timezone
from typing import Any

from psycopg import sql
from psycopg.types.json import Jsonb
from starlette.concurrency import run_in_threadpool

from app.core.config import settings
from app.services.here_traffic_service import HereProviderResponse
from app.services.neon_database import NeonDatabaseError, neon_database_client

logger = logging.getLogger(__name__)

_OBSERVATION_UPSERT = sql.SQL(
    "INSERT INTO public.traffic_observations ("
    "provider, city, provider_reference, speed_mps, free_flow_speed_mps, "
    "jam_factor, confidence, traversability, geometry, provider_timestamp"
    ") VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s) "
    "ON CONFLICT (provider, city, provider_reference, provider_timestamp) "
    "DO UPDATE SET speed_mps = EXCLUDED.speed_mps, "
    "free_flow_speed_mps = EXCLUDED.free_flow_speed_mps, "
    "jam_factor = EXCLUDED.jam_factor, confidence = EXCLUDED.confidence, "
    "traversability = EXCLUDED.traversability, geometry = EXCLUDED.geometry"
)

_INCIDENT_UPSERT = sql.SQL(
    "INSERT INTO public.traffic_incidents ("
    "provider, city, provider_reference, incident_type, summary, description, "
    "start_time, end_time, criticality, status, road_closed, "
    "road_segment_reference, geometry, provider_timestamp"
    ") VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) "
    "ON CONFLICT (provider, city, provider_reference, provider_timestamp) "
    "DO UPDATE SET incident_type = EXCLUDED.incident_type, "
    "summary = EXCLUDED.summary, description = EXCLUDED.description, "
    "start_time = EXCLUDED.start_time, end_time = EXCLUDED.end_time, "
    "criticality = EXCLUDED.criticality, status = EXCLUDED.status, "
    "road_closed = EXCLUDED.road_closed, "
    "road_segment_reference = EXCLUDED.road_segment_reference, "
    "geometry = EXCLUDED.geometry"
)

_SYNC_LOG_INSERT = sql.SQL(
    "INSERT INTO public.provider_sync_logs ("
    "provider, city, status, observations_received, incidents_received, "
    "error_code, message, completed_at"
    ") VALUES (%s, %s, %s, %s, %s, %s, %s, %s)"
)


class NeonTrafficStore:
    @property
    def configured(self) -> bool:
        return neon_database_client.configured

    async def get_intersections(self) -> list[dict[str, Any]]:
        if not self.configured:
            return []

        try:
            return await neon_database_client.get_intersections(settings.here_city)
        except NeonDatabaseError:
            logger.warning("Neon intersection query failed.")
            raise RuntimeError(
                "The intersection catalog is temporarily unavailable."
            ) from None

    async def persist_live_data(
        self,
        flow: HereProviderResponse | None,
        incidents: HereProviderResponse | None,
        error: str | None = None,
    ) -> tuple[str, str | None]:
        if not self.configured:
            return "NOT_CONFIGURED", "Neon PostgreSQL persistence is not configured."

        now = datetime.now(timezone.utc)
        observation_rows = [
            self._observation_row(item) for item in (flow.items if flow else [])
        ]
        incident_rows = [
            self._incident_row(item) for item in (incidents.items if incidents else [])
        ]
        sync_log = (
            "HERE",
            settings.here_city,
            "DEGRADED" if error else "SUCCEEDED",
            len(observation_rows),
            len(incident_rows),
            "PROVIDER_UNAVAILABLE" if error else None,
            error,
            now,
        )

        try:
            await run_in_threadpool(
                self._persist_rows,
                observation_rows,
                incident_rows,
                sync_log,
            )
        except NeonDatabaseError as exc:
            logger.warning(
                "Neon traffic persistence failed (%s).",
                exc.category,
            )
            return "UNAVAILABLE", "Live HERE data was retrieved, but Neon persistence failed."
        except (TypeError, ValueError) as exc:
            logger.warning(
                "Neon traffic persistence failed (%s).",
                type(exc).__name__,
            )
            return "UNAVAILABLE", "Live HERE data was retrieved, but Neon persistence failed."

        return "PERSISTED", None

    @staticmethod
    def _persist_rows(
        observation_rows: list[tuple[Any, ...]],
        incident_rows: list[tuple[Any, ...]],
        sync_log: tuple[Any, ...],
    ) -> None:
        with neon_database_client.connection(read_only=False) as connection:
            with connection.cursor() as cursor:
                if observation_rows:
                    cursor.executemany(_OBSERVATION_UPSERT, observation_rows)
                if incident_rows:
                    cursor.executemany(_INCIDENT_UPSERT, incident_rows)
                cursor.execute(_SYNC_LOG_INSERT, sync_log)

    @staticmethod
    def _observation_row(item: dict[str, Any]) -> tuple[Any, ...]:
        geometry = item.get("road_geometry")
        return (
            "HERE",
            settings.here_city,
            item.get("road_segment_reference"),
            item.get("speed_mps"),
            item.get("free_flow_speed_mps"),
            item.get("jam_factor"),
            item.get("confidence"),
            item.get("traversability"),
            Jsonb(geometry) if geometry is not None else None,
            item.get("provider_timestamp"),
        )

    @staticmethod
    def _incident_row(item: dict[str, Any]) -> tuple[Any, ...]:
        geometry = item.get("road_geometry")
        return (
            "HERE",
            settings.here_city,
            item.get("id"),
            item.get("incident_type"),
            item.get("summary"),
            item.get("description"),
            item.get("start_time"),
            item.get("end_time"),
            item.get("criticality"),
            item.get("status"),
            item.get("road_closed"),
            item.get("road_segment_reference"),
            Jsonb(geometry) if geometry is not None else None,
            item.get("provider_timestamp"),
        )


neon_traffic_store = NeonTrafficStore()
