import os
import re
from typing import Optional, Dict, Any, List
from pathlib import Path
from fastapi import APIRouter, HTTPException, Query, Request, Response, Depends
from fastapi.responses import FileResponse, RedirectResponse, JSONResponse
from pydantic import BaseModel, Field, ConfigDict, AliasChoices

from backend.config import ROOT_DIR, ADMIN_DB_PATH
from backend.repositories.paimana_repository import paimana_repository
from backend.services.admin_service import AdminService
from backend.models.project import Project

admin_router = APIRouter(prefix="/api/admin", tags=["Admin Control Plane"])
admin_views_router = APIRouter(tags=["Admin Views"])

ADMIN_HTML_DIR = ROOT_DIR / "frontend" / "admin"

# =============================================================================
# Request / Response Schemas
# =============================================================================
class LoginRequest(BaseModel):
    username: str
    password: str

class ProjectCreateRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str = Field(..., description="Unique alphanumeric Project ID")
    name: str = Field(..., min_length=3, max_length=250)
    ministry: Optional[str] = "Central Sector Oversight"
    sector: str
    state: str
    implementingAgency: Optional[str] = Field("Admin Registered", validation_alias=AliasChoices("implementingAgency", "agency"))
    originalCostCr: float = Field(..., ge=0.0, validation_alias=AliasChoices("originalCostCr", "original_cost"))
    revisedCostCr: Optional[float] = Field(None, ge=0.0, validation_alias=AliasChoices("revisedCostCr", "revised_cost"))
    cumulativeExpenditureCr: Optional[float] = Field(0.0, ge=0.0, validation_alias=AliasChoices("cumulativeExpenditureCr", "cumulative_expenditure"))
    originalStartDate: Optional[str] = Field("", validation_alias=AliasChoices("originalStartDate", "original_start_date"))
    originalCompletionDate: Optional[str] = Field("", validation_alias=AliasChoices("originalCompletionDate", "original_date"))
    revisedCompletionDate: Optional[str] = Field("", validation_alias=AliasChoices("revisedCompletionDate", "revised_date"))
    physicalProgressPercent: float = Field(0.0, ge=0.0, le=100.0, validation_alias=AliasChoices("physicalProgressPercent", "physical_progress"))
    financialProgressPercent: Optional[float] = Field(0.0, ge=0.0, le=100.0, validation_alias=AliasChoices("financialProgressPercent", "financial_progress"))
    reason: Optional[str] = "Initial registration via Admin Panel"

class ProjectUpdateRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    name: Optional[str] = None
    ministry: Optional[str] = None
    sector: Optional[str] = None
    state: Optional[str] = None
    implementingAgency: Optional[str] = Field(None, validation_alias=AliasChoices("implementingAgency", "agency"))
    originalCostCr: Optional[float] = Field(None, ge=0.0, validation_alias=AliasChoices("originalCostCr", "original_cost"))
    revisedCostCr: Optional[float] = Field(None, ge=0.0, validation_alias=AliasChoices("revisedCostCr", "revised_cost"))
    cumulativeExpenditureCr: Optional[float] = Field(None, ge=0.0, validation_alias=AliasChoices("cumulativeExpenditureCr", "cumulative_expenditure"))
    originalCompletionDate: Optional[str] = Field(None, validation_alias=AliasChoices("originalCompletionDate", "original_date"))
    revisedCompletionDate: Optional[str] = Field(None, validation_alias=AliasChoices("revisedCompletionDate", "revised_date"))
    physicalProgressPercent: Optional[float] = Field(None, ge=0.0, le=100.0, validation_alias=AliasChoices("physicalProgressPercent", "physical_progress"))
    financialProgressPercent: Optional[float] = Field(None, ge=0.0, le=100.0, validation_alias=AliasChoices("financialProgressPercent", "financial_progress"))
    reason: Optional[str] = "Administrative record update"

class ArchiveRequest(BaseModel):
    reason: Optional[str] = "Project archived by administrator"

