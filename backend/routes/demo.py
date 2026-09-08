from typing import Optional
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from backend.repositories.paimana_repository import paimana_repository
from backend.services.state_manager import app_state

router = APIRouter(prefix="/api/demo", tags=["Demo"])

@router.post("/reset")
async def demo_reset(request: Request):
    try:
        body = await request.json()
    except Exception:
        body = {}

    preset = body.get("preset") if isinstance(body, dict) else None

    if preset == 'demo':
        app_state.set_data_source('DEMO')
        app_state.reset_demo()
        return {
            "success": True,
            "dataSource": "DEMO",
            "message": "Switched to DEMO showcase dataset (15 curated projects)",
            "count": len(app_state.demo_projects)
        }

    if preset == 'paimana':
        app_state.set_data_source('PAIMANA')
        return {
            "success": True,
            "dataSource": "PAIMANA",
            "message": "Switched to primary PAIMANA runtime dataset",
            "count": paimana_repository.get_stats()['uniqueProjects']
        }

    if preset == 'railway_escalation':
        app_state.set_data_source('DEMO')
        app_state.escalate_usbrl()
        return {
            "success": True,
            "dataSource": "DEMO",
            "message": "DEMO preset with USBRL escalation enabled",
            "count": len(app_state.demo_projects)
        }

    # Default reset
    if app_state.current_data_source == 'DEMO':
        app_state.reset_demo()

    ds = app_state.current_data_source
    count = paimana_repository.get_stats()['uniqueProjects'] if ds == 'PAIMANA' else len(app_state.demo_projects)
    return {
        "success": True,
        "dataSource": ds,
        "message": f"Data state reset. Active source: {ds}",
        "count": count
    }
