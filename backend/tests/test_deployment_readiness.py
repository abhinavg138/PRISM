import pytest
from fastapi.testclient import TestClient
from app import app

client = TestClient(app)

def test_root_index_html():
    res = client.get("/")
    assert res.status_code == 200
    assert "<title>" in res.text
    assert "PRISM" in res.text

def test_login_and_dashboard_routes():
    res_login = client.get("/login")
    assert res_login.status_code == 200
    assert "PRISM" in res_login.text
    assert "multilingual-greeting" in res_login.text

    res_dash = client.get("/dashboard")
    assert res_dash.status_code == 200
    assert "PRISM" in res_dash.text
    assert "user-role-select" in res_dash.text

    res_login_js = client.get("/js/login.js")
    assert res_login_js.status_code == 200

    res_greeting_js = client.get("/js/greeting.js")
    assert res_greeting_js.status_code == 200

def test_home_orientation_route():
    res_home = client.get("/home")
    assert res_home.status_code == 200
    assert "What is PRISM?" in res_home.text
    assert "btn-enter-dashboard" in res_home.text

    res_home_html = client.get("/home.html")
    assert res_home_html.status_code == 200
    assert "What is PRISM?" in res_home_html.text

def test_static_files():
    res_css = client.get("/css/styles.css")
    assert res_css.status_code == 200
    assert "text/css" in res_css.headers.get("content-type", "")

    res_components_css = client.get("/css/components.css")
    assert res_components_css.status_code == 200

    res_js = client.get("/js/app.js")
    assert res_js.status_code == 200

def test_api_health():
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "operational"
    assert data["dataSource"] == "PAIMANA"
    assert data["totalProjectsMonitored"] > 0
    assert data["totalObservationsLoaded"] > 0

def test_api_projects():
    res = client.get("/api/projects?limit=5")
    assert res.status_code == 200
    data = res.json()
    assert "projects" in data
    assert len(data["projects"]) == 5
    assert data["totalCount"] > 1000

def test_api_sectors():
    res = client.get("/api/sectors")
    assert res.status_code == 200
    data = res.json()
    assert "sectors" in data
    assert len(data["sectors"]) > 0

def test_api_alerts():
    res = client.get("/api/alerts")
    assert res.status_code == 200
    data = res.json()
    assert "alerts" in data
    assert data["totalCount"] > 0

def test_api_priorities():
    res = client.get("/api/priorities")
    assert res.status_code == 200
    data = res.json()
    assert "priorities" in data
    assert len(data["priorities"]) > 0

def test_copilot_chat():
    res = client.post("/api/copilot/chat", json={"message": "List top critical projects"})
    assert res.status_code in [200, 429]

def test_admin_routes_without_auth():
    # Attempting to access protected admin endpoint without auth should return 401
    res = client.get("/api/admin/projects")
    assert res.status_code == 401

def test_admin_ui_view():
    res = client.get("/admin")
    assert res.status_code in [200, 302, 307]
