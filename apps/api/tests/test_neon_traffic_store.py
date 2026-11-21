import asyncio
from contextlib import contextmanager
from typing import Any

import pytest

from app.core.config import settings
from app.services.here_traffic_service import HereProviderResponse
from app.services.neon_database import NeonDatabaseError, neon_database_client
from app.services.neon_traffic_store import neon_traffic_store


class FakeCursor:
    def __init__(self) -> None:
        self.batches: list[tuple[object, list[tuple[Any, ...]]]] = []
        self.executed: list[tuple[object, tuple[Any, ...]]] = []

    def __enter__(self) -> "FakeCursor":
        return self

    def __exit__(self, *_args: object) -> None:
        return None

    def executemany(self, statement: object, rows: list[tuple[Any, ...]]) -> None:
        self.batches.append((statement, rows))

    def execute(self, statement: object, parameters: tuple[Any, ...]) -> None:
        self.executed.append((statement, parameters))


class FakeConnection:
    def __init__(self) -> None:
        self.fake_cursor = FakeCursor()

    def __enter__(self) -> "FakeConnection":
        return self

    def __exit__(self, *_args: object) -> None:
        return None

    def cursor(self) -> FakeCursor:
        return self.fake_cursor


def test_persistence_reports_not_configured(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "database_url", "")
    flow = HereProviderResponse(
        available=True,
        status="CONNECTED",
        items=[{"speed_mps": 12}],
        reason="Test provider fixture.",
    )

    result = asyncio.run(neon_traffic_store.persist_live_data(flow, None))

    assert result[0] == "NOT_CONFIGURED"
    assert "not configured" in result[1].lower()


def test_persistence_uses_parameterized_neon_statements(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        settings,
        "database_url",
        "postgresql://test:test@ep-test.us-east-1.aws.neon.tech/smartflow",
    )
    connection = FakeConnection()

    @contextmanager
    def fake_connection(*, read_only: bool = True):
        assert read_only is False
        yield connection

    monkeypatch.setattr(neon_database_client, "connection", fake_connection)
    flow = HereProviderResponse(
        available=True,
        status="CONNECTED",
        items=[{
            "road_segment_reference": "road-1",
            "speed_mps": 12.5,
            "free_flow_speed_mps": 20,
            "jam_factor": 3.2,
            "confidence": 0.9,
            "traversability": "open",
            "road_geometry": {"links": []},
            "provider_timestamp": "2026-11-20T05:00:00Z",
        }],
        reason="Test provider fixture.",
    )

    result = asyncio.run(neon_traffic_store.persist_live_data(flow, None))

    assert result == ("PERSISTED", None)
    assert len(connection.fake_cursor.batches) == 1
    observation_statement, observation_rows = connection.fake_cursor.batches[0]
    assert "INSERT INTO public.traffic_observations" in observation_statement.as_string(None)
    assert observation_rows[0][2] == "road-1"
    assert observation_rows[0][3] == 12.5
    assert observation_rows[0][8].obj == {"links": []}
    assert "INSERT INTO public.provider_sync_logs" in (
        connection.fake_cursor.executed[0][0].as_string(None)
    )
