from datetime import datetime, timezone
from typing import List, Optional, Tuple
from backend.models.project import PaimanaObservation
from backend.models.risk import RiskAssessment, PriorityAssessment, PriorityEvidence
from backend.models.common import PriorityTier
from backend.services.risk_engine import (
    PRISMRiskEngine, js_round, clamp,
    parse_completion_date_to_fractional_year,
    report_month_to_fractional_year
)

def calc_schedule_urgency(latest: PaimanaObservation) -> int:
    phys_pct = latest.physical_progress_pct if latest.physical_progress_pct is not None else 0.0
    if phys_pct >= 100.0:
        return 0

    target_date_str = latest.revised_target_completion_mm_yyyy or latest.original_target_completion_mm_yyyy
    target_year = parse_completion_date_to_fractional_year(target_date_str)
    if target_year is None:
        return 40  # Neutral baseline if no target completion date is provided

    report_year = report_month_to_fractional_year(latest.report_month or '2026-07')
    remaining_years = target_year - report_year

    if remaining_years <= 0:
        urgency = 85.0 + (100.0 - phys_pct) * 0.15
    elif remaining_years <= 0.5:
        time_factor = (1.0 - remaining_years / 0.5) * 15.0
        progress_factor = ((100.0 - phys_pct) / 100.0) * 10.0
        urgency = 70.0 + time_factor + progress_factor
    elif remaining_years <= 1.0:
        urgency = 50.0 + ((1.0 - remaining_years) / 0.5) * 20.0
    elif remaining_years <= 2.0:
        urgency = 30.0 + ((2.0 - remaining_years) / 1.0) * 20.0
    else:
        urgency = 30.0 - (remaining_years - 2.0) * 5.0

    return clamp(js_round(urgency), 0, 100)

