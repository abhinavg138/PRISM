from backend.routes.health import router as health_router
from backend.routes.metadata import router as metadata_router
from backend.routes.projects import router as projects_router
from backend.routes.priorities import router as priorities_router
from backend.routes.alerts import router as alerts_router
from backend.routes.sectors import router as sectors_router
from backend.routes.analytics import router as analytics_router
from backend.routes.simulation import router as simulation_router
from backend.routes.copilot import router as copilot_router
from backend.routes.demo import router as demo_router

routers = [
    health_router,
    metadata_router,
    projects_router,
    priorities_router,
    alerts_router,
    sectors_router,
    analytics_router,
    simulation_router,
    copilot_router,
    demo_router
]
