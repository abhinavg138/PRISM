"""
PRISM PAIMANA Invariant Counts Test Suite
Validates baseline dataset integrity against exact canonical truth numbers.
"""

import pytest
from backend.repositories.paimana_repository import paimana_repository
from backend.services.project_query_service import ProjectQueryService


def test_paimana_counts_invariant():
    """Verify exact counts: 2054 projects, 7499 observations, 1664 4-mo series, 0 unrated, 1036 alerts."""
    stats = paimana_repository.get_stats()
    res = paimana_repository.list_projects()
    all_projects = res['projects']
    total_alerts = len(paimana_repository.alerts_list)

    assert stats['uniqueProjects'] == 2054, f"Expected 2054 projects, got {stats['uniqueProjects']}"
    assert stats['totalObservations'] == 7499, f"Expected 7499 observations, got {stats['totalObservations']}"
    assert stats['projectsWith4Months'] == 1664, f"Expected 1664 4-mo series, got {stats['projectsWith4Months']}"
    assert stats['projectsUnrated'] == 0, f"Expected 0 unrated, got {stats['projectsUnrated']}"
    assert total_alerts == 1036, f"Expected 1036 alerts, got {total_alerts}"

    # Verify no unrated projects in all_projects list
    unrated = [p for p in all_projects if p.riskScore is None]
    assert len(unrated) == 0, f"Expected 0 unrated projects, found {len(unrated)}"


def test_delhi_state_partition_invariant():
    """Verify Delhi partition: 17 dedicated, 7 multi-state, 24 total associated."""
    partition = ProjectQueryService.get_state_partition("Delhi")
    assert partition is not None, "Delhi partition should not be None"
    assert partition['dedicatedCount'] == 17, f"Expected 17 dedicated, got {partition['dedicatedCount']}"
    assert partition['multiStateCount'] == 7, f"Expected 7 multi-state, got {partition['multiStateCount']}"
    assert partition['totalAssociatedCount'] == 24, f"Expected 24 total associated, got {partition['totalAssociatedCount']}"


def test_delhi_dedicated_risk_distribution():
    """Verify Delhi dedicated risk distribution: CRITICAL=0, HIGH=6, MODERATE=6, LOW=5."""
    partition = ProjectQueryService.get_state_partition("Delhi")
    assert partition is not None
    assert partition['dedicatedByRisk'].get("CRITICAL", 0) == 0
    assert partition['dedicatedByRisk'].get("HIGH", 0) == 6
    assert partition['dedicatedByRisk'].get("MODERATE", 0) == 6
    assert partition['dedicatedByRisk'].get("LOW", 0) == 5
