"""
PRISM Risk Parity Test Suite
Validates the 6-indicator deterministic risk engine and known benchmark projects.
"""

import pytest
from backend.repositories.paimana_repository import paimana_repository
from backend.services.risk_engine import PRISMRiskEngine


def test_project_701396_risk():
    """Project 701396 is a known canonical benchmark: score 81, CRITICAL tier."""
    proj = paimana_repository.get_project_by_id("701396")
    assert proj is not None, "Project 701396 must exist in PAIMANA repository"
    assert proj.riskScore == 81, f"Expected riskScore 81 for 701396, got {proj.riskScore}"
    assert proj.riskTier == "CRITICAL", f"Expected riskTier CRITICAL for 701396, got {proj.riskTier}"


def test_risk_engine_weights_sum():
    """Verify the 6 indicator weights sum to exactly 100%."""
    obs = paimana_repository.get_project_observations("701396")
    assessment = PRISMRiskEngine.assess(obs)
    weights = [ind.weight for ind in assessment.indicators]
    assert len(weights) == 6, f"Expected 6 indicators, got {len(weights)}"
    total = sum(weights)
    assert total == 100, f"Weights must sum to 100%, got {total}"
    assert weights[0] == 25  # Progress Velocity
    assert weights[1] == 20  # Progress Stagnation
    assert weights[2] == 20  # Schedule Pressure
    assert weights[3] == 15  # Cost Escalation
    assert weights[4] == 10  # Divergence
    assert weights[5] == 10  # Deteriorating Trend


def test_deterministic_repeatability():
    """Verify that multiple successive risk evaluations produce identical scores."""
    obs = paimana_repository.get_project_observations("701396")

    scores = []
    for _ in range(10):
        assessment = PRISMRiskEngine.assess(obs)
        scores.append((assessment.riskScore, assessment.riskTier))

    # All 10 assessments must be identical
    assert all(s == scores[0] for s in scores)
    assert scores[0][0] == 81
    assert scores[0][1] == "CRITICAL"
