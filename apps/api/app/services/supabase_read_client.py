import logging
from typing import Any
from urllib.parse import quote

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

READABLE_TABLES = frozenset({
    "junctions",
    "traffic_observations",
    "signal_config",
    "vehicle_types",
    "traffic_scenarios",
    "scenario_approaches",
    "intersections",
})


class SupabaseReadError(RuntimeError):
    def __init__(
        self,
        message: str,
        *,
        category: str,
        upstream_status: int | None = None,
    ) -> None:
        super().__init__(message)
        self.category = category
        self.upstream_status = upstream_status


class SupabaseReadClient:
    def __init__(self) -> None:
        self._timeout_seconds = 8.0
        self._max_rows = 1000

    @property
    def configured(self) -> bool:
        return bool(settings.supabase_url.strip() and settings.supabase_anon_key.strip())

    async def get_rows(
        self,
        table: str,
        *,
        filters: dict[str, str] | None = None,
        select: str = "*",
        limit: int = 1000,
    ) -> list[dict[str, Any]]:
        if table not in READABLE_TABLES:
            raise ValueError("The requested table is not allow-listed.")
        if not self.configured:
            raise SupabaseReadError(
                "Supabase read-only access is not configured.",
                category="not_configured",
            )

        params = {"select": select, "limit": str(min(max(limit, 1), self._max_rows))}
        if filters:
            params.update(filters)

        url = f"{settings.supabase_url.rstrip('/')}/rest/v1/{quote(table)}"
        try:
            async with httpx.AsyncClient(timeout=self._timeout_seconds) as client:
                response = await client.get(url, params=params, headers=self._headers())
        except httpx.TimeoutException as exc:
            logger.warning("Supabase read timed out for table %s.", table)
            raise SupabaseReadError(
                "Supabase read request timed out.",
                category="timeout",
            ) from exc
        except httpx.HTTPError as exc:
            logger.warning("Supabase read failed for table %s: %s", table, type(exc).__name__)
            raise SupabaseReadError(
                "Supabase read request failed.",
                category="connection_error",
            ) from exc

        if response.is_error:
            category, message = self._error_details(response.status_code)
            logger.warning(
                "Supabase rejected read for table %s with HTTP %s (%s).",
                table,
                response.status_code,
                category,
            )
            raise SupabaseReadError(
                message,
                category=category,
                upstream_status=response.status_code,
            )

        try:
            payload = response.json()
        except ValueError as exc:
            raise SupabaseReadError(
                "Supabase returned invalid JSON.",
                category="invalid_response",
                upstream_status=response.status_code,
            ) from exc

        if not isinstance(payload, list) or any(not isinstance(row, dict) for row in payload):
            raise SupabaseReadError(
                "Supabase returned an invalid table response.",
                category="invalid_response",
                upstream_status=response.status_code,
            )
        return payload

    @staticmethod
    def _headers() -> dict[str, str]:
        key = settings.supabase_anon_key.strip()
        headers = {
            "apikey": key,
            "Accept": "application/json",
            "Prefer": "count=exact",
        }
        if not key.startswith("sb_publishable_"):
            headers["Authorization"] = f"Bearer {key}"
        return headers

    @staticmethod
    def _error_details(status_code: int) -> tuple[str, str]:
        if status_code == 401:
            return "authentication_failed", "Supabase authentication failed (HTTP 401)."
        if status_code == 403:
            return "permission_denied", "Supabase denied this read (HTTP 403); check grants and RLS policies."
        if status_code == 404:
            return "table_not_found", "Supabase could not find the requested table (HTTP 404)."
        if status_code == 429:
            return "rate_limited", "Supabase rate-limited the read request (HTTP 429)."
        return "provider_error", f"Supabase read failed (HTTP {status_code})."


supabase_read_client = SupabaseReadClient()
