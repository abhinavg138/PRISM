import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.config import ADMIN_USERNAME, ADMIN_PASSWORD
from backend.repositories.paimana_repository import paimana_repository
from backend.services.admin_service import AdminService, get_db_connection

client = TestClient(app)

@pytest.fixture(scope="module", autouse=True)
def cleanup_admin_test_artifacts():
    # Setup: clean before tests
    conn = get_db_connection()
    with conn:
        conn.execute("DELETE FROM admin_added_projects WHERE id = 'PRISM_TEST_9901'")
        conn.execute("DELETE FROM admin_archived_projects WHERE project_id = 'PRISM_TEST_9901'")
        conn.execute("DELETE FROM admin_overrides WHERE project_id IN ('PRISM_TEST_9901', '701415')")
        conn.execute("DELETE FROM admin_audit_log WHERE project_id = 'PRISM_TEST_9901'")
        conn.commit()
    paimana_repository.load(force=True)

    yield

    # Teardown: clean after tests to preserve 2054 base invariants
    with conn:
        conn.execute("DELETE FROM admin_added_projects WHERE id = 'PRISM_TEST_9901'")
        conn.execute("DELETE FROM admin_archived_projects WHERE project_id = 'PRISM_TEST_9901'")
        conn.execute("DELETE FROM admin_overrides WHERE project_id IN ('PRISM_TEST_9901', '701415')")
        conn.execute("DELETE FROM admin_audit_log WHERE project_id = 'PRISM_TEST_9901'")
        conn.commit()
    paimana_repository.load(force=True)

@pytest.fixture(scope="module")
def admin_token():
    # Login and acquire token
    res = client.post("/api/admin/auth/login", json={
        "username": ADMIN_USERNAME,
        "password": ADMIN_PASSWORD
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
    # Try calling protected endpoint without token
    res = client.post("/api/admin/projects", json={"id": "test_unauth"})
    assert res.status_code == 401

def test_admin_me(admin_token):
    res = client.get("/api/admin/auth/me", headers={"Authorization": f"Bearer {admin_token}"})
    assert res.status_code == 200
    data = res.json()
    assert data["authenticated"] is True
    assert data["user"]["username"] == ADMIN_USERNAME

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

    # Clean up if existed from previous run
    paimana_repository.projects_map.pop(test_id, None)
    conn = get_db_connection()
    with conn:
        conn.execute("DELETE FROM admin_added_projects WHERE id = ?", (test_id,))
        conn.execute("DELETE FROM admin_archived_projects WHERE project_id = ?", (test_id,))
        conn.execute("DELETE FROM admin_overrides WHERE project_id = ?", (test_id,))

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

    # Unarchive project
    res_unarc = client.post(f"/api/admin/projects/{test_id}/unarchive", headers={"Authorization": f"Bearer {admin_token}"})
    assert res_unarc.status_code == 200
    assert res_unarc.json()["success"] is True

    list_active_again = paimana_repository.list_projects()["allMatching"]
    assert any(p.id == test_id for p in list_active_again)

def test_persistence_layer_reload():
    # Reload repository and confirm admin layers are restored from SQLite
    paimana_repository.load(force=True)

    test_id = "PRISM_TEST_9901"
    proj = paimana_repository.get_project_by_id(test_id)
    assert proj is not None
    assert proj.recordType == "ADMIN_ADDED"

    # Check modified project
    p_mod = paimana_repository.get_project_by_id("701415")
    assert p_mod.recordType == "ADMIN_MODIFIED"

def test_admin_audit_log(admin_token):
    res = client.get("/api/admin/audit-log?limit=50", headers={"Authorization": f"Bearer {admin_token}"})
    assert res.status_code == 200
    data = res.json()
    assert "entries" in data
    actions = [entry["action"] for entry in data["entries"]]
    assert "CREATE_PROJECT" in actions
    assert "UPDATE_PROJECT" in actions

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
    assert data["database_size_bytes"] > 0