# =============================================================================
# Auth Dependency & Guards
# =============================================================================
def get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "127.0.0.1"

def get_current_admin(request: Request) -> Dict[str, Any]:
    """Authoritative admin authentication guard."""
    token = request.cookies.get("prism_admin_session")
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header[7:].strip()

    if not token:
        raise HTTPException(
            status_code=401,
            detail="Authentication required: No administrative session token provided."
        )

    session = AdminService.validate_session(token)
    if not session:
        raise HTTPException(
            status_code=401,
            detail="Session invalid or expired. Please re-authenticate."
        )
    return session

def check_admin_html_auth(request: Request) -> bool:
    """Helper for HTML view redirection."""
    token = request.cookies.get("prism_admin_session")
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header[7:].strip()
    if not token:
        return False
    return AdminService.validate_session(token) is not None

# =============================================================================
# Admin Auth APIs
# =============================================================================
@admin_router.post("/auth/login")
def admin_login(payload: LoginRequest, request: Request, response: Response):
    client_ip = get_client_ip(request)

    if AdminService.is_rate_limited(client_ip):
        raise HTTPException(
            status_code=429,
            detail="Too many failed login attempts. Account temporarily locked for 5 minutes."
        )

    if not AdminService.verify_credentials(payload.username, payload.password):
        AdminService.record_failed_attempt(client_ip)
        raise HTTPException(
            status_code=401,
            detail="Invalid administrative username or password."
        )

    AdminService.reset_failed_attempts(client_ip)
    token, expires_at = AdminService.create_session(payload.username.strip())

    # Set secure HttpOnly cookie
    response.set_cookie(
        key="prism_admin_session",
        value=token,
        max_age=86400,
        httponly=True,
        samesite="lax",
        secure=False,  # Allow localhost development
        path="/"
    )

    return {
        "status": "success",
        "username": payload.username.strip(),
        "token": token,
        "expiresAt": expires_at
    }

@admin_router.post("/auth/logout")
def admin_logout(request: Request, response: Response):
    token = request.cookies.get("prism_admin_session")
    if token:
        AdminService.delete_session(token)
    response.delete_cookie("prism_admin_session", path="/")
    return {"status": "success", "message": "Administrative session terminated."}

@admin_router.get("/auth/me")
def admin_me(admin: Dict[str, Any] = Depends(get_current_admin)):
    return {
        "authenticated": True,
        "username": admin["username"],
        "expiresAt": admin["expiresAt"],
        "user": {
            "username": admin["username"],
            "role": "Super Admin"
        }
    }

# =============================================================================
# Admin Overview & Metrics API
# =============================================================================
@admin_router.get("/overview")
def get_admin_overview(admin: Dict[str, Any] = Depends(get_current_admin)):
    paimana_repository.ensure_loaded()
    all_projects = list(paimana_repository.projects_map.values())
    active_projects = [p for p in all_projects if not getattr(p, "isArchived", False)]
    archived_count = len(all_projects) - len(active_projects)

    added_count = sum(1 for p in active_projects if getattr(p, "recordType", "") == "ADMIN_ADDED")
    modified_count = sum(1 for p in active_projects if getattr(p, "recordType", "") == "ADMIN_MODIFIED")

    # Sectors distribution
    sector_counts: Dict[str, int] = {}
    for p in active_projects:
        s = p.sector or "Other Infrastructure"
        sector_counts[s] = sector_counts.get(s, 0) + 1

    # State distribution (top 8)
    state_counts: Dict[str, int] = {}
    for p in active_projects:
        st = p.state or "Unspecified"
        state_counts[st] = state_counts.get(st, 0) + 1
    top_states = sorted(state_counts.items(), key=lambda x: x[1], reverse=True)[:8]

    # Risk counts
    risk_counts = {
        "CRITICAL": sum(1 for p in active_projects if p.riskTier == "CRITICAL"),
        "HIGH": sum(1 for p in active_projects if p.riskTier == "HIGH"),
        "MODERATE": sum(1 for p in active_projects if p.riskTier == "MODERATE"),
        "LOW": sum(1 for p in active_projects if p.riskTier == "LOW")
    }

    # Priority counts
    priority_counts = {
        "P1": sum(1 for p in active_projects if p.priorityTier == "P1"),
        "P2": sum(1 for p in active_projects if p.priorityTier == "P2"),
        "P3": sum(1 for p in active_projects if p.priorityTier == "P3")
    }

    # Last audit log
    recent_logs = AdminService.get_audit_logs(limit=1)["logs"]
    last_mod = recent_logs[0] if recent_logs else None

    return {
        "totalProjects": len(active_projects),
        "total_projects": len(active_projects),
        "totalAllRecords": len(all_projects),
        "archivedCount": archived_count,
        "addedManuallyCount": added_count,
        "modifiedManuallyCount": modified_count,
        "sectorsCount": len(sector_counts),
        "sectorDistribution": sector_counts,
        "by_sector": sector_counts,
        "topStates": [{"state": s, "count": c} for s, c in top_states],
        "riskDistribution": risk_counts,
        "priorityDistribution": priority_counts,
        "p1_count": priority_counts.get("P1", 0),
        "lastModification": last_mod
    }

