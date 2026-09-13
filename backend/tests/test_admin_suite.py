import tempfile
import os
from pathlib import Path
import pytest
from fastapi.testclient import TestClient
from backend.main import app
import backend.config as config
from backend.repositories.paimana_repository import paimana_repository
from backend.services.admin_service import AdminService, get_db_connection

client = TestClient(app)

TEST_ADMIN_USER = "test_admin_suite"
TEST_ADMIN_PASS = "test_password_suite_secure_123"
TEST_SECRET_KEY = "test_jwt_secret_key_prism_isolated_test"

@pytest.fixture(scope="module", autouse=True)
def setup_isolated_admin_env(tmp_path_factory):
    """
    Ensure admin test suite runs against an isolated temporary SQLite database
    and temporary test credentials, never touching production state or credentials.
    """
    temp_dir = tmp_path_factory.mktemp("prism_admin_test_dir")
    test_db = str(temp_dir / "prism_test_admin.db")

    orig_db_path = config.ADMIN_DB_PATH
    orig_user = config.ADMIN_USERNAME
    orig_pass = config.ADMIN_PASSWORD
    orig_secret = config.ADMIN_SECRET_KEY

    config.ADMIN_DB_PATH = test_db
    config.ADMIN_USERNAME = TEST_ADMIN_USER
    config.ADMIN_PASSWORD = TEST_ADMIN_PASS
    config.ADMIN_SECRET_KEY = TEST_SECRET_KEY

    # Initialize isolated schema
    AdminService.init_db()
    # Reload repository cleanly
    paimana_repository.load(force=True)

    yield

    # Teardown: restore original configurations
    config.ADMIN_DB_PATH = orig_db_path
    config.ADMIN_USERNAME = orig_user
    config.ADMIN_PASSWORD = orig_pass
    config.ADMIN_SECRET_KEY = orig_secret
    paimana_repository.load(force=True)

@pytest.fixture(scope="module")
def admin_token(setup_isolated_admin_env):
    res = client.post("/api/admin/auth/login", json={
        "username": TEST_ADMIN_USER,
        "password": TEST_ADMIN_PASS
    })
    assert res.status_code == 200
    data = res.json()
    assert "token" in data
    return data["token"]

def test_admin_login_invalid():
    res = client.post("/api/admin/auth/login", json={
        "username": "wrong_user",
        "password": "wrong_password"
    })
    assert res.status_code == 401

def test_admin_unauthenticated_access():
    res = client.post("/api/admin/projects", json={"id": "test_unauth"})
    assert res.status_code == 401

def test_admin_me(admin_token):
    res = client.get("/api/admin/auth/me", headers={"Authorization": f"Bearer {admin_token}"})
    assert res.status_code == 200
    data = res.json()
    assert data["authenticated"] is True
    assert data["user"]["username"] == TEST_ADMIN_USER

def test_admin_overview(admin_token):
    res = client.get("/api/admin/overview", headers={"Authorization": f"Bearer {admin_token}"})
    assert res.status_code == 200
    data = res.json()
    assert "total_projects" in data
    assert data["total_projects"] >= 2000
    assert "p1_count" in data
    assert "by_sector" in data

def test_admin_create_project_and_duplicate_rejection(admin_token):
    test_id = "PRISM_TEST_9901"

    payload = {
        "id": test_id,
        "name": "Admin Unit Test Corridor Project",
        "ministry": "Ministry of Road Transport and Highways",
        "sector": "Road Transport and Highways",
        "state": "Maharashtra",
        "agency": "NHAI",
        "original_cost": 1500.0,
        "revised_cost": 1750.0,
        "cumulative_expenditure": 600.0,
        "original_date": "2026-03-31",
        "revised_date": "2027-06-30",
        "physical_progress": 45.0,
        "financial_progress": 34.2,
        "status": "Ongoing",
        "remarks": "Automated test project"
    }

    # 1. Create project
    res = client.post("/api/admin/projects", json=payload, headers={"Authorization": f"Bearer {admin_token}"})
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["project"]["id"] == test_id
    assert data["project"]["recordType"] == "ADMIN_ADDED"
    assert data["project"]["riskScore"] is not None

    # Verify project exists in repo
    proj = paimana_repository.get_project_by_id(test_id)
    assert proj is not None
    assert proj.name == "Admin Unit Test Corridor Project"

    # 2. Reject Duplicate
    dup_res = client.post("/api/admin/projects", json=payload, headers={"Authorization": f"Bearer {admin_token}"})
    assert dup_res.status_code == 400
    assert "already exists" in dup_res.json()["detail"].lower()

