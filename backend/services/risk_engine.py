import math
from datetime import datetime, timezone
from typing import List, Optional, Tuple
from backend.models.project import PaimanaObservation
from backend.models.risk import RiskIndicator, RiskAssessment
from backend.models.common import RiskTier

def js_round(val: float) -> int:
    """Rounds identical to JavaScript's Math.round (half-up for positive numbers)."""
    return int(math.floor(val + 0.5))

def clamp(v: float, min_val: float, max_val: float) -> float:
    return max(min_val, min(max_val, v))

def parse_completion_date_to_fractional_year(date_str: Optional[str]) -> Optional[float]:
    if not date_str or not isinstance(date_str, str):
        return None
    parts = date_str.strip().split('/')
    if len(parts) != 2:
        return None
    try:
        m = int(parts[0])
        y = int(parts[1])
        return y + (m - 1) / 12.0
    except (ValueError, TypeError):
        return None

def report_month_to_fractional_year(month_str: str) -> float:
    parts = month_str.strip().split('-')
    if len(parts) != 2:
        return 0.0
    try:
        y = int(parts[0])
        m = int(parts[1])
        return y + (m - 1) / 12.0
    except (ValueError, TypeError):
        return 0.0

def linear_norm(value: float, lo: float, hi: float) -> float:
    if hi <= lo:
        return 0.0
    return clamp(((value - lo) / (hi - lo)) * 100.0, 0.0, 100.0)

def severity_from_score(score: float) -> str:
    if score >= 80:
        return 'critical'
    if score >= 60:
        return 'high'
    if score >= 35:
        return 'medium'
    if score > 0:
        return 'low'
    return 'none'

def calc_progress_velocity(obs: List[PaimanaObservation]) -> RiskIndicator:
    ind_id = 'velocity'
    if len(obs) < 2:
        return RiskIndicator(
            id=ind_id,
            label='Progress Velocity',
            description='Average month-over-month change in physical completion percentage.',
            rawValue=None,
            normalisedScore=50,
            weight=25,
            weightedContribution=12.5,
            category='Progress',
            severity='medium'
        )
    deltas = [obs[i].physical_progress_pct - obs[i - 1].physical_progress_pct for i in range(1, len(obs))]
    avg_delta = sum(deltas) / len(deltas)

    if avg_delta >= 5:
        norm_score = 0.0
    elif avg_delta >= 0:
        norm_score = 75.0 - linear_norm(avg_delta, 0.0, 5.0) * 75.0 / 100.0
    else:
        norm_score = 75.0 + linear_norm(abs(avg_delta), 0.0, 2.0) * 25.0 / 100.0
    norm_score = clamp(norm_score, 0.0, 100.0)

    weight = 25
    contribution = (norm_score * weight) / 100.0
    norm_score_int = js_round(norm_score)
    weighted_contrib = round(contribution, 2)
    sign = '+' if avg_delta >= 0 else ''

    return RiskIndicator(
        id=ind_id,
        label='Progress Velocity',
        description=f"Average MoM physical progress: {sign}{avg_delta:.2f} pp/month across {len(obs) - 1} interval(s).",
        rawValue=round(avg_delta, 3),
        normalisedScore=norm_score_int,
        weight=weight,
        weightedContribution=weighted_contrib,
        category='Progress',
        severity=severity_from_score(norm_score_int)
    )