# =============================================================================
# Admin Project Management APIs (CRUD)
# =============================================================================
@admin_router.get("/projects")
def admin_list_projects(
    search: Optional[str] = None,
    state: Optional[str] = None,
    sector: Optional[str] = None,
    ministry: Optional[str] = None,
    riskTier: Optional[str] = None,
    priorityTier: Optional[str] = None,
    recordType: Optional[str] = None,
    includeArchived: bool = False,
    sortBy: str = "id",
    sortDirection: str = "asc",
    limit: int = Query(15, ge=1, le=100),
    offset: int = Query(0, ge=0),
    admin: Dict[str, Any] = Depends(get_current_admin)
):
    paimana_repository.ensure_loaded()
    res = paimana_repository.list_projects(
        search=search,
        state=state,
        sector=sector,
        risk_tier=riskTier,
        priority_tier=priorityTier,
        sort_by=sortBy,
        sort_direction=sortDirection,
        limit=limit,
        offset=offset,
        include_archived=includeArchived,
        record_type=recordType
    )

    # If ministry filter is provided
    if ministry and ministry != "ALL":
        m_lower = ministry.strip().lower()
        filtered = [p for p in res["allMatching"] if (p.ministry or "").lower() == m_lower]
        total = len(filtered)
        paginated = filtered[offset: offset + limit]
        return {
            "projects": [p.model_dump() for p in paginated],
            "totalCount": total,
            "limit": limit,
            "offset": offset
        }

    return {
        "projects": [p.model_dump() for p in res["projects"]],
        "totalCount": res["totalCount"],
        "limit": limit,
        "offset": offset
    }

@admin_router.get("/projects/{proj_id}")
def admin_get_project(
    proj_id: str,
    admin: Dict[str, Any] = Depends(get_current_admin)
):
    p = paimana_repository.get_project_by_id(proj_id, include_archived=True)
    if not p:
        raise HTTPException(status_code=404, detail=f"Project '{proj_id}' not found.")

    overrides = AdminService.get_project_overrides(proj_id)
    audit = AdminService.get_audit_logs(limit=20, project_id=proj_id)["logs"]

    data = p.model_dump()
    data["adminOverrides"] = overrides
    data["auditHistory"] = audit
    return data