def test_admin_missing_project_returns_404(admin_token):
    missing_id = "NONEXISTENT_PROJECT_99999"

    # 1. Update missing project
    res_upd = client.put(
        f"/api/admin/projects/{missing_id}",
        json={"revised_cost": 999.0, "reason": "Test 404"},
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert res_upd.status_code == 404

    # 2. Archive missing project
    res_arc = client.post(
        f"/api/admin/projects/{missing_id}/archive",
        json={"reason": "Test 404"},
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert res_arc.status_code == 404

    # 3. Unarchive missing project
    res_unarc = client.post(
        f"/api/admin/projects/{missing_id}/unarchive",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert res_unarc.status_code == 404

    # 4. Delete override on missing project
    res_del = client.delete(
        f"/api/admin/projects/{missing_id}/overrides",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert res_del.status_code == 404

def test_admin_update_project_and_risk_recalculation(admin_token):
    # Test editing an existing PAIMANA project
    target_id = "701415"
    p_before = paimana_repository.get_project_by_id(target_id)
    assert p_before is not None
    orig_cost_before = p_before.revisedCostCr

    # Modify revised cost and physical progress
    update_payload = {
        "revised_cost": orig_cost_before + 5000.0,
        "physical_progress": 88.5,
        "reason": "Official Q3 Revision Escalation"
    }

    res = client.put(f"/api/admin/projects/{target_id}", json=update_payload, headers={"Authorization": f"Bearer {admin_token}"})
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["project"]["recordType"] == "ADMIN_MODIFIED"
    assert data["project"]["revisedCostCr"] == orig_cost_before + 5000.0

    # Verify repo reflects change and recalculates risk
    p_after = paimana_repository.get_project_by_id(target_id)
    assert p_after.revisedCostCr == orig_cost_before + 5000.0
    assert p_after.recordType == "ADMIN_MODIFIED"
    assert "revisedCostCr" in p_after.adminOverrides

def test_admin_remove_override_restores_original_paimana_value(admin_token):
    target_id = "701415"
    # Get base PAIMANA value
    base_proj = paimana_repository.base_projects_map.get(target_id)
    assert base_proj is not None
    base_cost = base_proj.revisedCostCr

    # Verify currently overridden
    current_proj = paimana_repository.get_project_by_id(target_id)
    assert current_proj.recordType == "ADMIN_MODIFIED"

    # Remove the override via DELETE endpoint
    res = client.delete(
        f"/api/admin/projects/{target_id}/overrides",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert res.status_code == 200
    res_data = res.json()
    assert res_data["status"] == "success"

    # Check project in repo
    restored_proj = paimana_repository.get_project_by_id(target_id)
    assert restored_proj.recordType == "SOURCE"
    assert restored_proj.revisedCostCr == base_cost
    assert not restored_proj.adminOverrides

def test_admin_archive_and_unarchive(admin_token):
    test_id = "PRISM_TEST_9901"

    # Archive project
    res_arc = client.post(f"/api/admin/projects/{test_id}/archive", json={"reason": "Test Archival"}, headers={"Authorization": f"Bearer {admin_token}"})
    assert res_arc.status_code == 200
    assert res_arc.json()["success"] is True

    # Check that default listing does not include archived project
    list_active = paimana_repository.list_projects()["allMatching"]
    assert not any(p.id == test_id for p in list_active)

    # Check that include_archived returns it
    list_all = paimana_repository.list_projects(include_archived=True)["allMatching"]
    assert any(p.id == test_id for p in list_all)

    # Verify reload preserves authoritative archive state
    paimana_repository.load(force=True)
    list_active_after_reload = paimana_repository.list_projects()["allMatching"]
    assert not any(p.id == test_id for p in list_active_after_reload)

    # Unarchive project
    res_unarc = client.post(f"/api/admin/projects/{test_id}/unarchive", headers={"Authorization": f"Bearer {admin_token}"})
    assert res_unarc.status_code == 200
    assert res_unarc.json()["success"] is True

    list_active_again = paimana_repository.list_projects()["allMatching"]
    assert any(p.id == test_id for p in list_active_again)

    # Verify reload preserves authoritative unarchive state
    paimana_repository.load(force=True)
    list_active_after_second_reload = paimana_repository.list_projects()["allMatching"]
    assert any(p.id == test_id for p in list_active_after_second_reload)

def test_admin_audit_log(admin_token):
    res = client.get("/api/admin/audit-log?limit=50", headers={"Authorization": f"Bearer {admin_token}"})
    assert res.status_code == 200
    data = res.json()
    assert "logs" in data or "entries" in data
    logs = data.get("logs") or data.get("entries")
    actions = [entry["action"] for entry in logs]
    assert "CREATE_PROJECT" in actions

def test_admin_data_validation(admin_token):
    res = client.get("/api/admin/data-validation", headers={"Authorization": f"Bearer {admin_token}"})
    assert res.status_code == 200
    data = res.json()
    assert "total_projects" in data
    assert "valid_records" in data
    assert "issues" in data

def test_admin_system_diagnostics(admin_token):
    res = client.get("/api/admin/system", headers={"Authorization": f"Bearer {admin_token}"})
    assert res.status_code == 200
    data = res.json()
    assert data["backend_status"] == "Healthy"
    assert "database_path" in data
