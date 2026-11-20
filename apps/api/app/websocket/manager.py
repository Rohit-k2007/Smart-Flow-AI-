import logging
from collections import defaultdict

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self) -> None:
        self._connections: dict[str, set[WebSocket]] = defaultdict(set)

    async def connect(self, run_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections[run_id].add(websocket)
        logger.info("WebSocket connected for run %s", run_id)

    def disconnect(self, run_id: str, websocket: WebSocket) -> None:
        connections = self._connections.get(run_id)
        if connections is None:
            return
        connections.discard(websocket)
        if not connections:
            self._connections.pop(run_id, None)
        logger.info("WebSocket disconnected for run %s", run_id)

    async def send_status(self, run_id: str, websocket: WebSocket) -> None:
        from app.schemas.common import utc_now
        from app.services.simulation_service import simulation_service

        await websocket.send_json(
            {
                "success": True,
                "event": "simulation.status",
                "data": simulation_service.get_status().model_dump(mode="json"),
                "timestamp": utc_now().isoformat(),
            }
        )


connection_manager = ConnectionManager()
