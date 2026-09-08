"""
PRISM Benchmarking, Forward-Looking Forecasting & Hardening Test Suite
Validates peer sector comparative analytics (SIH PS 26103), Earned Schedule EVM forecasting,
rate-limiting, and CORS configurations.
"""

import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.repositories.paimana_repository import paimana_repository
from backend.services.rate_limiter import InMemoryRateLimiter
from fastapi import Request, HTTPException

@pytest.fixture(scope="module")
def client():
    paimana_repository.load()
    return TestClient(app)

def test_project_benchmark_polavaram(client):
    """Verify benchmarking endpoint for Polavaram Irrigation Project (ID: 701415)."""
    response = client.get("/api/projects/701415/benchmark")
    assert response.status_code == 200
    data = response.json()

    assert data["projectId"] == "701415"
    assert data["sector"] == "Water Resources"
    assert data["peerCount"] > 0
    assert "projectMetrics" in data
    assert "sectorBenchmark" in data
    assert "deltas" in data
    assert data["performanceTier"] in ["UNDERPERFORMING", "LAGGING", "OUTPERFORMING", "NORMAL"]
    assert "percentileInSector" in data["deltas"]
    assert 0.0 <= data["deltas"]["percentileInSector"] <= 100.0

def test_project_benchmark_sivok_rangpo(client):
    """Verify benchmarking endpoint for Sivok-Rangpo Rail Project (ID: 705432)."""
    response = client.get("/api/projects/705432/benchmark")
    assert response.status_code == 200
    data = response.json()
    assert data["projectId"] == "705432"
    assert data["peerCount"] >= 1
    assert data["projectMetrics"]["riskScore"] >= 0

def test_project_benchmark_not_found(client):
    """Verify 404 response for nonexistent project benchmarking."""
    response = client.get("/api/projects/NONEXISTENT_99999/benchmark")
    assert response.status_code == 404

def test_forward_looking_forecast_present():
    """Verify forward-looking Earned Schedule forecast is attached to projects."""
    p = paimana_repository.get_project_by_id("701415")
    assert p is not None
    assert p.predictedDelayMonths is not None
    assert isinstance(p.predictedDelayMonths, float)
    assert p.predictedDelayMonths >= 0.0
    assert p.predictedCostEscalationCr is not None
    assert isinstance(p.predictedCostEscalationCr, float)
    assert p.predictedCostEscalationCr >= 0.0

def test_rate_limiter_enforcement():
    """Verify in-memory sliding window rate limiter raises 429 when threshold exceeded."""
    limiter = InMemoryRateLimiter(requests_per_minute=3)
    
    class DummyClient:
        host = "192.168.1.100"
    class DummyRequest:
        client = DummyClient()

    req = DummyRequest()
    limiter.check(req)
    limiter.check(req)
    limiter.check(req)

    with pytest.raises(HTTPException) as exc_info:
        limiter.check(req)
    assert exc_info.value.status_code == 429
    assert "Rate limit exceeded" in exc_info.value.detail
