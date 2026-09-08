import os
from datetime import datetime, timezone
from fastapi import APIRouter
from backend.repositories.paimana_repository import paimana_repository
from backend.services.state_manager import app_state

router = APIRouter(prefix="/api", tags=["Health"])

@router.get("/health")
def get_health():
    stats = paimana_repository.get_stats()
    ds = app_state.current_data_source
    total_projects = stats['uniqueProjects'] if ds == 'PAIMANA' else len(app_state.demo_projects)
    has_key = bool(os.getenv("GEMINI_API_KEY"))

    return {
        "status": "operational",
        "platform": "PRISM - Predictive Risk Intelligence & Smart Monitoring",
        "version": "2.1.0-sih2026",
        "dataSource": ds,
        "totalProjectsMonitored": total_projects,
        "totalObservationsLoaded": stats['totalObservations'],
        "projectsWith4Months": stats['projectsWith4Months'],
        "projectsMissingCoordinates": stats['projectsMissingCoordinates'],
        "projectsUnrated": stats['projectsUnrated'],
        "reportMonths": stats['reportMonths'],
        "hasGeminiKey": has_key,
        "demoMode": ds == 'DEMO',
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
