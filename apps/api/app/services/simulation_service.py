import asyncio

from fastapi import HTTPException, status

from app.schemas.simulation import ScenarioType, SimulationState

SIMULATION_UNAVAILABLE_REASON = (
    "SUMO and the simulation engine are not configured. No simulation command was executed."
)


class SimulationService:
    def __init__(self) -> None:
        self._lock = asyncio.Lock()
        self._state = SimulationState(
            available=False,
            status="inactive",
            run_id=None,
            scenario=None,
            controller_mode=None,
            reason=SIMULATION_UNAVAILABLE_REASON,
        )

    def get_status(self) -> SimulationState:
        return self._state

    async def command(self, action: str) -> None:
        async with self._lock:
            if self._state.status in ("running", "paused"):
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="A simulation run is already active.",
                )
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"{SIMULATION_UNAVAILABLE_REASON} Action requested: {action}.",
            )

    async def set_scenario(self, scenario: ScenarioType) -> None:
        del scenario
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=SIMULATION_UNAVAILABLE_REASON,
        )


simulation_service = SimulationService()
