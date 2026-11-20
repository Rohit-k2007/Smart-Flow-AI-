from fastapi import FastAPI

from app.api import ai, analytics, dashboard, database, emergency, health, reports, simulation, traffic, here_traffic
from app.core.config import settings
from app.core.cors import configure_cors
from app.core.exceptions import register_exception_handlers
from app.core.logging import configure_logging
from app.websocket.routes import router as websocket_router

configure_logging()


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="SmartFlow AI API. HERE traffic is available when configured; simulation and AI remain unavailable.",
)
configure_cors(app)
register_exception_handlers(app)
app.include_router(health.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")
app.include_router(simulation.router, prefix="/api")
app.include_router(traffic.router, prefix="/api")
app.include_router(database.router, prefix="/api")
app.include_router(ai.router, prefix="/api")
app.include_router(emergency.router, prefix="/api")
app.include_router(analytics.router, prefix="/api")
app.include_router(reports.router, prefix="/api")
app.include_router(here_traffic.router, prefix="/api")
app.include_router(websocket_router)