def calc_recent_deterioration(obs: List[PaimanaObservation]) -> Tuple[int, int, Optional[float]]:
    if not obs or len(obs) < 2:
        return 30, 0, None

    deltas = [
        (obs[i].physical_progress_pct or 0.0) - (obs[i - 1].physical_progress_pct or 0.0)
        for i in range(1, len(obs))
    ]
    recent_delta = deltas[-1]

    consecutive_stagnant_months = 0
    for i in range(len(deltas) - 1, -1, -1):
        if deltas[i] <= 0.1:
            consecutive_stagnant_months += 1
        else:
            break

    if recent_delta < 0:
        score = 100.0
    elif recent_delta <= 0.1:
        if consecutive_stagnant_months >= 3:
            score = 95.0
        elif consecutive_stagnant_months == 2:
            score = 80.0
        else:
            score = 65.0
    elif recent_delta < 0.5:
        score = 55.0 if consecutive_stagnant_months > 0 else 40.0
    elif recent_delta < 1.0:
        score = 25.0
    elif recent_delta < 2.0:
        score = 10.0
    else:
        score = 0.0

    if len(obs) >= 3:
        early_deltas = deltas[:len(deltas) // 2]
        early_avg = sum(early_deltas) / (len(early_deltas) or 1)
        decel = early_avg - recent_delta
        if decel > 2.0:
            score += 15.0

    return (
        clamp(js_round(score), 0, 100),
        consecutive_stagnant_months,
        round(recent_delta, 2)
    )

def priority_tier_from_score(score: int) -> PriorityTier:
    if score >= 70:
        return 'P1'
    if score >= 50:
        return 'P2'
    return 'P3'

def build_recommended_action(
    assessment: RiskAssessment,
    urgency: int,
    recent_deterioration: int,
    consecutive_stagnant_months: int,
    cost_overrun_percent: float,
    spend_progress_gap: float
) -> str:
    actions: List[str] = []

    def get_indicator_score(id_name: str) -> int:
        for ind in assessment.indicators:
            if ind.id == id_name or ind.id.startswith(id_name):
                return ind.normalisedScore
        return 0

    stagnation_score = get_indicator_score('stagnation')
    cost_score = get_indicator_score('cost')
    schedule_score = get_indicator_score('schedule')
    divergence_score = get_indicator_score('divergence')
    velocity_score = get_indicator_score('velocity')

    # Rule 1: Prolonged Stagnation
    if consecutive_stagnant_months >= 2 or stagnation_score >= 60:
        actions.append('Escalate physical-progress review')

    # Rule 2: High Schedule Pressure
    if urgency >= 75 or schedule_score >= 60:
        actions.append('Review completion recovery plan')

    # Rule 3: Expenditure substantially ahead of physical progress (Divergence)
    if divergence_score >= 60 or spend_progress_gap >= 15:
        actions.append('Review expenditure–physical progress divergence')

    # Rule 4: Severe Cost Escalation
    if cost_score >= 60 or cost_overrun_percent >= 20:
        actions.append('Initiate cost/revision review')

    # Rule 5: Severe Velocity Deceleration
    if recent_deterioration >= 70 or velocity_score >= 70:
        if 'Escalate physical-progress review' not in actions:
            actions.append('Conduct contractor mobilization & site execution audit')

    if not actions:
        return 'Maintain routine milestone & expenditure monitoring'

    return '; '.join(actions)

def build_priority_reason(
    tier: PriorityTier,
    priority_score: int,
    risk_score: int,
    urgency: int,
    deterioration: int,
    confidence: float,
    consecutive_stagnant_months: int,
    top_drivers: List[str],
    cost_overrun_percent: float = 0.0,
    spend_progress_gap: float = 0.0,
    indicators: Optional[List[dict]] = None
) -> str:
    def get_ind_score(id_name: str) -> int:
        if not indicators:
            return 0
        for ind in indicators:
            ind_id = ind.get('id', '') if isinstance(ind, dict) else ind.id
            if ind_id == id_name or ind_id.startswith(id_name):
                return ind.get('normalisedScore', 0) if isinstance(ind, dict) else ind.normalisedScore
        return 0

    stagnation_score = get_ind_score('stagnation')
    velocity_score = get_ind_score('velocity')
    schedule_score = get_ind_score('schedule')
    cost_score = get_ind_score('cost')
    divergence_score = get_ind_score('divergence')

    if tier == 'P1':
        if consecutive_stagnant_months >= 2 or stagnation_score >= 75:
            if urgency >= 70 or schedule_score >= 70:
                return 'Progress has remained nearly stagnant across recent observations, compounded by schedule pressure.'
            return 'Progress has remained nearly stagnant across recent observations.'

        if (cost_overrun_percent >= 20 or cost_score >= 60) and (spend_progress_gap >= 15 or divergence_score >= 60):
            return 'Cost escalation and physical-financial divergence increase intervention urgency.'

        if risk_score >= 60 and (urgency >= 70 or schedule_score >= 65):
            return 'High risk combined with schedule pressure.'

        if deterioration >= 70 or velocity_score >= 75:
            return 'Recent progress velocity deterioration warrants immediate operational intervention.'

        if cost_overrun_percent >= 30 or cost_score >= 75:
            return 'Significant cost escalation over original outlay warrants urgent financial review.'

        if urgency >= 80:
            return 'Approaching or past target deadline with substantial physical work remaining.'

        primary = top_drivers[0] if top_drivers else 'Operational risk'
        return f"Critical {primary.lower()} combined with deadline urgency requires intervention."

    if tier == 'P2':
        if consecutive_stagnant_months >= 2 or stagnation_score >= 60:
            return 'Progress has remained nearly stagnant across recent observations.'
        if (cost_overrun_percent >= 15 or cost_score >= 50) and (spend_progress_gap >= 10 or divergence_score >= 50):
            return 'Cost escalation and physical-financial divergence increase intervention urgency.'
        if risk_score >= 55 and urgency >= 60:
            return 'High risk combined with schedule pressure.'
        if deterioration >= 50 or velocity_score >= 60:
            return 'Sluggish monthly progress velocity requires contractor mobilization oversight.'
        if urgency >= 65 or schedule_score >= 60:
            return 'Schedule slippage against target completion requires active timeline oversight.'
        primary = top_drivers[0] if top_drivers else 'Execution'
        return f"Moderate risk with notable {primary.lower()} monitoring requirements."

    return 'Routine monitoring: progress and expenditure remain within manageable variance thresholds.'

class PRISMPriorityEngine:
    """
    Authoritative PRISM Priority Engine (Phase 3A).
    Deterministically transforms risk assessments and urgency into the Intervention Priority Queue.
    """
    WEIGHTS = {
        'risk': 0.40,
        'urgency': 0.25,
        'deterioration': 0.20,
        'confidence': 0.15
    }

    @classmethod
    def assess(
        cls,
        observations: List[PaimanaObservation],
        existing_assessment: Optional[RiskAssessment] = None
    ) -> PriorityAssessment:
        if not observations:
            raise ValueError("PRISMPriorityEngine.assess() requires at least one observation")

        obs = sorted(observations, key=lambda o: o.report_month)
        latest = obs[-1]

        risk_assessment = existing_assessment or PRISMRiskEngine.assess(obs)
        risk_score = risk_assessment.riskScore
        risk_tier = risk_assessment.riskTier
        evidence_confidence = risk_assessment.evidenceConfidence

        urgency = calc_schedule_urgency(latest)
        recent_deterioration, consecutive_stagnant_months, recent_delta = calc_recent_deterioration(obs)
        confidence_score = clamp(evidence_confidence * 100.0, 0.0, 100.0)

        raw_priority_score = (
            risk_score * cls.WEIGHTS['risk'] +
            urgency * cls.WEIGHTS['urgency'] +
            recent_deterioration * cls.WEIGHTS['deterioration'] +
            confidence_score * cls.WEIGHTS['confidence']
        )

        priority_score = clamp(js_round(raw_priority_score), 0, 100)
        priority_tier = priority_tier_from_score(priority_score)

        sorted_indicators = sorted(
            risk_assessment.indicators,
            key=lambda ind: ind.weightedContribution,
            reverse=True
        )
        primary_risk_driver = sorted_indicators[0].label if sorted_indicators else 'General Execution'
        top_risk_drivers = [
            ind.label for ind in sorted_indicators if ind.normalisedScore >= 25
        ][:3]
        if not top_risk_drivers:
            top_risk_drivers.append(primary_risk_driver)

        original_cost = latest.original_cost_cr or 0.0
        revised_cost = latest.revised_cost_cr or original_cost
        cost_overrun_percent = (
            max(0.0, round(((revised_cost - original_cost) / original_cost) * 100.0, 1))
            if original_cost > 0 else 0.0
        )

        exp_pct = latest.expenditure_pct_of_revised_cost
        if exp_pct is None:
            exp_pct = round(((latest.cumulative_expenditure_cr or 0.0) / revised_cost) * 100.0, 2) if revised_cost > 0 else 0.0

        phys_pct = latest.physical_progress_pct or 0.0
        spend_progress_gap = round(exp_pct - phys_pct, 2)

        recommended_action = build_recommended_action(
            risk_assessment,
            urgency,
            recent_deterioration,
            consecutive_stagnant_months,
            cost_overrun_percent,
            spend_progress_gap
        )

        priority_reason = build_priority_reason(
            priority_tier,
            priority_score,
            risk_score,
            urgency,
            recent_deterioration,
            evidence_confidence,
            consecutive_stagnant_months,
            top_risk_drivers,
            cost_overrun_percent,
            spend_progress_gap,
            [ind.model_dump() for ind in risk_assessment.indicators]
        )

        return PriorityAssessment(
            projectId=latest.project_id,
            projectName=latest.project_name,
            code=latest.legacy_ocms_code or (f"PMG-{latest.pmgid}" if latest.pmgid else f"PAIMANA-{latest.project_id}"),
            sector="",
            state=latest.state,
            implementingAgency=latest.agency,
            priorityScore=priority_score,
            priorityTier=priority_tier,
            riskScore=risk_score,
            riskTier=risk_tier,
            evidenceConfidence=evidence_confidence,
            urgency=urgency,
            recentDeterioration=recent_deterioration,
            primaryRiskDriver=primary_risk_driver,
            topRiskDrivers=top_risk_drivers,
            priorityReason=priority_reason,
            recommendedAction=recommended_action,
            evidence=PriorityEvidence(
                physicalProgressPercent=phys_pct,
                cumulativeExpenditureCr=latest.cumulative_expenditure_cr or 0.0,
                revisedCostCr=revised_cost,
                originalCostCr=original_cost,
                costOverrunPercent=cost_overrun_percent,
                expenditurePctOfRevisedCost=exp_pct,
                timeOverrunMonths=0,
                targetCompletionDate=latest.revised_target_completion_mm_yyyy or latest.original_target_completion_mm_yyyy or 'Not specified',
                originalCompletionDate=latest.original_target_completion_mm_yyyy or 'Not specified',
                consecutiveStagnantMonths=consecutive_stagnant_months,
                recentProgressDelta=recent_delta,
                observationCount=len(obs)
            ),
            assessedAt=datetime.now(timezone.utc).isoformat()
        )
