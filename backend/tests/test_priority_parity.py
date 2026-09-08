"""
PRISM Priority Parity Test Suite
Direct port of tests/priorityEngine.test.ts testing the 5 mandated scenarios:
  1. High risk + high urgency
  2. High risk + low urgency
  3. Moderate risk + severe deterioration
  4. High risk + low evidence confidence
  5. Multiple simultaneous drivers
"""

import pytest
from backend.models.project import PaimanaObservation
from backend.services.priority_engine import PRISMPriorityEngine


def test_case_1_high_risk_high_urgency():
    """Case 1: High Risk + High Urgency -> Priority >= 70, P1 tier, urgency >= 80, schedule recovery action."""
    case1_obs = [
        PaimanaObservation(report_month='2026-04', project_id='C1', project_name='Overdue Rail Corridor', agency='IR', state='DL', original_cost_cr=1000, revised_cost_cr=1800, cumulative_expenditure_cr=1700, physical_progress_pct=70, original_target_completion_mm_yyyy='12/2024', revised_target_completion_mm_yyyy='05/2026'),
        PaimanaObservation(report_month='2026-05', project_id='C1', project_name='Overdue Rail Corridor', agency='IR', state='DL', original_cost_cr=1000, revised_cost_cr=1800, cumulative_expenditure_cr=1720, physical_progress_pct=70, original_target_completion_mm_yyyy='12/2024', revised_target_completion_mm_yyyy='05/2026'),
        PaimanaObservation(report_month='2026-06', project_id='C1', project_name='Overdue Rail Corridor', agency='IR', state='DL', original_cost_cr=1000, revised_cost_cr=1800, cumulative_expenditure_cr=1750, physical_progress_pct=70, original_target_completion_mm_yyyy='12/2024', revised_target_completion_mm_yyyy='05/2026'),
        PaimanaObservation(report_month='2026-07', project_id='C1', project_name='Overdue Rail Corridor', agency='IR', state='DL', original_cost_cr=1000, revised_cost_cr=1800, cumulative_expenditure_cr=1770, physical_progress_pct=70, original_target_completion_mm_yyyy='12/2024', revised_target_completion_mm_yyyy='05/2026'),
    ]

    res = PRISMPriorityEngine.assess(case1_obs)
    assert res.priorityScore >= 70, f"Case 1 must yield Priority Score >= 70, got {res.priorityScore}"
    assert res.priorityTier == 'P1', f"Case 1 must be P1, got {res.priorityTier}"
    assert res.urgency >= 80, f"Case 1 urgency must be >= 80, got {res.urgency}"
    assert "Review completion recovery plan" in res.recommendedAction, "Case 1 action must address schedule recovery"


