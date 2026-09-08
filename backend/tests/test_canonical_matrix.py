"""
PRISM Canonical Truth & Consistency Test Matrix (14 Tests)
Direct port of scratch/test_canonical_matrix.ts to pytest.
Ensures 100% mathematical, cross-surface, and deterministic consistency.
"""

import pytest
import asyncio
from backend.repositories.paimana_repository import paimana_repository
from backend.services.project_query_service import ProjectQueryService
from backend.services.copilot_service import CopilotService


@pytest.fixture(scope="module")
def paimana_data():
    res = paimana_repository.list_projects()
    all_projects = res['projects']
    stats = paimana_repository.get_stats()
    return all_projects, stats


def test_01_phase_18_health_checks(paimana_data):
    """TEST 1: Health check baseline numbers."""
    all_projects, stats = paimana_data
    unrated_count = len([p for p in all_projects if p.riskScore is None])

    assert stats['uniqueProjects'] == 2054
    assert stats['totalObservations'] == 7499
    assert stats['projectsWith4Months'] == 1664
    assert stats['projectsUnrated'] == 0
    assert unrated_count == 0


def test_02_delhi_state_partition():
    """TEST 2: State Partitioning for Delhi."""
    delhi_partition = ProjectQueryService.get_state_partition('Delhi')
    assert delhi_partition is not None
    assert delhi_partition['dedicatedCount'] == 17
    assert delhi_partition['multiStateCount'] == 7
    assert delhi_partition['totalAssociatedCount'] == 24


def test_03_delhi_dedicated_risk_distribution():
    """TEST 3: Delhi Dedicated Risk Distribution."""
    delhi_partition = ProjectQueryService.get_state_partition('Delhi')
    assert delhi_partition is not None
    assert delhi_partition['dedicatedByRisk'].get('CRITICAL', 0) == 0
    assert delhi_partition['dedicatedByRisk'].get('HIGH', 0) == 6
    assert delhi_partition['dedicatedByRisk'].get('MODERATE', 0) == 6
    assert delhi_partition['dedicatedByRisk'].get('LOW', 0) == 5


@pytest.mark.asyncio
async def test_04_cross_surface_delhi_high(paimana_data):
    """TEST 4: Cross-Surface Consistency: Delhi + HIGH."""
    all_projects, _ = paimana_data

    # Surface A: ProjectQueryService query
    query_high = ProjectQueryService.query(state='Delhi', risk_tier='HIGH', limit=5)
    # Surface B: getProjectsByStateAndRisk
    state_risk_high = ProjectQueryService.get_projects_by_state_and_risk('Delhi', 'HIGH', limit=5)
    # Surface C: Copilot
    copilot_high = await CopilotService.ask('How many high-risk projects are in Delhi?', all_projects)

    query_high_ids = sorted([p['id'] if isinstance(p, dict) else p.id for p in query_high['projects']])
    state_risk_high_ids = sorted([p['id'] if isinstance(p, dict) else p.id for p in state_risk_high['displayProjects']])
    copilot_high_ids = sorted([p.id if hasattr(p, 'id') else p['id'] for p in (copilot_high.groundedProjects or [])])

    assert query_high['totalCount'] == 6
    assert state_risk_high['totalCount'] == 6
    assert copilot_high.totalMatching == 6
    assert query_high_ids == state_risk_high_ids
    assert query_high_ids == copilot_high_ids


@pytest.mark.asyncio
async def test_05_cross_surface_delhi_low(paimana_data):
    """TEST 5: Cross-Surface Consistency: Delhi + LOW."""
    all_projects, _ = paimana_data

    query_low = ProjectQueryService.query(state='Delhi', risk_tier='LOW', limit=5)
    state_risk_low = ProjectQueryService.get_projects_by_state_and_risk('Delhi', 'LOW', limit=5)
    copilot_low = await CopilotService.ask('Which low-risk projects are in Delhi?', all_projects)

    query_low_ids = sorted([p['id'] if isinstance(p, dict) else p.id for p in query_low['projects']])
    state_risk_low_ids = sorted([p['id'] if isinstance(p, dict) else p.id for p in state_risk_low['displayProjects']])
    copilot_low_ids = sorted([p.id if hasattr(p, 'id') else p['id'] for p in (copilot_low.groundedProjects or [])])

    assert query_low['totalCount'] == 5
    assert state_risk_low['totalCount'] == 5
    assert copilot_low.totalMatching == 5
    assert query_low_ids == state_risk_low_ids
    assert query_low_ids == copilot_low_ids


@pytest.mark.asyncio
async def test_06_cross_surface_delhi_critical(paimana_data):
    """TEST 6: Cross-Surface Consistency: Delhi + CRITICAL."""
    all_projects, _ = paimana_data

    query_crit = ProjectQueryService.query(state='Delhi', risk_tier='CRITICAL', limit=5)
    state_risk_crit = ProjectQueryService.get_projects_by_state_and_risk('Delhi', 'CRITICAL', limit=5)
    copilot_crit = await CopilotService.ask('Show critical-risk projects in Delhi', all_projects)

    assert query_crit['totalCount'] == 0
    assert state_risk_crit['totalCount'] == 0
    assert copilot_crit.totalMatching == 0


