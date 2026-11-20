from uuid import UUID

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.websocket.manager import connection_manager

router = APIRouter()


@router.websocket("/ws/simulation/{run_id}")
async def simulation_updates(websocket: WebSocket, run_id: str) -> None:
    try:
        normalized_run_id = str(UUID(run_id))
    except ValueError:
        await websocket.close(code=1008, reason="Invalid simulation run ID.")
        return

    await connection_manager.connect(normalized_run_id, websocket)
    try:
        await connection_manager.send_status(normalized_run_id, websocket)
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        connection_manager.disconnect(normalized_run_id, websocket)