def test_case_2_high_risk_low_urgency():
    """Case 2: High Risk + Low Urgency -> urgency <= 25, priorityScore < Case 1, tier != P1."""
    case2_obs = [
        PaimanaObservation(report_month='2026-04', project_id='C2', project_name='Future Mega Port', agency='IPA', state='GJ', original_cost_cr=5000, revised_cost_cr=8000, cumulative_expenditure_cr=2000, physical_progress_pct=20, original_target_completion_mm_yyyy='12/2032', revised_target_completion_mm_yyyy='12/2032'),
        PaimanaObservation(report_month='2026-05', project_id='C2', project_name='Future Mega Port', agency='IPA', state='GJ', original_cost_cr=5000, revised_cost_cr=8000, cumulative_expenditure_cr=2050, physical_progress_pct=20, original_target_completion_mm_yyyy='12/2032', revised_target_completion_mm_yyyy='12/2032'),
        PaimanaObservation(report_month='2026-06', project_id='C2', project_name='Future Mega Port', agency='IPA', state='GJ', original_cost_cr=5000, revised_cost_cr=8000, cumulative_expenditure_cr=2100, physical_progress_pct=20.2, original_target_completion_mm_yyyy='12/2032', revised_target_completion_mm_yyyy='12/2032'),
        PaimanaObservation(report_month='2026-07', project_id='C2', project_name='Future Mega Port', agency='IPA', state='GJ', original_cost_cr=5000, revised_cost_cr=8000, cumulative_expenditure_cr=2150, physical_progress_pct=20.3, original_target_completion_mm_yyyy='12/2032', revised_target_completion_mm_yyyy='12/2032'),
    ]

    case1_obs = [
        PaimanaObservation(report_month='2026-04', project_id='C1', project_name='Overdue Rail Corridor', agency='IR', state='DL', original_cost_cr=1000, revised_cost_cr=1800, cumulative_expenditure_cr=1700, physical_progress_pct=70, original_target_completion_mm_yyyy='12/2024', revised_target_completion_mm_yyyy='05/2026'),
        PaimanaObservation(report_month='2026-05', project_id='C1', project_name='Overdue Rail Corridor', agency='IR', state='DL', original_cost_cr=1000, revised_cost_cr=1800, cumulative_expenditure_cr=1720, physical_progress_pct=70, original_target_completion_mm_yyyy='12/2024', revised_target_completion_mm_yyyy='05/2026'),
        PaimanaObservation(report_month='2026-06', project_id='C1', project_name='Overdue Rail Corridor', agency='IR', state='DL', original_cost_cr=1000, revised_cost_cr=1800, cumulative_expenditure_cr=1750, physical_progress_pct=70, original_target_completion_mm_yyyy='12/2024', revised_target_completion_mm_yyyy='05/2026'),
        PaimanaObservation(report_month='2026-07', project_id='C1', project_name='Overdue Rail Corridor', agency='IR', state='DL', original_cost_cr=1000, revised_cost_cr=1800, cumulative_expenditure_cr=1770, physical_progress_pct=70, original_target_completion_mm_yyyy='12/2024', revised_target_completion_mm_yyyy='05/2026'),
    ]

    res1 = PRISMPriorityEngine.assess(case1_obs)
    res2 = PRISMPriorityEngine.assess(case2_obs)

    assert res2.urgency <= 25, f"Case 2 urgency must be <= 25 due to 2032 date, got {res2.urgency}"
    assert res2.priorityScore < res1.priorityScore, f"Case 2 score ({res2.priorityScore}) must be < Case 1 score ({res1.priorityScore})"
    assert res2.priorityTier != 'P1', f"Case 2 must NOT be P1, got {res2.priorityTier}"


def test_case_3_moderate_risk_severe_deterioration():
    """Case 3: Moderate Risk + Severe Deterioration -> recentDeterioration >= 80, priorityScore >= 70, P1 tier."""
    case3_obs = [
        PaimanaObservation(report_month='2026-04', project_id='C3', project_name='Mid-Stage Highway', agency='NHAI', state='UP', original_cost_cr=1000, revised_cost_cr=1050, cumulative_expenditure_cr=500, physical_progress_pct=50, original_target_completion_mm_yyyy='10/2026', revised_target_completion_mm_yyyy='10/2026'),
        PaimanaObservation(report_month='2026-05', project_id='C3', project_name='Mid-Stage Highway', agency='NHAI', state='UP', original_cost_cr=1000, revised_cost_cr=1050, cumulative_expenditure_cr=510, physical_progress_pct=50, original_target_completion_mm_yyyy='10/2026', revised_target_completion_mm_yyyy='10/2026'),
        PaimanaObservation(report_month='2026-06', project_id='C3', project_name='Mid-Stage Highway', agency='NHAI', state='UP', original_cost_cr=1000, revised_cost_cr=1050, cumulative_expenditure_cr=520, physical_progress_pct=50, original_target_completion_mm_yyyy='10/2026', revised_target_completion_mm_yyyy='10/2026'),
        PaimanaObservation(report_month='2026-07', project_id='C3', project_name='Mid-Stage Highway', agency='NHAI', state='UP', original_cost_cr=1000, revised_cost_cr=1050, cumulative_expenditure_cr=530, physical_progress_pct=50, original_target_completion_mm_yyyy='10/2026', revised_target_completion_mm_yyyy='10/2026'),
    ]

    res = PRISMPriorityEngine.assess(case3_obs)
    assert res.recentDeterioration >= 80, f"Case 3 deterioration must be >= 80, got {res.recentDeterioration}"
    assert res.priorityScore >= 70, f"Case 3 priority score must be >= 70, got {res.priorityScore}"
    assert res.priorityTier == 'P1', f"Case 3 must be elevated to P1, got {res.priorityTier}"
    assert "Escalate physical-progress review" in res.recommendedAction


