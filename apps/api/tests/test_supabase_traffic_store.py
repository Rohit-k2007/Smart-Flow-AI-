import asyncio
import json

import httpx
import pytest

from app.core.config import settings
from app.services.here_traffic_service import HereProviderResponse
from app.services.supabase_traffic_store import supabase_traffic_store


def mock_supabase_http(monkeypatch: pytest.MonkeyPatch, handler) -> None:
    transport = httpx.MockTransport(handler)
    real_async_client = httpx.AsyncClient

    def make_client(*args, **kwargs):
        kwargs["transport"] = transport
        return real_async_client(*args, **kwargs)

    monkeypatch.setattr(httpx, "AsyncClient", make_client)


def test_persistence_reports_unconfigured_without_discarding_live_data(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "supabase_url", "")
    monkeypatch.setattr(settings, "supabase_service_role_key", "")

    flow = HereProviderResponse(
        available=True,
        status="CONNECTED",
        items=[{"speed_mps": 12}],
        reason="Test provider fixture.",
    )
    status, reason = asyncio.run(
        supabase_traffic_store.persist_live_data(flow, None)
    )

    assert status == "NOT_CONFIGURED"
    assert "not configured" in reason.lower()


def test_persisted_observations_keep_provider_units_and_use_backend_auth(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "supabase_url", "https://project.supabase.co")
    monkeypatch.setattr(settings, "supabase_service_role_key", "server-only-key")
    posted: list[tuple[str, list[dict[str, object]]]] = []

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.headers["apikey"] == "server-only-key"
        assert request.headers["authorization"] == "Bearer server-only-key"
        if request.method == "POST":
            if request.url.path.endswith("/traffic_observations"):
                assert request.url.params["on_conflict"] == (
                    "provider,city,provider_reference,provider_timestamp"
                )
                assert request.headers["prefer"] == (
                    "resolution=merge-duplicates,return=minimal"
                )
            posted.append((request.url.path, json.loads(request.content)))
            return httpx.Response(201)
        return httpx.Response(404)

    mock_supabase_http(monkeypatch, handler)
    flow = HereProviderResponse(
        available=True,
        status="CONNECTED",
        items=[{
            "road_segment_reference": "road-1",
            "speed_mps": 12.5,
            "speed_kph": 45,
            "free_flow_speed_mps": 20,
            "jam_factor": 3.2,
            "confidence": 0.9,
            "traversability": "open",
            "road_geometry": {"links": []},
            "provider_timestamp": "2026-11-20T05:00:00Z",
        }],
        reason="Test provider fixture.",
    )

    status, reason = asyncio.run(supabase_traffic_store.persist_live_data(flow, None))

    assert status == "PERSISTED"
    assert reason is None
    observation_path, observation_rows = posted[0]
    assert observation_path.endswith("/traffic_observations")
    assert observation_rows[0]["speed_mps"] == 12.5
    assert "speed_kph" not in observation_rows[0]
    assert posted[-1][0].endswith("/provider_sync_logs")