def calc_progress_stagnation(obs: List[PaimanaObservation]) -> RiskIndicator:
    ind_id = 'stagnation'
    if len(obs) < 2:
        return RiskIndicator(
            id=ind_id,
            label='Progress Stagnation',
            description='Detection of consecutive months with negligible physical progress change.',
            rawValue=None,
            normalisedScore=40,
            weight=20,
            weightedContribution=8.0,
            category='Progress',
            severity='medium'
        )
    threshold = 0.5
    max_streak = 0
    current_streak = 0
    stagnant_count = 0

    for i in range(1, len(obs)):
        delta = abs(obs[i].physical_progress_pct - obs[i - 1].physical_progress_pct)
        if delta <= threshold:
            current_streak += 1
            stagnant_count += 1
            if current_streak > max_streak:
                max_streak = current_streak
        else:
            current_streak = 0

    total_intervals = len(obs) - 1
    norm_score = clamp(
        linear_norm(max_streak, 0.0, float(total_intervals)) * 0.6 +
        (stagnant_count / float(total_intervals)) * 100.0 * 0.4,
        0.0, 100.0
    )
    weight = 20
    contribution = (norm_score * weight) / 100.0
    norm_score_int = js_round(norm_score)
    weighted_contrib = round(contribution, 2)

    return RiskIndicator(
        id=ind_id,
        label='Progress Stagnation',
        description=f"{stagnant_count} of {total_intervals} intervals show <= 0.5 pp change. Longest consecutive stagnant streak: {max_streak} month(s).",
        rawValue=float(max_streak),
        normalisedScore=norm_score_int,
        weight=weight,
        weightedContribution=weighted_contrib,
        category='Progress',
        severity=severity_from_score(norm_score_int)
    )

def calc_schedule_pressure(obs: List[PaimanaObservation]) -> RiskIndicator:
    ind_id = 'schedule_pressure'
    latest = obs[-1]
    rev_target = parse_completion_date_to_fractional_year(latest.revised_target_completion_mm_yyyy)
    latest_date = report_month_to_fractional_year(latest.report_month)

    if rev_target is None:
        orig_target = parse_completion_date_to_fractional_year(latest.original_target_completion_mm_yyyy)
        norm_score = 70.0 if (orig_target is not None and latest_date > orig_target) else 30.0
        weight = 20
        norm_score_int = js_round(norm_score)
        return RiskIndicator(
            id=ind_id,
            label='Schedule Pressure',
            description='No revised completion target available; using original target date.',
            rawValue=None,
            normalisedScore=norm_score_int,
            weight=weight,
            weightedContribution=round((norm_score * weight) / 100.0, 2),
            category='Schedule',
            severity=severity_from_score(norm_score_int)
        )

    months_remaining = (rev_target - latest_date) * 12.0
    progress_gap = 100.0 - latest.physical_progress_pct

    if months_remaining > 24:
        base_score = 0.0
    elif months_remaining >= 0:
        base_score = linear_norm(24.0 - months_remaining, 0.0, 24.0) * 70.0 / 100.0
    else:
        base_score = clamp(70.0 + linear_norm(abs(months_remaining), 0.0, 12.0) * 30.0 / 100.0, 70.0, 100.0)

    pressure_boost = 0.0
    if months_remaining > 0 and progress_gap > 0:
        req = progress_gap / months_remaining
        if req > 10:
            pressure_boost = 20.0
        elif req > 5:
            pressure_boost = 10.0
        elif req > 2:
            pressure_boost = 5.0

    norm_score = clamp(base_score + pressure_boost, 0.0, 100.0)
    weight = 20
    contribution = (norm_score * weight) / 100.0
    norm_score_int = js_round(norm_score)
    weighted_contrib = round(contribution, 2)

    if months_remaining >= 0:
        desc = f"{months_remaining:.1f} months until revised deadline ({latest.revised_target_completion_mm_yyyy}); {progress_gap:.1f} pp of work remains."
    else:
        desc = f"Revised target ({latest.revised_target_completion_mm_yyyy}) exceeded by {abs(months_remaining):.1f} months; {latest.physical_progress_pct}% complete."

    return RiskIndicator(
        id=ind_id,
        label='Schedule Pressure',
        description=desc,
        rawValue=round(months_remaining, 1),
        normalisedScore=norm_score_int,
        weight=weight,
        weightedContribution=weighted_contrib,
        category='Schedule',
        severity=severity_from_score(norm_score_int)
    )