@admin_router.post("/projects")
def admin_create_project(
    payload: ProjectCreateRequest,
    admin: Dict[str, Any] = Depends(get_current_admin)
):
    pid = payload.id.strip()

    # Authoritative backend validation
    if not re.match(r'^[a-zA-Z0-9_\-]+$', pid):
        raise HTTPException(
            status_code=400,
            detail="Project ID must contain only alphanumeric characters, underscores, or hyphens."
        )

    if paimana_repository.get_project_by_id(pid, include_archived=True):
        raise HTTPException(
            status_code=400,
            detail=f"Project ID '{pid}' already exists. Project IDs must be strictly unique."
        )

    if not payload.name or len(payload.name.strip()) < 3:
        raise HTTPException(status_code=400, detail="Project Name must be at least 3 characters.")

    rev_cost = payload.revisedCostCr if payload.revisedCostCr is not None else payload.originalCostCr

    pdata = {
        "id": pid,
        "name": payload.name.strip(),
        "ministry": payload.ministry.strip() if payload.ministry else "Central Sector Oversight",
        "sector": payload.sector.strip(),
        "state": payload.state.strip(),
        "implementingAgency": payload.implementingAgency.strip() if payload.implementingAgency else "Admin Registered",
        "originalCostCr": payload.originalCostCr,
        "revisedCostCr": rev_cost,
        "cumulativeExpenditureCr": payload.cumulativeExpenditureCr or 0.0,
        "originalStartDate": payload.originalStartDate or "",
        "originalCompletionDate": payload.originalCompletionDate or "",
        "revisedCompletionDate": payload.revisedCompletionDate or payload.originalCompletionDate or "",
        "physicalProgressPercent": payload.physicalProgressPercent,
        "reason": payload.reason or "Created by administrator"
    }

    try:
        created = paimana_repository.add_admin_project(pdata, user=admin["username"])
        return {
            "status": "success",
            "success": True,
            "message": f"Project '{pid}' successfully created and assessed by PRISM engines.",
            "project": created.model_dump()
        }
    except Exception as err:
        raise HTTPException(status_code=500, detail=f"Failed to create project: {str(err)}")

@admin_router.put("/projects/{proj_id}")
def admin_update_project(
    proj_id: str,
    payload: ProjectUpdateRequest,
    admin: Dict[str, Any] = Depends(get_current_admin)
):
    pid = proj_id.strip()
    existing = paimana_repository.get_project_by_id(pid, include_archived=True)
    if not existing:
        raise HTTPException(status_code=404, detail=f"Project '{pid}' not found.")

    updates: Dict[str, Any] = {}

    if payload.name is not None:
        if len(payload.name.strip()) < 3:
            raise HTTPException(status_code=400, detail="Project name must be at least 3 characters.")
        updates["name"] = payload.name.strip()

    if payload.ministry is not None:
        updates["ministry"] = payload.ministry.strip()

    if payload.sector is not None:
        updates["sector"] = payload.sector.strip()

    if payload.state is not None:
        updates["state"] = payload.state.strip()

    if payload.implementingAgency is not None:
        updates["implementingAgency"] = payload.implementingAgency.strip()

    if payload.originalCostCr is not None:
        if payload.originalCostCr < 0:
            raise HTTPException(status_code=400, detail="Original cost cannot be negative.")
        updates["originalCostCr"] = payload.originalCostCr

    if payload.revisedCostCr is not None:
        if payload.revisedCostCr < 0:
            raise HTTPException(status_code=400, detail="Revised cost cannot be negative.")
        updates["revisedCostCr"] = payload.revisedCostCr

    if payload.cumulativeExpenditureCr is not None:
        if payload.cumulativeExpenditureCr < 0:
            raise HTTPException(status_code=400, detail="Cumulative expenditure cannot be negative.")
        updates["cumulativeExpenditureCr"] = payload.cumulativeExpenditureCr

    if payload.physicalProgressPercent is not None:
        if payload.physicalProgressPercent < 0 or payload.physicalProgressPercent > 100:
            raise HTTPException(status_code=400, detail="Physical progress must be between 0.0% and 100.0%.")
        updates["physicalProgressPercent"] = payload.physicalProgressPercent

    if payload.originalCompletionDate is not None:
        updates["originalCompletionDate"] = payload.originalCompletionDate.strip()

    if payload.revisedCompletionDate is not None:
        updates["revisedCompletionDate"] = payload.revisedCompletionDate.strip()

    if not updates:
        return {
            "status": "unchanged",
            "message": "No fields modified.",
            "project": existing.model_dump()
        }

    try:
        updated = paimana_repository.update_admin_project(
            project_id=pid,
            updates=updates,
            user=admin["username"],
            reason=payload.reason
        )
        return {
            "status": "success",
            "success": True,
            "message": f"Project '{pid}' updated and PRISM intelligence recalculated.",
            "project": updated.model_dump()
        }
    except Exception as err:
        raise HTTPException(status_code=500, detail=f"Failed to update project: {str(err)}")

