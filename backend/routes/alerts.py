from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from backend.repositories.paimana_repository import paimana_repository
from backend.services.state_manager import app_state

router = APIRouter(prefix="/api", tags=["Alerts"])

@router.get("/alerts")
def get_alerts(
    severity: Optional[str] = None,
    alertType: Optional[str] = None,
    sector: Optional[str] = None,
    state: Optional[str] = None,
    search: Optional[str] = None,
    limit: Optional[int] = Query(None, ge=1),
    offset: Optional[int] = Query(None, ge=0)
):
    res = paimana_repository.get_early_warning_alerts(
        severity=severity,
        alert_type=alertType,
        sector=sector,
        state=state,
        search=search,
        limit=limit,
        offset=offset
    )
    return {
        "dataSource": app_state.current_data_source,
        **res
    }

@router.get("/projects/{proj_id}/alert")
def get_project_alert(proj_id: str):
    alert = paimana_repository.get_project_alert(proj_id)
    if not alert:
        raise HTTPException(status_code=404, detail="No active early warning alert for this project")

    return {
        "dataSource": app_state.current_data_source,
        "alert": alert.model_dump()
    }
