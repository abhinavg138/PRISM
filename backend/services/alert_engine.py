from typing import List, Optional, Dict
from backend.models.project import Project, PaimanaObservation, EarlyWarningAlert
from backend.models.common import AlertType, AlertSeverity

MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

def format_month(report_month: Optional[str]) -> str:
    if not report_month:
        return 'Recent Observation'
    parts = report_month.strip().split('-')
    if len(parts) != 2:
        return report_month
    try:
        y = parts[0]
        m = int(parts[1])
        if 1 <= m <= 12:
            return f"{MONTH_NAMES[m - 1]} {y}"
    except (ValueError, TypeError):
        pass
    return report_month

class PRISMAlertEngine:
    """
    Evidence-based Early Warning Alert Engine.
    Detects empirical operational indicators requiring attention across 6 alert categories.
    """
    @classmethod
    def evaluate_project(
        cls,
        project: Project,
        observations: Optional[List[PaimanaObservation]] = None
    ) -> Optional[EarlyWarningAlert]:
        trend = project.monthlyTrend or []
        length = len(trend)

        # 1. Progress Stagnation
        if length >= 2 and (project.physicalProgressPercent or 0.0) < 98.0:
            consecutive_stagnant = 0
            for i in range(length - 1, 0, -1):
                d = (trend[i].actualPercent or 0.0) - (trend[i - 1].actualPercent or 0.0)
                if abs(d) <= 0.2:
                    consecutive_stagnant += 1
                else:
                    break

            if consecutive_stagnant >= 2:
                last = trend[length - 1]
                first_stagnant = trend[length - 1 - consecutive_stagnant] if (length - 1 - consecutive_stagnant) >= 0 else trend[length - 2]
                total_delta = (last.actualPercent or 0.0) - (first_stagnant.actualPercent or 0.0)
                period_str = f"{format_month(first_stagnant.reportMonth or first_stagnant.month)} – {format_month(last.reportMonth or last.month)}"
                sign = '+' if total_delta >= 0 else ''

                return EarlyWarningAlert(
                    id=f"alert-stag-{project.id}",
                    projectId=project.id,
                    projectName=project.name,
                    projectCode=project.code,
                    state=project.state,
                    sector=project.derivedSector or project.sector,
                    implementingAgency=project.implementingAgency,
                    alertType='Progress Stagnation',
                    severity='CRITICAL' if consecutive_stagnant >= 3 else 'HIGH',
                    detectedPeriod=period_str,
                    evidence=f"Physical progress changed by only {sign}{total_delta:.1f} percentage points across {consecutive_stagnant} consecutive observation cycles ({first_stagnant.actualPercent}% to {last.actualPercent}%).",
                    recommendedAttention='Conduct site execution review and verify contractor physical plant mobilization.',
                    riskScore=project.riskScore,
                    priorityScore=project.priorityScore,
                    priorityTier=project.priorityTier
                )

        # 2. High/Critical Risk
        if project.riskScore is not None and project.riskScore >= 80:
            return EarlyWarningAlert(
                id=f"alert-risk-{project.id}",
                projectId=project.id,
                projectName=project.name,
                projectCode=project.code,
                state=project.state,
                sector=project.derivedSector or project.sector,
                implementingAgency=project.implementingAgency,
                alertType='High/Critical Risk',
                severity='CRITICAL',
                detectedPeriod=format_month(project.lastUpdated),
                evidence=f"Composite PRISM Risk Index reached {project.riskScore}/100 ({project.riskTier}) confirmed by longitudinal monthly flash reports.",
                recommendedAttention='Escalate to Ministry Project Monitoring Cell for monthly cabinet oversight review.',
                riskScore=project.riskScore,
                priorityScore=project.priorityScore,
                priorityTier=project.priorityTier
            )

        # 3. Physical-Financial Divergence
        rev_cost = project.revisedCostCr or 0.0
        exp_pct = project.expenditurePctOfRevisedCost
        if exp_pct is None:
            exp_pct = round(((project.cumulativeExpenditureCr or 0.0) / rev_cost) * 100.0, 1) if rev_cost > 0 else 0.0

        phys_pct = project.physicalProgressPercent or 0.0
        divergence_gap = round(exp_pct - phys_pct, 1)

        if divergence_gap >= 20.0 and (project.cumulativeExpenditureCr or 0.0) >= 10.0:
            return EarlyWarningAlert(
                id=f"alert-div-{project.id}",
                projectId=project.id,
                projectName=project.name,
                projectCode=project.code,
                state=project.state,
                sector=project.derivedSector or project.sector,
                implementingAgency=project.implementingAgency,
                alertType='Physical-Financial Divergence',
                severity='CRITICAL' if divergence_gap >= 35.0 else 'HIGH',
                detectedPeriod=format_month(project.lastUpdated),
                evidence=f"Cumulative expenditure reached {exp_pct:.1f}% of revised budget while physical progress stands at only {phys_pct:.1f}% ({divergence_gap:.1f} pp divergence gap).",
                recommendedAttention='Audit milestone-linked disbursement vouchers and contractor payment clearances.',
                riskScore=project.riskScore,
                priorityScore=project.priorityScore,
                priorityTier=project.priorityTier
            )

        # 4. Cost Escalation
        if (project.costOverrunPercent or 0.0) >= 40.0 and (project.originalCostCr or 0.0) >= 10.0:
            return EarlyWarningAlert(
                id=f"alert-cost-{project.id}",
                projectId=project.id,
                projectName=project.name,
                projectCode=project.code,
                state=project.state,
                sector=project.derivedSector or project.sector,
                implementingAgency=project.implementingAgency,
                alertType='Cost Escalation',
                severity='CRITICAL' if (project.costOverrunPercent or 0.0) >= 80.0 else 'HIGH',
                detectedPeriod=format_month(project.lastUpdated),
                evidence=f"Sanctioned cost increased by {project.costOverrunPercent:.1f}% from ₹{project.originalCostCr:,.0f} Cr original outlay to ₹{project.revisedCostCr:,.0f} Cr revised outlay.",
                recommendedAttention='Initiate Expenditure Finance Committee (EFC) revised cost sanction review.',
                riskScore=project.riskScore,
                priorityScore=project.priorityScore,
                priorityTier=project.priorityTier
            )

        # 5. Schedule Pressure
        if (project.urgency or 0) >= 85 and (project.physicalProgressPercent or 0.0) < 90.0:
            remaining_work = 100.0 - (project.physicalProgressPercent or 0.0)
            target_date = project.revisedCompletionDate or project.originalCompletionDate or 'Not specified'
            return EarlyWarningAlert(
                id=f"alert-sched-{project.id}",
                projectId=project.id,
                projectName=project.name,
                projectCode=project.code,
                state=project.state,
                sector=project.derivedSector or project.sector,
                implementingAgency=project.implementingAgency,
                alertType='Schedule Pressure',
                severity='HIGH',
                detectedPeriod=format_month(project.lastUpdated),
                evidence=f"Target completion date ({target_date}) indicates critical schedule pressure with {remaining_work:.1f}% physical work remaining.",
                recommendedAttention='Convene inter-agency taskforce to finalize revised critical path recovery plan.',
                riskScore=project.riskScore,
                priorityScore=project.priorityScore,
                priorityTier=project.priorityTier
            )

        # 6. Deteriorating Progress
        if length >= 3:
            deltas = [
                (trend[i].actualPercent or 0.0) - (trend[i - 1].actualPercent or 0.0)
                for i in range(1, length)
            ]
            recent_delta = deltas[-1]
            early_deltas = deltas[:-1]
            early_avg = sum(early_deltas) / (len(early_deltas) or 1)

            if early_avg >= 1.0 and (early_avg - recent_delta) >= 1.5:
                last = trend[length - 1]
                return EarlyWarningAlert(
                    id=f"alert-decel-{project.id}",
                    projectId=project.id,
                    projectName=project.name,
                    projectCode=project.code,
                    state=project.state,
                    sector=project.derivedSector or project.sector,
                    implementingAgency=project.implementingAgency,
                    alertType='Deteriorating Progress',
                    severity='HIGH' if recent_delta <= 0 else 'MEDIUM',
                    detectedPeriod=format_month(last.reportMonth or last.month),
                    evidence=f"Monthly progress pace slowed from an earlier average of {early_avg:.1f} pp/mo to {recent_delta:.1f} pp/mo in {format_month(last.reportMonth or last.month)}.",
                    recommendedAttention='Investigate work front bottlenecks and verify field measurement certification.',
                    riskScore=project.riskScore,
                    priorityScore=project.priorityScore,
                    priorityTier=project.priorityTier
                )

        return None

    @classmethod
    def generate_alerts(
        cls,
        projects: List[Project],
        observations_map: Optional[Dict[str, List[PaimanaObservation]]] = None
    ) -> List[EarlyWarningAlert]:
        alerts: List[EarlyWarningAlert] = []

        for project in projects:
            obs_list = observations_map.get(project.id) if observations_map else None
            alert = cls.evaluate_project(project, obs_list)
            if alert:
                alerts.append(alert)

        severity_order: Dict[str, int] = {
            'CRITICAL': 0,
            'HIGH': 1,
            'MEDIUM': 2
        }

        # Deterministic sort: CRITICAL first, then HIGH, then MEDIUM;
        # within same severity, by priorityScore / riskScore DESC
        def alert_sort_key(a: EarlyWarningAlert):
            score = a.priorityScore if a.priorityScore is not None else (a.riskScore if a.riskScore is not None else 0)
            return (severity_order.get(a.severity, 3), -score)

        alerts.sort(key=alert_sort_key)
        return alerts