@admin_router.post("/projects/{proj_id}/archive")
def admin_archive_project(
    proj_id: str,
    payload: ArchiveRequest = ArchiveRequest(),
    admin: Dict[str, Any] = Depends(get_current_admin)
):
    pid = proj_id.strip()
    try:
        paimana_repository.archive_admin_project(pid, user=admin["username"], reason=payload.reason)
        return {
            "status": "success",
            "success": True,
            "message": f"Project '{pid}' successfully archived."
        }
    except ValueError as val_err:
        raise HTTPException(status_code=404, detail=str(val_err))
    except Exception as err:
        raise HTTPException(status_code=500, detail=f"Failed to archive project: {str(err)}")

@admin_router.post("/projects/{proj_id}/unarchive")
def admin_unarchive_project(
    proj_id: str,
    payload: ArchiveRequest = ArchiveRequest(),
    admin: Dict[str, Any] = Depends(get_current_admin)
):
    pid = proj_id.strip()
    try:
        paimana_repository.unarchive_admin_project(pid, user=admin["username"], reason=payload.reason)
        return {
            "status": "success",
            "success": True,
            "message": f"Project '{pid}' successfully unarchived."
        }
    except ValueError as val_err:
        raise HTTPException(status_code=404, detail=str(val_err))
    except Exception as err:
        raise HTTPException(status_code=500, detail=f"Failed to unarchive project: {str(err)}")

# =============================================================================
# Audit Log & Data Validation APIs
# =============================================================================
@admin_router.get("/audit-log")
def admin_get_audit_log(
    action: Optional[str] = None,
    projectId: Optional[str] = None,
    user: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    admin: Dict[str, Any] = Depends(get_current_admin)
):
    res = AdminService.get_audit_logs(
        limit=limit,
        offset=offset,
        action=action,
        project_id=projectId,
        user=user
    )
    res["entries"] = res.get("logs", [])
    return res

@admin_router.get("/data-validation")
def admin_get_data_validation(
    admin: Dict[str, Any] = Depends(get_current_admin)
):
    paimana_repository.ensure_loaded()
    all_projects = list(paimana_repository.projects_map.values())
    res = AdminService.scan_data_validation(all_projects)
    res["total_projects"] = res["summary"]["total"]
    res["valid_records"] = res["summary"]["valid"]
    res["warnings"] = res["summary"]["warnings"]
    res["errors"] = res["summary"]["errors"]
    return res

@admin_router.get("/system")
def admin_get_system_info(
    admin: Dict[str, Any] = Depends(get_current_admin)
):
    paimana_repository.ensure_loaded()
    db_file = Path(ADMIN_DB_PATH)
    db_size_kb = round(db_file.stat().st_size / 1024, 1) if db_file.exists() else 0
    db_size_bytes = db_file.stat().st_size if db_file.exists() else 0

    all_projects = list(paimana_repository.projects_map.values())
    active_projects = [p for p in all_projects if not getattr(p, "isArchived", False)]
    archived_count = len(all_projects) - len(active_projects)

    added_count = sum(1 for p in all_projects if getattr(p, "recordType", "") == "ADMIN_ADDED")
    modified_count = sum(1 for p in all_projects if getattr(p, "recordType", "") == "ADMIN_MODIFIED")

    return {
        "prismVersion": "2.1.0-sih2026",
        "backendStatus": "Healthy",
        "backend_status": "Healthy",
        "databaseEngine": "SQLite (WAL Mode)",
        "databasePath": str(db_file),
        "database_path": str(db_file),
        "databaseSizeKb": db_size_kb,
        "database_size_bytes": db_size_bytes,
        "datasetSnapshot": "MoSPI PAIMANA Apr–Jul 2026",
        "totalUniqueProjects": len(all_projects),
        "activeProjects": len(active_projects),
        "archivedProjects": archived_count,
        "adminAddedProjects": added_count,
        "adminModifiedProjects": modified_count,
        "totalObservations": len(paimana_repository.observations),
        "authenticatedUser": admin["username"]
    }

