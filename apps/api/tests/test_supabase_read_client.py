import httpx
import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app

client = TestClient(app)

TABLE_PATHS = {
    "/api/database/junctions": "junctions",
    "/api/database/observations": "traffic_observations",
    "/api/database/signal-config": "signal_config",
    "/api/database/vehicle-types": "vehicle_types",
    "/api/database/scenarios": "traffic_scenarios",
    "/api/database/scenario-approaches": "scenario_approaches",
}


def mock_supabase_http(monkeypatch: pytest.MonkeyPatch, handler) -> None:
    transport = httpx.MockTransport(handler)
    real_async_client = httpx.AsyncClient

    def make_client(*args, **kwargs):
        kwargs["transport"] = transport
        return real_async_client(*args, **kwargs)

    monkeypatch.setattr(httpx, "AsyncClient", make_client)


@pytest.mark.parametrize(("path", "table"), TABLE_PATHS.items())
def test_read_routes_use_anon_key_and_return_database_rows(
    monkeypatch: pytest.MonkeyPatch,
    path: str,
    table: str,
) -> None:
    public_key = "sb_publishable_test_key"
    monkeypatch.setattr(settings, "supabase_url", "https://project.supabase.co")
    monkeypatch.setattr(settings, "supabase_anon_key", public_key)
    monkeypatch.setattr(settings, "supabase_service_role_key", "must-not-be-used")

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.method == "GET"
        assert request.url.path.endswith(f"/{table}")
        assert request.headers["apikey"] == public_key
        assert "authorization" not in request.headers
        assert request.headers["prefer"] == "count=exact"
        return httpx.Response(200, json=[{"id": 1, "example": "stored"}])

    mock_supabase_http(monkeypatch, handler)
    response = client.get(path)

    assert response.status_code == 200
    data = response.json()["data"]
    assert data["table"] == table
    assert data["source"] == "SUPABASE"
    assert data["access"] == "ANON_RLS"
    assert data["row_count"] == 1
    assert data["items"] == [{"id": 1, "example": "stored"}]


def test_legacy_anon_jwt_is_sent_for_rls_role(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    anon_jwt = "header.payload.signature"
    monkeypatch.setattr(settings, "supabase_url", "https://project.supabase.co")
    monkeypatch.setattr(settings, "supabase_anon_key", anon_jwt)

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.headers["apikey"] == anon_jwt
        assert request.headers["authorization"] == f"Bearer {anon_jwt}"
        return httpx.Response(200, json=[])

    mock_supabase_http(monkeypatch, handler)
    response = client.get("/api/database/junctions")

    assert response.status_code == 200
    assert response.json()["data"]["row_count"] == 0


def test_authentication_error_is_explicit_and_redacted(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    public_key = "sb_publishable_secret_test"
    monkeypatch.setattr(settings, "supabase_url", "https://project.supabase.co")
    monkeypatch.setattr(settings, "supabase_anon_key", public_key)

    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(401, json={"message": f"Invalid API key {public_key}"})

    mock_supabase_http(monkeypatch, handler)
    response = client.get("/api/database/junctions")

    assert response.status_code == 502
    assert "authentication_failed" in response.json()["message"]
    assert "HTTP 401" in response.json()["message"]
    assert public_key not in response.text


def test_rls_permission_denial_is_reported_without_bypass(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "supabase_url", "https://project.supabase.co")
    monkeypatch.setattr(settings, "supabase_anon_key", "sb_publishable_test_key")

    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(403, json={"message": "row level security denied"})

    mock_supabase_http(monkeypatch, handler)
    response = client.get("/api/database/junctions")

    assert response.status_code == 502
    assert "permission_denied" in response.json()["message"]
    assert "HTTP 403" in response.json()["message"]


def test_read_endpoint_is_unavailable_without_anon_configuration(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "supabase_url", "")
    monkeypatch.setattr(settings, "supabase_anon_key", "")

    response = client.get("/api/database/junctions")

    assert response.status_code == 503
    assert "not_configured" in response.json()["message"]


def test_database_router_registers_all_six_get_routes() -> None:
    openapi = app.openapi()
    for path in TABLE_PATHS:
        assert "get" in openapi["paths"][path]
