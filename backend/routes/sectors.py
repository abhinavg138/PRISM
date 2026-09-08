from fastapi import APIRouter
from backend.repositories.paimana_repository import paimana_repository
from backend.services.state_manager import app_state

router = APIRouter(prefix="/api", tags=["Sectors"])

@router.get("/sectors")
def get_sectors():
    ds = app_state.current_data_source
    if ds == 'PAIMANA':
        sectors = paimana_repository.get_sector_stats()
        return {
            "dataSource": "PAIMANA",
            "sectors": [s.model_dump() for s in sectors],
            "totalProjects": sum(s.totalProjects for s in sectors),
            "note": "Sector classifications are derived from implementing agencies."
        }

    sectors = paimana_repository.get_sector_stats(app_state.demo_projects)
    return {
        "dataSource": "DEMO",
        "sectors": [s.model_dump() for s in sectors],
        "totalProjects": len(app_state.demo_projects),
        "note": "Sector classifications are derived from implementing agencies."
    }