# =============================================================================
# HTML Views for Admin Panel
# =============================================================================
@admin_views_router.get("/admin/login")
def admin_login_page(request: Request):
    if check_admin_html_auth(request):
        return RedirectResponse(url="/admin", status_code=302)
    login_file = ADMIN_HTML_DIR / "login.html"
    if login_file.exists():
        return FileResponse(str(login_file))
    return JSONResponse(status_code=404, content={"error": "Admin login template not found."})

@admin_views_router.get("/admin")
@admin_views_router.get("/admin/")
def admin_dashboard_page(request: Request):
    if not check_admin_html_auth(request):
        return RedirectResponse(url="/admin/login", status_code=302)
    index_file = ADMIN_HTML_DIR / "index.html"
    if index_file.exists():
        return FileResponse(str(index_file))
    return JSONResponse(status_code=404, content={"error": "Admin dashboard template not found."})

@admin_views_router.get("/admin/projects")
def admin_projects_page(request: Request):
    if not check_admin_html_auth(request):
        return RedirectResponse(url="/admin/login", status_code=302)
    file_path = ADMIN_HTML_DIR / "projects.html"
    if file_path.exists():
        return FileResponse(str(file_path))
    return RedirectResponse(url="/admin", status_code=302)

@admin_views_router.get("/admin/projects/new")
def admin_new_project_page(request: Request):
    if not check_admin_html_auth(request):
        return RedirectResponse(url="/admin/login", status_code=302)
    file_path = ADMIN_HTML_DIR / "project-form.html"
    if file_path.exists():
        return FileResponse(str(file_path))
    return RedirectResponse(url="/admin", status_code=302)

@admin_views_router.get("/admin/projects/{project_id}/edit")
def admin_edit_project_page(project_id: str, request: Request):
    if not check_admin_html_auth(request):
        return RedirectResponse(url="/admin/login", status_code=302)
    file_path = ADMIN_HTML_DIR / "project-form.html"
    if file_path.exists():
        return FileResponse(str(file_path))
    return RedirectResponse(url="/admin", status_code=302)

@admin_views_router.get("/admin/validation")
@admin_views_router.get("/admin/data-validation")
def admin_validation_page(request: Request):
    if not check_admin_html_auth(request):
        return RedirectResponse(url="/admin/login", status_code=302)
    file_path = ADMIN_HTML_DIR / "validation.html"
    if file_path.exists():
        return FileResponse(str(file_path))
    return RedirectResponse(url="/admin", status_code=302)

@admin_views_router.get("/admin/audit")
@admin_views_router.get("/admin/audit-log")
def admin_audit_page(request: Request):
    if not check_admin_html_auth(request):
        return RedirectResponse(url="/admin/login", status_code=302)
    file_path = ADMIN_HTML_DIR / "audit.html"
    if file_path.exists():
        return FileResponse(str(file_path))
    return RedirectResponse(url="/admin", status_code=302)

@admin_views_router.get("/admin/system")
def admin_system_page(request: Request):
    if not check_admin_html_auth(request):
        return RedirectResponse(url="/admin/login", status_code=302)
    file_path = ADMIN_HTML_DIR / "system.html"
    if file_path.exists():
        return FileResponse(str(file_path))
    return RedirectResponse(url="/admin", status_code=302)
