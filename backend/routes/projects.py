from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse
from backend.repositories.paimana_repository import paimana_repository
from backend.repositories.demo_data import compute_demo_kpis
from backend.services.project_query_service import ProjectQueryService
from backend.services.state_manager import app_state

router = APIRouter(prefix="/api", tags=["Projects"])

@router.get("/projects")
def get_projects(
    sector: Optional[str] = None,
    state: Optional[str] = None,
    agency: Optional[str] = None,
    riskTier: Optional[str] = None,
    priorityTier: Optional[str] = None,
    search: Optional[str] = None,
    sortBy: str = 'id',
    sortDirection: str = 'asc',
    limit: Optional[int] = Query(None, ge=0),
    offset: Optional[int] = Query(None, ge=0)
):
    ds = app_state.current_data_source

    if ds == 'PAIMANA':
        res = ProjectQueryService.query(
            search=search,
            state=state,
            agency=agency,
            sector=sector,
            risk_tier=riskTier,
            priority_tier=priorityTier,
            sort_by=sortBy,
            sort_direction=sortDirection,
            limit=limit,
            offset=offset
        )
        return {
            "dataSource": "PAIMANA",
            "projects": res['projects'],
            "kpis": res['kpis'],
            "totalCount": res['totalCount']
        }

    # Demo fallback
    filtered = list(app_state.demo_projects)
    if sector and sector != 'ALL':
        filtered = [p for p in filtered if p.sector == sector]
    if state and state != 'ALL':
        filtered = [p for p in filtered if p.state == state]
    if agency and agency != 'ALL':
        filtered = [p for p in filtered if p.implementingAgency.lower() == agency.lower()]
    if riskTier and riskTier != 'ALL':
        filtered = [p for p in filtered if p.riskTier == riskTier]
    if search and isinstance(search, str):
        s = search.lower()
        filtered = [
            p for p in filtered
            if s in p.name.lower() or
               s in p.code.lower() or
               s in p.implementingAgency.lower() or
               (p.location and s in p.location.city.lower())
        ]

    is_asc = (sortDirection == 'asc')
    filtered.sort(key=lambda p: (getattr(p, sortBy, None) is None, getattr(p, sortBy, '')), reverse=not is_asc)

    kpis = compute_demo_kpis(filtered)
    total_count = len(filtered)
    if offset is not None or limit is not None:
        off = offset or 0
        lim = limit if limit is not None else total_count
        filtered = filtered[off: off + lim]

    return {
        "dataSource": "DEMO",
        "projects": [p.model_dump() for p in filtered],
        "kpis": kpis.model_dump(),
        "totalCount": total_count
    }

@router.get("/projects/{proj_id}/history")
def get_project_history(proj_id: str):
    observations = paimana_repository.get_project_observations(proj_id)
    if not observations:
        # Check DEMO mode
        demo = next((p for p in app_state.demo_projects if p.id == proj_id), None)
        if demo:
            return {
                "projectId": demo.id,
                "dataSource": "DEMO",
                "monthlyTrend": [m.model_dump() for m in demo.monthlyTrend],
                "total": len(demo.monthlyTrend)
            }
        raise HTTPException(status_code=404, detail="No observations found for project")

    return {
        "projectId": proj_id,
        "dataSource": "PAIMANA",
        "observations": [o.model_dump() for o in observations],
        "total": len(observations)
    }

@router.get("/projects/{proj_id}/observations")
def get_project_observations_alias(proj_id: str):
    observations = paimana_repository.get_project_observations(proj_id)
    return {
        "projectId": proj_id,
        "dataSource": "PAIMANA",
        "observations": [o.model_dump() for o in observations],
        "total": len(observations)
    }

@router.get("/projects/{proj_id}/risk")
def get_project_risk(proj_id: str):
    assessment = paimana_repository.get_project_risk_assessment(proj_id)
    if not assessment:
        demo = next((p for p in app_state.demo_projects if p.id == proj_id), None)
        if demo:
            return {
                "projectId": demo.id,
                "dataSource": "DEMO",
                "riskScore": demo.riskScore,
                "riskTier": demo.riskTier,
                "indicators": [],
                "primaryConcerns": ["DEMO mode — PRISM Risk Index not applicable. Use the DEMO What-If simulator."],
                "evidenceConfidence": None,
                "observationCount": 0,
                "note": "DEMO projects use the legacy heuristic engine. PRISM Risk Index applies to PAIMANA projects only."
            }
        raise HTTPException(status_code=404, detail="Risk assessment not found for project")

    res = assessment.model_dump()
    res["projectId"] = proj_id
    res["dataSource"] = "PAIMANA"
    return res

@router.get("/projects/{proj_id}")
def get_project_detail(proj_id: str):
    ds = app_state.current_data_source
    if ds == 'PAIMANA':
        project = paimana_repository.get_project_by_id(proj_id)
        if project:
            return project.model_dump()
        demo = next((p for p in app_state.demo_projects if p.id == proj_id), None)
        if demo:
            return demo.model_dump()
        raise HTTPException(status_code=404, detail="Project not found in PAIMANA repository")

    demo = next((p for p in app_state.demo_projects if p.id == proj_id), None)
    if not demo:
        raise HTTPException(status_code=404, detail="Project not found")
    return demo.model_dump()

@router.get("/projects/{proj_id}/benchmark")
def get_project_benchmark_endpoint(proj_id: str):
    benchmark = paimana_repository.get_project_benchmark(proj_id)
    if not benchmark:
        raise HTTPException(status_code=404, detail=f"Benchmarking not available for project '{proj_id}'")
    return benchmark
