from typing import Any, Literal

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from app.schemas.common import ApiEnvelope, success_response
from app.services.supabase_read_client import SupabaseReadError, supabase_read_client

router = APIRouter(prefix="/database", tags=["database"])


class DatabaseTableData(BaseModel):
    table: str
    source: Literal["SUPABASE"]
    access: Literal["ANON_RLS"]
    row_count: int
    items: list[dict[str, Any]]


async def _read_table(table: str) -> dict[str, object]:
    try:
        items = await supabase_read_client.get_rows(table)
    except SupabaseReadError as exc:
        code = (
            status.HTTP_503_SERVICE_UNAVAILABLE
            if exc.category == "not_configured"
            else status.HTTP_502_BAD_GATEWAY
        )
        detail = f"{exc.category}: {exc}"
        if exc.upstream_status is not None:
            detail = f"{detail} (upstream HTTP {exc.upstream_status})"
        raise HTTPException(status_code=code, detail=detail) from exc

    return success_response(
        f"Read-only {table} records retrieved from Supabase.",
        DatabaseTableData(
            table=table,
            source="SUPABASE",
            access="ANON_RLS",
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


@router.get("/signal-config", response_model=ApiEnvelope[DatabaseTableData])
async def signal_config() -> dict[str, object]:
    return await _read_table("signal_config")


@router.get("/vehicle-types", response_model=ApiEnvelope[DatabaseTableData])
async def vehicle_types() -> dict[str, object]:
    return await _read_table("vehicle_types")


@router.get("/scenarios", response_model=ApiEnvelope[DatabaseTableData])
async def scenarios() -> dict[str, object]:
    return await _read_table("traffic_scenarios")


@router.get("/scenario-approaches", response_model=ApiEnvelope[DatabaseTableData])
async def scenario_approaches() -> dict[str, object]:
    return await _read_table("scenario_approaches")
