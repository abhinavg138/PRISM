"""
PRISM FastAPI Endpoints Test Suite
Validates all REST API endpoints using FastAPI's TestClient.
Matches 100% with the Express reference implementation routes and JSON formats.
"""

import pytest
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)


def test_health_endpoint():
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "operational"
    assert data["platform"] == "PRISM - Predictive Risk Intelligence & Smart Monitoring"
    assert data["version"] == "2.1.0-sih2026"
    assert data["totalProjectsMonitored"] == 2054
    assert data["totalObservationsLoaded"] == 7499
    assert data["projectsWith4Months"] == 1664
    assert data["projectsUnrated"] == 0


def test_metadata_endpoint():
    res = client.get("/api/metadata")
    assert res.status_code == 200
    data = res.json()
    assert data["dataSource"] == "PAIMANA"
    assert "states" in data
    assert "agencies" in data
    assert "sectors" in data
    assert "stats" in data
    assert len(data["states"]) > 0
    assert len(data["sectors"]) > 0


def test_projects_list_endpoint():
    res = client.get("/api/projects?limit=10")
    assert res.status_code == 200
    data = res.json()
    assert data["dataSource"] == "PAIMANA"
    assert "projects" in data
    assert "totalCount" in data
    assert "kpis" in data
    assert len(data["projects"]) == 10
    assert data["totalCount"] == 2054


def test_projects_filter_delhi_high():
    res = client.get("/api/projects?state=Delhi&riskTier=HIGH")
    assert res.status_code == 200
    data = res.json()
    assert data["totalCount"] == 6
    assert len(data["projects"]) == 6


def test_project_by_id_endpoint():
    res = client.get("/api/projects/701396")
    assert res.status_code == 200
    data = res.json()
    assert data["id"] == "701396"
    assert data["riskScore"] == 81
    assert data["riskTier"] == "CRITICAL"


def test_project_by_id_not_found():
    res = client.get("/api/projects/non_existent_id_9999999")
    assert res.status_code == 404


def test_project_history_endpoint():
    res = client.get("/api/projects/701396/history")
    assert res.status_code == 200
    data = res.json()
    assert data["projectId"] == "701396"
    assert data["total"] > 0
    assert isinstance(data["observations"], list)


def test_project_observations_endpoint():
    res = client.get("/api/projects/701396/observations")
    assert res.status_code == 200
    data = res.json()
    assert data["projectId"] == "701396"
    assert data["total"] > 0
    assert isinstance(data["observations"], list)


def test_project_risk_endpoint():
    res = client.get("/api/projects/701396/risk")
    assert res.status_code == 200
    data = res.json()
    assert data["projectId"] == "701396"
    assert data["riskScore"] == 81
    assert data["riskTier"] == "CRITICAL"
    assert len(data["indicators"]) == 6


def test_priorities_endpoint():
    res = client.get("/api/priorities?limit=10")
    assert res.status_code == 200
    data = res.json()
    assert data["dataSource"] == "PAIMANA"
    assert "priorities" in data
    assert "p1Count" in data
    assert data["p1Count"] == 508
    assert len(data["priorities"]) == 10


def test_project_priority_endpoint():
    res = client.get("/api/projects/701396/priority")
    assert res.status_code == 200
    data = res.json()
    assert "priorityScore" in data
    assert "priorityTier" in data


def test_alerts_endpoint():
    res = client.get("/api/alerts")
    assert res.status_code == 200
    data = res.json()
    assert "alerts" in data
    assert "totalCount" in data
    assert data["totalCount"] == 1036


def test_sectors_endpoint():
    res = client.get("/api/sectors")
    assert res.status_code == 200
    data = res.json()
    assert "sectors" in data
    assert data["totalProjects"] == 2054
    water_sector = next((s for s in data["sectors"] if s["sector"] == "Water Resources"), None)
    assert water_sector is not None
    assert water_sector["avgRiskScore"] == 56.1


def test_analytics_endpoint():
    res = client.get("/api/analytics")
    assert res.status_code == 200
    data = res.json()
    assert data["dataSource"] == "PAIMANA"
    assert "kpis" in data
    assert "riskDistribution" in data
    assert "priorityDistribution" in data
    assert "sectorAnalytics" in data
    assert "stateAnalytics" in data
    assert "costEscalation" in data
    assert "executionIndicators" in data


def test_simulation_simulate():
    payload = {
        "projectId": "701396",
        "params": {
            "landClearanceAccelerationWeeks": 12,
            "contractorLiquidityInjectionPercent": 20,
            "weatherGeologicalMitigationLevel": 50,
            "fastTrackHighPowerCommittee": True
        }
    }
    res = client.post("/api/simulate", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["projectId"] == "701396"
    assert data["originalRiskScore"] == 81
    assert "officerBrief" in data
    assert "disclaimer" in data["officerBrief"]
    assert "Illustrative Policy Scenario" in data["officerBrief"]["disclaimer"]


def test_copilot_chat():
    payload = {
        "message": "Which projects have the highest risk?"
    }
    res = client.post("/api/copilot/chat", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert "answer" in data
    assert "groundedProjects" in data
    assert len(data["groundedProjects"]) > 0
    assert data["groundedProjects"][0]["id"] == "701396"


def test_demo_reset():
    # Test switching to demo preset
    res = client.post("/api/demo/reset", json={"preset": "demo"})
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["dataSource"] == "DEMO"
    assert data["count"] == 15

    # Switch back to paimana
    res2 = client.post("/api/demo/reset", json={"preset": "paimana"})
    assert res2.status_code == 200
    data2 = res2.json()
    assert data2["success"] is True
    assert data2["dataSource"] == "PAIMANA"
    assert data2["count"] == 2054
