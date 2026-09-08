from fastapi import APIRouter
from backend.repositories.paimana_repository import paimana_repository
from backend.services.state_manager import app_state

router = APIRouter(prefix="/api", tags=["Analytics"])

@router.get("/analytics")
def get_analytics():
    ds = app_state.current_data_source
    if ds == 'PAIMANA':
        analytics = paimana_repository.get_full_analytics()
        return {
            "dataSource": "PAIMANA",
            **analytics
        }

    analytics = paimana_repository.get_full_analytics(app_state.demo_projects)
    return {
        "dataSource": "DEMO",
        **analytics
    }
