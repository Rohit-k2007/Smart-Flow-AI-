from unittest.mock import MagicMock

import psycopg
import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app
from app.services.neon_database import NeonDatabaseClient, neon_database_client

client = TestClient(app)
TABLE_PATHS = {
    "/api/database/junctions": "junctions",
    "/api/database/traffic-observations": "traffic_observations",
    "/api/database/signal-config": "signal_config",
    "/api/database/vehicle-types": "vehicle_types",
    "/api/database/traffic-scenarios": "traffic_scenarios",
    "/api/database/scenario-approaches": "scenario_approaches",
}
TEST_DATABASE_URL = (
    "postgresql://test-user:test-password@ep-test.us-east-1.aws.neon.tech/"
    "smartflow?sslmode=verify-full"
)


class FakeCursor:
    def __init__(
        self,
        *,
        rows: list[dict[str, object]] | None = None,
        error: psycopg.Error | None = None,
    ) -> None:
        self.rows = rows or []
        self.error = error
        self.executed: list[tuple[object, object]] = []

    def __enter__(self) -> "FakeCursor":
        return self

    def __exit__(self, *_args: object) -> None:
        return None

    def execute(self, statement: object, parameters: object = None) -> None:
        self.executed.append((statement, parameters))
        if self.error:
            raise self.error

    def fetchone(self) -> dict[str, int]:
        return {"connected": 1}

    def fetchall(self) -> list[dict[str, object]]:
        return self.rows


class FakeConnection:
    def __init__(self, cursor: FakeCursor) -> None:
        self.fake_cursor = cursor
        self.executed: list[tuple[object, object]] = []

    def __enter__(self) -> "FakeConnection":
        return self

    def __exit__(self, *_args: object) -> None:
        return None

    def execute(self, statement: object, parameters: object = None) -> None:
        self.executed.append((statement, parameters))

    def cursor(self) -> FakeCursor:
        return self.fake_cursor


def mock_connection(
    monkeypatch: pytest.MonkeyPatch,
    *,
    rows: list[dict[str, object]] | None = None,
    error: psycopg.Error | None = None,
) -> tuple[FakeConnection, MagicMock]:
    cursor = FakeCursor(rows=rows, error=error)
    connection = FakeConnection(cursor)
    connect = MagicMock(return_value=connection)
    monkeypatch.setattr("app.services.neon_database.psycopg.connect", connect)
    return connection, connect


def test_database_health_executes_select_one(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "database_url", TEST_DATABASE_URL)
    connection, _connect = mock_connection(monkeypatch)

    response = client.get("/api/database/health")

    assert response.status_code == 200
    assert response.json()["data"] == {
        "provider": "NEON_POSTGRESQL",
        "connected": True,
    }
    assert connection.executed == [("SET TRANSACTION READ ONLY", None)]
    assert connection.fake_cursor.executed[0] == ("SELECT 1 AS connected", None)


def test_database_health_reports_missing_configuration(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "database_url", "")

    response = client.get("/api/database/health")

    assert response.status_code == 503
    assert "not_configured" in response.json()["message"]


@pytest.mark.parametrize(("path", "table"), TABLE_PATHS.items())
def test_read_routes_use_read_only_parameterized_queries(
    monkeypatch: pytest.MonkeyPatch,
    path: str,
    table: str,
) -> None:
    monkeypatch.setattr(settings, "database_url", TEST_DATABASE_URL)
    connection, connect = mock_connection(
        monkeypatch,
        rows=[{"id": 7, "name": "stored"}],
    )

    response = client.get(path)

    assert response.status_code == 200
    data = response.json()["data"]
    assert data["table"] == table
    assert data["source"] == "NEON_POSTGRESQL"
    assert data["access"] == "READ_ONLY"
    assert data["row_count"] == 1
    assert data["items"] == [{"id": 7, "name": "stored"}]
    assert connect.call_args.kwargs["row_factory"] is not None
    assert connection.executed == [("SET TRANSACTION READ ONLY", None)]
    assert connection.fake_cursor.executed[0][1] == (1000,)
    assert f'"{table}"' in connection.fake_cursor.executed[0][0].as_string(None)


@pytest.mark.parametrize(
    ("error", "status_code", "category"),
    [
        (psycopg.errors.UndefinedTable("missing"), 404, "table_not_found"),
        (psycopg.errors.InsufficientPrivilege("denied"), 403, "permission_denied"),
        (psycopg.errors.InvalidPassword("rejected"), 503, "authentication_failed"),
    ],
)
def test_database_errors_are_classified(
    monkeypatch: pytest.MonkeyPatch,
    error: psycopg.Error,
    status_code: int,
    category: str,
) -> None:
    monkeypatch.setattr(settings, "database_url", TEST_DATABASE_URL)
    mock_connection(monkeypatch, error=error)

    response = client.get("/api/database/traffic-observations")

    assert response.status_code == status_code
    assert category in response.json()["message"]
    assert "test-password" not in response.text


def test_neon_connection_uri_must_target_neon(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        settings,
        "database_url",
        "postgresql://test-user:test-password@db.example.com/smartflow",
    )

    response = client.get("/api/database/health")

    assert response.status_code == 503
    assert "invalid_configuration" in response.json()["message"]
    assert "test-password" not in response.text


def test_read_route_rejects_unallowlisted_table() -> None:
    import asyncio

    with pytest.raises(ValueError):
        asyncio.run(neon_database_client.get_rows("junctions; DROP TABLE users"))