def test_case_4_high_risk_low_evidence_confidence():
    """Case 4: Single vs 4 snapshots -> single confidence == 0.25, multi == 1.0, single score < multi score."""
    single_obs = [
        PaimanaObservation(report_month='2026-07', project_id='C4', project_name='Unverified Bridge', agency='PWD', state='BR', original_cost_cr=500, revised_cost_cr=900, cumulative_expenditure_cr=800, physical_progress_pct=40, original_target_completion_mm_yyyy='12/2025', revised_target_completion_mm_yyyy='08/2026')
    ]
    multi_obs = [
        PaimanaObservation(report_month='2026-04', project_id='C4', project_name='Unverified Bridge', agency='PWD', state='BR', original_cost_cr=500, revised_cost_cr=900, cumulative_expenditure_cr=750, physical_progress_pct=40, original_target_completion_mm_yyyy='12/2025', revised_target_completion_mm_yyyy='08/2026'),
        PaimanaObservation(report_month='2026-05', project_id='C4', project_name='Unverified Bridge', agency='PWD', state='BR', original_cost_cr=500, revised_cost_cr=900, cumulative_expenditure_cr=770, physical_progress_pct=40, original_target_completion_mm_yyyy='12/2025', revised_target_completion_mm_yyyy='08/2026'),
        PaimanaObservation(report_month='2026-06', project_id='C4', project_name='Unverified Bridge', agency='PWD', state='BR', original_cost_cr=500, revised_cost_cr=900, cumulative_expenditure_cr=790, physical_progress_pct=40, original_target_completion_mm_yyyy='12/2025', revised_target_completion_mm_yyyy='08/2026'),
        PaimanaObservation(report_month='2026-07', project_id='C4', project_name='Unverified Bridge', agency='PWD', state='BR', original_cost_cr=500, revised_cost_cr=900, cumulative_expenditure_cr=800, physical_progress_pct=40, original_target_completion_mm_yyyy='12/2025', revised_target_completion_mm_yyyy='08/2026'),
    ]

    p_single = PRISMPriorityEngine.assess(single_obs)
    p_multi = PRISMPriorityEngine.assess(multi_obs)

    assert p_single.evidenceConfidence == 0.25, f"Single obs confidence must be 0.25, got {p_single.evidenceConfidence}"
    assert p_multi.evidenceConfidence == 1.0, f"4-obs confidence must be 1.0, got {p_multi.evidenceConfidence}"
    assert p_single.priorityScore < p_multi.priorityScore, "Single-obs priority score must be discounted relative to multi-obs"


def test_case_5_multiple_simultaneous_drivers():
    """Case 5: Multiple Simultaneous Drivers -> P1, score >= 85, multi-driver actions triggered."""
    case5_obs = [
        PaimanaObservation(report_month='2026-04', project_id='C5', project_name='Compound Crisis Metro', agency='DMRC', state='DL', original_cost_cr=1000, revised_cost_cr=2500, cumulative_expenditure_cr=2400, physical_progress_pct=45, original_target_completion_mm_yyyy='01/2025', revised_target_completion_mm_yyyy='03/2026'),
        PaimanaObservation(report_month='2026-05', project_id='C5', project_name='Compound Crisis Metro', agency='DMRC', state='DL', original_cost_cr=1000, revised_cost_cr=2500, cumulative_expenditure_cr=2420, physical_progress_pct=45, original_target_completion_mm_yyyy='01/2025', revised_target_completion_mm_yyyy='03/2026'),
        PaimanaObservation(report_month='2026-06', project_id='C5', project_name='Compound Crisis Metro', agency='DMRC', state='DL', original_cost_cr=1000, revised_cost_cr=2500, cumulative_expenditure_cr=2440, physical_progress_pct=45, original_target_completion_mm_yyyy='01/2025', revised_target_completion_mm_yyyy='03/2026'),
        PaimanaObservation(report_month='2026-07', project_id='C5', project_name='Compound Crisis Metro', agency='DMRC', state='DL', original_cost_cr=1000, revised_cost_cr=2500, cumulative_expenditure_cr=2460, physical_progress_pct=45, original_target_completion_mm_yyyy='01/2025', revised_target_completion_mm_yyyy='03/2026'),
    ]

    res = PRISMPriorityEngine.assess(case5_obs)
    assert res.priorityTier == 'P1', f"Case 5 tier must be P1, got {res.priorityTier}"
    assert res.priorityScore >= 85, f"Case 5 priority score must be >= 85, got {res.priorityScore}"
    assert "Escalate physical-progress review" in res.recommendedAction
    assert "Review completion recovery plan" in res.recommendedAction
    assert "Initiate cost/revision review" in res.recommendedAction
    assert "Review expenditure–physical progress divergence" in res.recommendedAction