def test_07_kpi_consistency_paged_vs_all():
    """TEST 7: Phase 7 KPI Consistency over full dataset vs pagination slice."""
    paged5 = ProjectQueryService.query(state='Delhi', limit=5)
    paged_all = ProjectQueryService.query(state='Delhi', limit=100)

    assert paged5['kpis']['totalProjects'] == 17
    assert paged5['kpis']['totalBudgetCr'] == paged_all['kpis']['totalBudgetCr']
    assert paged5['kpis']['averageRiskScore'] == paged_all['kpis']['averageRiskScore']


@pytest.mark.asyncio
async def test_08_highest_risk_ranking(paimana_data):
    """TEST 8: Question: 'Which projects have the highest risk?'"""
    all_projects, _ = paimana_data
    copilot_top_risk = await CopilotService.ask('Which projects have the highest risk?', all_projects)
    canonical_top_risk = ProjectQueryService.get_top_risk_projects(limit=5)

    top_risk_ids = [p.id for p in (copilot_top_risk.groundedProjects or [])]
    expected_top_risk_ids = [p.id for p in canonical_top_risk['projects']]

    assert top_risk_ids == expected_top_risk_ids
    assert top_risk_ids[0] == '701396'


@pytest.mark.asyncio
async def test_09_intervention_priority_ranking(paimana_data):
    """TEST 9: Question: 'Which projects need intervention first?'"""
    all_projects, _ = paimana_data
    copilot_prio = await CopilotService.ask('Which projects need intervention first?', all_projects)
    canonical_prio = ProjectQueryService.get_priority_projects(limit=5)

    prio_ids = [p.id for p in (copilot_prio.groundedProjects or [])]
    expected_prio_ids = [p.id for p in canonical_prio['projects']]

    assert prio_ids == expected_prio_ids
    assert canonical_prio['p1Count'] == 508


@pytest.mark.asyncio
async def test_10_stagnant_progress_ranking(paimana_data):
    """TEST 10: Question: 'Which projects show stagnant progress?'"""
    all_projects, _ = paimana_data
    copilot_stag = await CopilotService.ask('Which projects show stagnant progress?', all_projects)
    canonical_stag = ProjectQueryService.get_stagnant_projects(limit=5)

    stag_ids = [p.id for p in (copilot_stag.groundedProjects or [])]
    expected_stag_ids = [p.id for p in canonical_stag['projects']]

    assert stag_ids == expected_stag_ids
    assert canonical_stag['totalStagnant'] == 1685


@pytest.mark.asyncio
async def test_11_sector_highest_average_risk(paimana_data):
    """TEST 11: Question: 'Which sectors have the highest average risk?'"""
    all_projects, _ = paimana_data
    copilot_sector = await CopilotService.ask('Which sectors have the highest average risk?', all_projects)

    assert 'Water Resources' in copilot_sector.answer
    assert '56.1' in copilot_sector.answer


@pytest.mark.asyncio
async def test_12_project_701396_canonical_lookup(paimana_data):
    """TEST 12: Question: 'Why is project 701396 high risk?'"""
    all_projects, _ = paimana_data
    copilot_701396 = await CopilotService.ask('Why is project 701396 high risk?', all_projects)

    assert len(copilot_701396.groundedProjects or []) > 0
    top_proj = copilot_701396.groundedProjects[0]
    assert top_proj.id == '701396'
    assert top_proj.riskScore == 81
    assert top_proj.riskTier == 'CRITICAL'


@pytest.mark.asyncio
async def test_13_healthy_pace_ranking(paimana_data):
    """TEST 13: Question: 'Which projects are on good pace?'"""
    all_projects, _ = paimana_data
    copilot_pace = await CopilotService.ask('Which projects are on good pace?', all_projects)
    canonical_pace = ProjectQueryService.get_healthy_pace_projects(limit=5)

    pace_ids = [p.id for p in (copilot_pace.groundedProjects or [])]
    expected_pace_ids = [p.id for p in canonical_pace['projects']]

    assert pace_ids == expected_pace_ids
    assert canonical_pace['totalHealthy'] == 324


@pytest.mark.asyncio
async def test_14_repeatability_5_runs(paimana_data):
    """TEST 14: Phase 15 Repeatability Test (5 consecutive runs)."""
    all_projects, _ = paimana_data
    first_sig = None

    for r in range(5):
        run_res = await CopilotService.ask('Show high-risk projects in Delhi', all_projects)
        sig = (
            run_res.totalMatching,
            [(p.id, p.riskScore, p.riskTier) for p in (run_res.groundedProjects or [])]
        )
        if r == 0:
            first_sig = sig
        else:
            assert sig == first_sig, f"Run {r+1} discrepancy: expected {first_sig}, got {sig}"