def calc_cost_escalation(obs: List[PaimanaObservation]) -> RiskIndicator:
    ind_id = 'cost_escalation'
    latest = obs[-1]
    overrun_pct = ((latest.revised_cost_cr - latest.original_cost_cr) / latest.original_cost_cr) * 100.0 if latest.original_cost_cr > 0 else 0.0

    mom_penalty = 0.0
    if len(obs) >= 2:
        revisions = [abs(obs[i].revised_cost_cr - obs[i - 1].revised_cost_cr) for i in range(1, len(obs))]
        pos_rev = [d for d in revisions if d > 0]
        if len(pos_rev) > 0:
            avg = sum(pos_rev) / len(pos_rev)
            if avg > latest.original_cost_cr * 0.05:
                mom_penalty = 15.0
            elif avg > latest.original_cost_cr * 0.01:
                mom_penalty = 8.0

    norm_score = clamp(linear_norm(overrun_pct, 0.0, 200.0) + mom_penalty, 0.0, 100.0)
    weight = 15
    contribution = (norm_score * weight) / 100.0
    norm_score_int = js_round(norm_score)
    weighted_contrib = round(contribution, 2)

    if overrun_pct > 0:
        desc = f"Revised cost Rs. {latest.revised_cost_cr:,.0f} Cr is {overrun_pct:.1f}% above original estimate of Rs. {latest.original_cost_cr:,.0f} Cr."
    else:
        desc = f"Cost is within original estimate (orig: Rs. {latest.original_cost_cr:,.0f} Cr, revised: Rs. {latest.revised_cost_cr:,.0f} Cr)."

    return RiskIndicator(
        id=ind_id,
        label='Cost Escalation',
        description=desc,
        rawValue=round(overrun_pct, 1),
        normalisedScore=norm_score_int,
        weight=weight,
        weightedContribution=weighted_contrib,
        category='Cost',
        severity=severity_from_score(norm_score_int)
    )

def calc_physical_financial_divergence(obs: List[PaimanaObservation]) -> RiskIndicator:
    ind_id = 'phys_fin_divergence'
    latest = obs[-1]
    exp_pct = latest.expenditure_pct_of_revised_cost if latest.expenditure_pct_of_revised_cost is not None else 0.0
    phys_pct = latest.physical_progress_pct if latest.physical_progress_pct is not None else 0.0
    divergence = exp_pct - phys_pct

    trend_penalty = 0.0
    if len(obs) >= 2:
        divs = [((o.expenditure_pct_of_revised_cost or 0.0) - (o.physical_progress_pct or 0.0)) for o in obs]
        worsening = divs[-1] - divs[0]
        if worsening > 15:
            trend_penalty = 15.0
        elif worsening > 5:
            trend_penalty = 8.0

    norm_score = clamp(linear_norm(divergence, -20.0, 60.0) * 80.0 / 100.0 + (10.0 if divergence > 0 else 0.0) + trend_penalty, 0.0, 100.0)
    weight = 10
    contribution = (norm_score * weight) / 100.0
    norm_score_int = js_round(norm_score)
    weighted_contrib = round(contribution, 2)

    if divergence > 0:
        desc = f"Expenditure ({exp_pct:.1f}% of revised cost) exceeds physical progress ({phys_pct:.1f}%) by {divergence:.1f} pp."
    else:
        desc = f"Physical progress ({phys_pct:.1f}%) is ahead of expenditure ({exp_pct:.1f}% of revised cost); gap: {abs(divergence):.1f} pp."

    return RiskIndicator(
        id=ind_id,
        label='Physical-Financial Divergence',
        description=desc,
        rawValue=round(divergence, 1),
        normalisedScore=norm_score_int,
        weight=weight,
        weightedContribution=weighted_contrib,
        category='Execution',
        severity=severity_from_score(norm_score_int)
    )

