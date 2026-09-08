from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from backend.repositories.paimana_repository import paimana_repository

router = APIRouter(prefix="/api", tags=["Priorities"])

@router.get("/priorities")
def list_priorities(
    limit: int = Query(50, ge=1),
    state: Optional[str] = None,
    agency: Optional[str] = None,
    sector: Optional[str] = None,
    priorityTier: Optional[str] = None
):
    res = paimana_repository.list_priorities(
        limit=limit,
        state=state,
        agency=agency,
        sector=sector,
        priority_tier=priorityTier
    )
    return {
        "dataSource": "PAIMANA",
        **res
    }

@router.get("/priorities/{proj_id}")
@router.get("/projects/{proj_id}/priority")
def get_project_priority(proj_id: str):
    priority = paimana_repository.get_project_priority_assessment(proj_id)
    if not priority:
        raise HTTPException(status_code=404, detail="Priority assessment not found for project")

    return {
        "dataSource": "PAIMANA",
        **priority.model_dump()
    }
