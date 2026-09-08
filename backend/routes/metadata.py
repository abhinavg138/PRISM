from fastapi import APIRouter
from backend.repositories.paimana_repository import paimana_repository
from backend.services.state_manager import app_state

router = APIRouter(prefix="/api", tags=["Metadata"])

@router.get("/metadata")
def get_metadata():
    stats = paimana_repository.get_stats()
    ds = app_state.current_data_source

    if ds == 'PAIMANA':
        return {
            "dataSource": "PAIMANA",
            "states": paimana_repository.get_states(),
            "agencies": paimana_repository.get_agencies(),
            "sectors": paimana_repository.get_sectors(),
            "stats": stats
        }
    else:
        demo = app_state.demo_projects
        return {
            "dataSource": "DEMO",
            "states": sorted(list(set(p.state for p in demo if p.state))),
            "agencies": sorted(list(set(p.implementingAgency for p in demo if p.implementingAgency))),
            "sectors": sorted(list(set(p.sector for p in demo if p.sector))),
            "stats": stats
        }