def calc_deteriorating_trend(obs: List[PaimanaObservation]) -> RiskIndicator:
    ind_id = 'deteriorating_trend'
    if len(obs) < 3:
        return RiskIndicator(
            id=ind_id,
            label='Deteriorating Trend',
            description='Insufficient monthly observations to assess progress trend direction.',
            rawValue=None,
            normalisedScore=30,
            weight=10,
            weightedContribution=3.0,
            category='Trend',
            severity='low'
        )
    deltas = [obs[i].physical_progress_pct - obs[i - 1].physical_progress_pct for i in range(1, len(obs))]
    mid = len(deltas) // 2
    early_avg = sum(deltas[:mid]) / mid
    recent_avg = sum(deltas[mid:]) / (len(deltas) - mid)
    decel = early_avg - recent_avg

    if decel <= -5.0:
        norm_score = 0.0
    elif decel <= 0.0:
        norm_score = linear_norm(decel + 5.0, 0.0, 5.0) * 30.0 / 100.0
    elif decel <= 10.0:
        norm_score = 30.0 + linear_norm(decel, 0.0, 10.0) * 70.0 / 100.0
    else:
        norm_score = 100.0
    norm_score = clamp(norm_score, 0.0, 100.0)

    weight = 10
    contribution = (norm_score * weight) / 100.0
    norm_score_int = js_round(norm_score)
    weighted_contrib = round(contribution, 2)

    if decel > 2.0:
        desc = f"Progress decelerated: early {early_avg:.2f} pp/month vs recent {recent_avg:.2f} pp/month (slowdown: {decel:.2f} pp/month)."
    elif decel < -2.0:
        desc = f"Progress is accelerating: recent {recent_avg:.2f} pp/month vs early {early_avg:.2f} pp/month."
    else:
        desc = f"Progress rate stable (early: {early_avg:.2f} pp/month, recent: {recent_avg:.2f} pp/month)."

    return RiskIndicator(
        id=ind_id,
        label='Deteriorating Trend',
        description=desc,
        rawValue=round(decel, 3),
        normalisedScore=norm_score_int,
        weight=weight,
        weightedContribution=weighted_contrib,
        category='Trend',
        severity=severity_from_score(norm_score_int)
    )

def calc_evidence_confidence(obs_count: int) -> float:
    if obs_count >= 4:
        return 1.0
    if obs_count == 3:
        return 0.75
    if obs_count == 2:
        return 0.5
    return 0.25

def tier_from_score(score: int) -> RiskTier:
    if score >= 80:
        return 'CRITICAL'
    if score >= 60:
        return 'HIGH'
    if score >= 40:
        return 'MODERATE'
    return 'LOW'

def build_primary_concerns(indicators: List[RiskIndicator], obs: List[PaimanaObservation]) -> List[str]:
    concerns: List[str] = []
    sorted_inds = sorted(indicators, key=lambda i: i.weightedContribution, reverse=True)
    for ind in sorted_inds[:3]:
        if ind.severity == 'none' or ind.normalisedScore < 25:
            continue
        concerns.append(f"[{ind.label}] {ind.description}")

    if len(concerns) == 0 and len(obs) > 0:
        latest = obs[-1]
        concerns.append(
            f"Physical progress stands at {latest.physical_progress_pct}% with no critical risk signals in the Apr-Jul 2026 observation window."
        )
    return concerns

class PRISMRiskEngine:
    """
    Authoritative, 100% deterministic PRISM Risk Engine.
    Calculates composite risk score (0-100) using 6 evidence-based indicators.
    """
    @classmethod
    def assess(cls, observations: List[PaimanaObservation]) -> RiskAssessment:
        if not observations:
            raise ValueError("PRISMRiskEngine.assess() requires at least one observation")

        obs = sorted(observations, key=lambda o: o.report_month)
        indicators = [
            calc_progress_velocity(obs),
            calc_progress_stagnation(obs),
            calc_schedule_pressure(obs),
            calc_cost_escalation(obs),
            calc_physical_financial_divergence(obs),
            calc_deteriorating_trend(obs)
        ]

        composite_score = sum(ind.weightedContribution for ind in indicators)
        risk_score = js_round(clamp(composite_score, 0.0, 100.0))
        risk_tier = tier_from_score(risk_score)
        evidence_confidence = calc_evidence_confidence(len(obs))
        primary_concerns = build_primary_concerns(indicators, obs)

        return RiskAssessment(
            riskScore=risk_score,
            riskTier=risk_tier,
            evidenceConfidence=evidence_confidence,
            observationCount=len(obs),
            indicators=indicators,
            primaryConcerns=primary_concerns,
            assessedAt=datetime.now(timezone.utc).isoformat()
        )
