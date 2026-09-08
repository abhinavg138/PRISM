import math
from typing import Dict, Any, Optional
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse
from backend.repositories.paimana_repository import paimana_repository
from backend.services.scenario_engine import ScenarioEngine
from backend.services.copilot_service import CopilotService
from backend.services.state_manager import app_state
from backend.models.simulation import SimulationParams
from backend.services.rate_limiter import simulation_limiter

router = APIRouter(prefix="/api", tags=["Simulation"])

def sanitize_num(val: Any, min_val: float, max_val: float, default: float = 0.0) -> float:
    if val is None:
        return default
    try:
        n = float(val)
        if math.isnan(n) or math.isinf(n):
            return default
        return max(min_val, min(max_val, n))
    except (ValueError, TypeError):
        return default

@router.post("/simulate")
async def simulate_scenario(request: Request):
    simulation_limiter.check(request)
    try:
        body = await request.json()
    except Exception:
        return JSONResponse(status_code=400, content={"error": "Malformed JSON payload"})

    if not isinstance(body, dict):
        return JSONResponse(status_code=400, content={"error": "Invalid request body"})

    project_id = body.get("projectId")
    if not project_id or not isinstance(project_id, str):
        return JSONResponse(status_code=400, content={"error": "Missing projectId"})

    project = None
    if app_state.current_data_source == 'PAIMANA':
        project = paimana_repository.get_project_by_id(project_id)
    if not project:
        project = next((p for p in app_state.demo_projects if p.id == project_id), None)
    if not project:
        return JSONResponse(status_code=404, content={"error": "Project not found"})

    raw_params = body.get("params") or {}
    sim_params = SimulationParams(
        projectId=project_id,
        landClearanceAccelerationWeeks=sanitize_num(raw_params.get("landClearanceAccelerationWeeks"), 0.0, 52.0, 0.0),
        contractorLiquidityInjectionPercent=sanitize_num(raw_params.get("contractorLiquidityInjectionPercent"), 0.0, 100.0, 0.0),
        weatherGeologicalMitigationLevel=sanitize_num(raw_params.get("weatherGeologicalMitigationLevel"), 0.0, 100.0, 0.0),
        fastTrackHighPowerCommittee=bool(raw_params.get("fastTrackHighPowerCommittee"))
    )

    assessment = (
        paimana_repository.get_project_risk_assessment(project_id)
        if app_state.current_data_source == 'PAIMANA' else None
    )

    sim_result = ScenarioEngine.simulate(project, sim_params, assessment=assessment)
    return sim_result.model_dump()

@router.post("/intervention-lab/narrative")
async def generate_intervention_narrative(request: Request):
    try:
        body = await request.json()
    except Exception:
        return JSONResponse(status_code=400, content={"error": "Malformed JSON payload"})

    if not isinstance(body, dict):
        return JSONResponse(status_code=400, content={"error": "Invalid request body"})

    project_id = body.get("projectId")
    scenario_result = body.get("scenarioResult")
    if not project_id or not scenario_result:
        return JSONResponse(status_code=400, content={"error": "Missing projectId or scenarioResult"})

    project = None
    if app_state.current_data_source == 'PAIMANA':
        project = paimana_repository.get_project_by_id(project_id)
    if not project:
        project = next((p for p in app_state.demo_projects if p.id == project_id), None)
    if not project:
        return JSONResponse(status_code=404, content={"error": "Project not found"})

    try:
        response = await CopilotService.generate_narrative(project, scenario_result)
        return response.model_dump()
    except Exception as err:
        print(f"[Intervention Lab] Error generating executive brief narrative: {err}")
        return JSONResponse(status_code=500, content={"error": "Failed to generate brief narrative"})
