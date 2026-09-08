import json
from pathlib import Path
from typing import List, Dict, Any
from backend.models.project import Project, PortfolioKPIs

DEMO_JSON_PATH = Path(__file__).resolve().parent.parent / "demo_projects.json"

def _load_raw_demo_projects() -> List[Dict[str, Any]]:
    if DEMO_JSON_PATH.exists():
        with open(DEMO_JSON_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    return []

_RAW_DEMO = _load_raw_demo_projects()

def get_demo_projects() -> List[Project]:
    return [Project.model_validate(p) for p in _RAW_DEMO]

def compute_demo_kpis(projects: List[Project]) -> PortfolioKPIs:
    total_projects = len(projects)
    critical_projects = 0
    high_risk_projects = 0
    moderate_risk_projects = 0
    low_risk_projects = 0
    unrated_projects = 0
    p1_projects = 0
    p2_projects = 0
    p3_projects = 0

    total_budget_cr = 0.0
    budget_at_risk_cr = 0.0
    total_delay_months = 0.0
    total_cost_escalation_pct = 0.0
    total_risk_score = 0.0
    rated_risk_count = 0
    total_physical_progress = 0.0

    for p in projects:
        rev_cost = p.revisedCostCr or 0.0
        total_budget_cr += rev_cost
        total_delay_months += p.timeOverrunMonths or 0
        total_cost_escalation_pct += p.costOverrunPercent or 0.0
        total_physical_progress += p.physicalProgressPercent or 0.0

        if p.riskScore is not None:
            total_risk_score += p.riskScore
            rated_risk_count += 1

        tier = (p.riskTier or 'UNRATED').upper()
        if tier == 'CRITICAL':
            critical_projects += 1
            budget_at_risk_cr += rev_cost
        elif tier == 'HIGH':
            high_risk_projects += 1
            budget_at_risk_cr += rev_cost * 0.65
        elif tier == 'MODERATE':
            moderate_risk_projects += 1
            budget_at_risk_cr += rev_cost * 0.25
        elif tier == 'LOW':
            low_risk_projects += 1
            budget_at_risk_cr += rev_cost * 0.05
        else:
            unrated_projects += 1

        p_tier = p.priorityTier
        if p_tier == 'P1':
            p1_projects += 1
        elif p_tier == 'P2':
            p2_projects += 1
        elif p_tier == 'P3':
            p3_projects += 1

    avg_delay = round(total_delay_months / total_projects, 1) if total_projects > 0 else 0.0
    avg_cost_esc = round(total_cost_escalation_pct / total_projects, 1) if total_projects > 0 else 0.0
    avg_risk = round(total_risk_score / rated_risk_count, 1) if rated_risk_count > 0 else None
    avg_phys = round(total_physical_progress / total_projects, 1) if total_projects > 0 else None

    return PortfolioKPIs(
        totalProjects=total_projects,
        criticalProjects=critical_projects,
        highRiskProjects=high_risk_projects,
        moderateRiskProjects=moderate_risk_projects,
        lowRiskProjects=low_risk_projects,
        unratedProjects=unrated_projects,
        p1Projects=p1_projects,
        p2Projects=p2_projects,
        p3Projects=p3_projects,
        totalBudgetCr=round(total_budget_cr),
        budgetAtRiskCr=round(budget_at_risk_cr),
        averageDelayMonths=avg_delay,
        averageCostEscalationPercent=avg_cost_esc,
        activeEscalationsCount=critical_projects + high_risk_projects,
        averageRiskScore=avg_risk,
        averagePhysicalProgress=avg_phys
    )
