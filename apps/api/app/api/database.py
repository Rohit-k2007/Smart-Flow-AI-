from typing import Any, Literal

from fastapi import APIRouter, HTTPException, status
from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel

from app.schemas.common import ApiEnvelope, success_response
from app.services.neon_database import NeonDatabaseError, neon_database_client

router = APIRouter(prefix="/database", tags=["database"])


class DatabaseTableData(BaseModel):
    table: str
    source: Literal["NEON_POSTGRESQL"]
    access: Literal["READ_ONLY"]
    row_count: int
    items: list[dict[str, Any]]


class DatabaseHealthData(BaseModel):
    provider: Literal["NEON_POSTGRESQL"]
    connected: bool


def _database_http_error(exc: NeonDatabaseError) -> HTTPException:
    if exc.category == "table_not_found":
        code = status.HTTP_404_NOT_FOUND
    elif exc.category == "permission_denied":
        code = status.HTTP_403_FORBIDDEN
    elif exc.category in {
        "not_configured",
        "invalid_configuration",
        "connection_error",
        "authentication_failed",
    }:
        code = status.HTTP_503_SERVICE_UNAVAILABLE
    else:
        code = status.HTTP_502_BAD_GATEWAY
    return HTTPException(status_code=code, detail=f"{exc.category}: {exc}")


@router.get("/health", response_model=ApiEnvelope[DatabaseHealthData])
async def database_health() -> dict[str, object]:
    try:
        connected = await neon_database_client.check_connection()
    except NeonDatabaseError as exc:
        raise _database_http_error(exc) from exc

    return success_response(
        "Neon PostgreSQL connection verified.",
        DatabaseHealthData(provider="NEON_POSTGRESQL", connected=connected),
    )


async def _read_table(table: str) -> dict[str, object]:
    try:
        items = jsonable_encoder(await neon_database_client.get_rows(table))
    except NeonDatabaseError as exc:
        raise _database_http_error(exc) from exc

    return success_response(
        f"Read-only {table} records retrieved from Neon PostgreSQL.",
        DatabaseTableData(
            table=table,
            source="NEON_POSTGRESQL",
            access="READ_ONLY",
            row_count=len(items),
            items=items,
        ),
    )


@router.get("/junctions", response_model=ApiEnvelope[DatabaseTableData])
async def junctions() -> dict[str, object]:
    return await _read_table("junctions")


@router.get("/observations", response_model=ApiEnvelope[DatabaseTableData])
async def observations() -> dict[str, object]:
    return await _read_table("traffic_observations")


@router.get("/traffic-observations", response_model=ApiEnvelope[DatabaseTableData])
async def traffic_observations() -> dict[str, object]:
    return await _read_table("traffic_observations")


@router.get("/signal-config", response_model=ApiEnvelope[DatabaseTableData])
async def signal_config() -> dict[str, object]:
    return await _read_table("signal_config")


@router.get("/vehicle-types", response_model=ApiEnvelope[DatabaseTableData])
async def vehicle_types() -> dict[str, object]:
    return await _read_table("vehicle_types")


@router.get("/scenarios", response_model=ApiEnvelope[DatabaseTableData])
async def scenarios() -> dict[str, object]:
    return await _read_table("traffic_scenarios")


@router.get("/traffic-scenarios", response_model=ApiEnvelope[DatabaseTableData])
async def traffic_scenarios() -> dict[str, object]:
    return await _read_table("traffic_scenarios")


@router.get("/scenario-approaches", response_model=ApiEnvelope[DatabaseTableData])
async def scenario_approaches() -> dict[str, object]:
    return await _read_table("scenario_approaches")
