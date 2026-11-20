from fastapi import APIRouter, Body, status

from app.schemas.common import ApiEnvelope, success_response
from app.schemas.simulation import (
    ScenarioRequest,
    SimulationMetrics,
    SimulationState,
    StartSimulationRequest,
)
from app.services.simulation_service import simulation_service

router = APIRouter(prefix="/simulation", tags=["simulation"])


@router.post("/start", status_code=status.HTTP_202_ACCEPTED)
async def start_simulation(
    request: StartSimulationRequest = Body(default_factory=StartSimulationRequest),
) -> dict[str, object]:
    await simulation_service.command(
        f"start ({request.scenario}, {request.controller_mode})"
    )
    return success_response("Simulation started.", simulation_service.get_status())


@router.post("/pause")
async def pause_simulation() -> dict[str, object]:
    await simulation_service.command("pause")
    return success_response("Simulation paused.", simulation_service.get_status())


@router.post("/resume")
async def resume_simulation() -> dict[str, object]:
    await simulation_service.command("resume")
    return success_response("Simulation resumed.", simulation_service.get_status())


@router.post("/stop")
async def stop_simulation() -> dict[str, object]:
    await simulation_service.command("stop")
    return success_response("Simulation stopped.", simulation_service.get_status())


@router.post("/reset")
async def reset_simulation() -> dict[str, object]:
    await simulation_service.command("reset")
    return success_response("Simulation reset.", simulation_service.get_status())


@router.post("/scenario")
async def select_scenario(request: ScenarioRequest) -> dict[str, object]:
    await simulation_service.set_scenario(request.scenario)
    return success_response("Scenario updated.", simulation_service.get_status())


@router.get("/status", response_model=ApiEnvelope[SimulationState])
async def simulation_status() -> dict[str, object]:
    return success_response("Simulation status retrieved.", simulation_service.get_status())


@router.get("/metrics", response_model=ApiEnvelope[SimulationMetrics])
async def simulation_metrics() -> dict[str, object]:
    return success_response(
        "Simulation metrics availability retrieved.",
        SimulationMetrics(
            available=False,
            items=[],
            reason="Simulation metrics are unavailable until SUMO is connected.",
        ),
    )
