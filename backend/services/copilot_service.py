import os
import re
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from backend.config import GEMINI_API_KEY
from backend.models.project import Project
from backend.models.common import RiskTier
from backend.models.risk import RiskAssessment, PriorityAssessment
from backend.models.copilot import (
    CopilotResponse, GroundedProject, InterventionNarrativeResponse
)
from backend.repositories.paimana_repository import paimana_repository
from backend.services.project_query_service import ProjectQueryService

_ai_client = None

def get_gemini_client():
    global _ai_client
    api_key = os.getenv("GEMINI_API_KEY") or GEMINI_API_KEY
    if not api_key:
        return None
    if _ai_client is None:
        try:
            from google import genai
            _ai_client = genai.Client(api_key=api_key)
        except Exception as err:
            print(f"[CopilotService] Failed to initialize Google GenAI client: {err}")
            _ai_client = None
    return _ai_client

DEFAULT_SUGGESTED_QUESTIONS = [
    'Which projects have the highest risk?',
    'Why is project 701396 high risk?',
    'Which sectors have the highest average risk?',
    'Which projects need intervention first?',
    'Which projects show stagnant progress?'
]

KNOWN_STATES = [
    'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
    'Delhi', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu & Kashmir',
    'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra',
    'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
    'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh',
    'Uttarakhand', 'West Bengal', 'Chandigarh', 'Ladakh', 'Puducherry'
]

KNOWN_SECTORS: Dict[str, str] = {
    'railway': 'Railways', 'railways': 'Railways', 'rail': 'Railways',
    'road': 'Road Transport & Highways', 'roads': 'Road Transport & Highways',
    'highway': 'Road Transport & Highways', 'highways': 'Road Transport & Highways',
    'water': 'Water Resources', 'irrigation': 'Water Resources',
    'coal': 'Coal & Mining', 'mining': 'Coal & Mining',
    'petroleum': 'Petroleum & Gas', 'gas': 'Petroleum & Gas', 'oil': 'Petroleum & Gas',
    'power': 'Power & Energy', 'energy': 'Power & Energy',
    'port': 'Ports & Shipping', 'ports': 'Ports & Shipping', 'shipping': 'Ports & Shipping',
    'telecom': 'Telecommunications', 'telecommunications': 'Telecommunications',
    'metro': 'Urban Affairs & Metro', 'urban': 'Urban Affairs & Metro',
    'steel': 'Steel & Heavy Industry'
}

class FactualContext:
    def __init__(
        self,
        intent: str,
        summary_text: str,
        grounded_projects: List[Project],
        suggested_questions: List[str],
        refuse_score_calc: bool = False,
        total_matching: Optional[int] = None
    ):
        self.intent = intent
        self.summary_text = summary_text
        self.grounded_projects = grounded_projects
        self.suggested_questions = suggested_questions
        self.refuse_score_calc = refuse_score_calc
        self.total_matching = total_matching

def resolve_query_factual_context(
    user_query: str,
    all_projects: List[Project],
    active_project: Optional[Project] = None
) -> FactualContext:
    q = user_query.lower().strip()

    # 1. Authority Defense
    if any(k in q for k in [
        'calculate the risk yourself', 'calculate risk yourself',
        'can you calculate the risk', 'compute the risk yourself',
        'calculate a different', 'calculate different', 'different risk score',
        'modify the risk score', 'change the risk score',
        'override the risk', 'override risk',
        'ignore prism', 'ignore the risk engine',
        'tell me your own', 'your own risk score',
        'ignore all previous', 'ignore previous',
        'set the risk', 'set risk to',
        'reduce the risk score to', 'jailbreak'
    ]):
        return FactualContext(
            intent='RISK_AUTHORITY_DEFENSE',
            refuse_score_calc=True,
            summary_text="""The PRISM Risk Engine is the sole authoritative source of project risk intelligence.

PRISM computes risk scores deterministically using 6 evidence-based indicators derived from longitudinal MoSPI PAIMANA monthly observations (April–July 2026):
1. **Progress Velocity (25% weight)**: Month-over-month rate of physical advancement.
2. **Progress Stagnation (20% weight)**: Consecutive reporting intervals with ≤ 0.5 pp progress.
3. **Schedule Pressure (20% weight)**: Time remaining until revised target completion.
4. **Cost Escalation (15% weight)**: Percentage cost overrun against original sanction.
5. **Physical-Financial Divergence (10% weight)**: Expenditure percentage exceeding physical progress.
6. **Deteriorating Trend (10% weight)**: Negative deceleration comparing earlier vs recent velocities.

Gemini functions solely as an explanation and analytical interface; it does not calculate, modify, or fabricate risk scores.""",
            grounded_projects=[active_project] if active_project else [],
            suggested_questions=DEFAULT_SUGGESTED_QUESTIONS
        )

    # 2. Risk Indicators Methodology
    if any(k in q for k in [
        'main risk indicators', 'risk indicators', 'how is risk calculated',
        'risk engine methodology', 'what are the indicators'
    ]):
        return FactualContext(
            intent='RISK_INDICATORS_METHODOLOGY',
            summary_text="""The PRISM Risk Engine evaluates every project using 6 deterministic indicators (scale 0–100):
- **Progress Velocity (Weight: 25)**: Evaluates whether physical advancement is keeping pace with project targets.
- **Progress Stagnation (Weight: 20)**: Flags chronic project freezes where progress changes by ≤ 0.5 pp over consecutive months.
- **Schedule Pressure (Weight: 20)**: Measures the gap between elapsed project time and remaining work before the revised target date.
- **Cost Escalation (Weight: 15)**: Reflects total cost growth relative to original approved budget.
- **Physical-Financial Divergence (Weight: 10)**: Identifies projects where capital drawdowns heavily outpace actual on-ground physical delivery.
- **Deteriorating Trend (Weight: 10)**: Compares early observation velocity against recent observation velocity to detect slowing momentum.

Risk Tiers:
- **CRITICAL**: 80–100 (Immediate PMG escalation)
- **HIGH**: 60–79 (Focused monitoring)
- **MODERATE**: 40–59 (Normal oversight)
- **LOW**: 0–39 (Healthy progression)""",
            grounded_projects=[],
            suggested_questions=[
                'Which projects have the highest risk?',
                'Which sector has the highest average risk?',
                'Which projects show stagnant progress?'
            ]
        )

    # 3. Specific Project Query
    id_match = re.search(r'\b\d{6,7}\b', q) or re.search(r'\bprj-in-\d+\b', q)
    mentioned_id = id_match.group(0) if id_match else None

    target_project: Optional[Project] = None
    if mentioned_id:
        target_project = paimana_repository.get_project_by_id(mentioned_id)
        if not target_project:
            target_project = next((p for p in all_projects if p.id.lower() == mentioned_id.lower()), None)
    elif active_project and any(k in q for k in [
        'this project', 'the project', 'project in focus', 'why is it',
        'how has progress changed', 'expenditure changed', 'since april'
    ]):
        target_project = active_project
    else:
        for p in all_projects:
            p_name = p.name.lower()
            if len(p_name) > 5 and p_name.split('(')[0].strip().lower() in q:
                target_project = p
                break

    if target_project:
        p = target_project
        assessment = paimana_repository.get_project_risk_assessment(p.id)
        priority = paimana_repository.get_project_priority_assessment(p.id)
        obs = paimana_repository.get_project_observations(p.id)

        trajectory_text = (
            '\n'.join([
                f"  * {o.report_month}: Physical {o.physical_progress_pct}%, Spend ₹{o.cumulative_expenditure_cr} Cr ({o.expenditure_pct_of_revised_cost}% of revised cost)"
                for o in obs
            ])
            if obs else '  * Longitudinal snapshots unavailable'
        )

        ind_text = (
            '\n'.join([
                f"  * **{ind.label}** (Evidence Weight: +{ind.weightedContribution:.1f} pts): {ind.description}"
                for ind in assessment.indicators
                if ind.severity != 'none' and ind.normalisedScore >= 20
            ])
            if assessment and assessment.indicators else
            '  * No elevated risk indicators detected; project follows standard execution pace.'
        )

        if any(k in q for k in ['progress changed', 'expenditure changed', 'since april']):
            first = obs[0] if obs else None
            latest = obs[-1] if obs else None
            prog_delta = f"{latest.physical_progress_pct - first.physical_progress_pct:.2f}" if (latest and first) else '0'
            spend_delta = f"{latest.cumulative_expenditure_cr - first.cumulative_expenditure_cr:.2f}" if (latest and first) else '0'
            sign = '+' if float(prog_delta) >= 0 else ''

            return FactualContext(
                intent='PROJECT_TRAJECTORY',
                summary_text=f"""Longitudinal history for **{p.name}** (`{p.code or p.id}`):
- **Observation Window**: {first.report_month if first else '2026-04'} to {latest.report_month if latest else '2026-07'} ({len(obs)} monthly observations)
- **Physical Progress**: Started at {first.physical_progress_pct if first else 'N/A'}% in April, currently at {latest.physical_progress_pct if latest else 'N/A'}% in July (Net change: **{sign}{prog_delta} percentage points**).
- **Cumulative Expenditure**: Started at ₹{first.cumulative_expenditure_cr if first else 'N/A'} Cr, currently at ₹{latest.cumulative_expenditure_cr if latest else 'N/A'} Cr (Net change: **+₹{spend_delta} Cr**).
- **Current PRISM Risk Index**: **{p.riskScore if p.riskScore is not None else 'UNRATED'}/100** ({p.riskTier or 'UNRATED'} Tier)
- **Primary Operational Driver**: {p.primaryRiskDriver or 'Standard Progression'}

Monthly breakdown:
{trajectory_text}""",
                grounded_projects=[p],
                suggested_questions=[
                    f"Why is project {p.id} high risk?",
                    f"What is the recommended action for {p.id}?",
                    'Which projects have the highest risk?'
                ],
                total_matching=1
            )

        return FactualContext(
            intent='PROJECT_DETAIL_EXPLANATION',
            summary_text=f"""Verified PAIMANA profile for **{p.name}** (`{p.code or p.id}`):
- **Sector & State**: {p.sector} | {p.state}
- **Executing Agency**: {p.implementingAgency}
- **PRISM Risk Index**: **{p.riskScore if p.riskScore is not None else 'UNRATED'} / 100** ({p.riskTier or 'UNRATED'} TIER)
- **Evidence Confidence**: {f"{int(round(p.evidenceConfidence * 100))}%" if p.evidenceConfidence else '100%'} ({len(obs)} monthly observations)
- **Intervention Priority**: **{priority.priorityTier if priority else (p.priorityTier or 'P2')}** (Priority Score: {priority.priorityScore if priority else (p.priorityScore or 'N/A')}, Urgency: {priority.urgency if priority else (p.urgency or 'N/A')}/100)
- **Schedule Performance**: Revised completion {p.revisedCompletionDate or 'N/A'} (Recorded overrun: **{p.timeOverrunMonths} months**).
- **Financial Status**: Original budget ₹{p.originalCostCr:,.0f} Cr revised to ₹{p.revisedCostCr:,.0f} Cr (+{p.costOverrunPercent}% cost overrun). Cumulative spend: ₹{p.cumulativeExpenditureCr:,.0f} Cr ({p.expenditurePctOfRevisedCost}% of revised budget).
- **Physical Progress**: **{p.physicalProgressPercent}%**

**Key Risk Indicators (PRISM Risk Engine Attribution)**:
{ind_text}

**Recommended Action**:
{priority.recommendedAction if priority else (p.recommendedAction or p.primaryDelayCause or 'Maintain standard PMG oversight cadence.')}""",
            grounded_projects=[p],
            suggested_questions=[
                f"How has project {p.id}'s progress changed since April?",
                'Which projects have the highest risk?',
                'Which sectors have the highest average risk?'
            ],
            total_matching=1
        )

    # 4. State Inquiries
    matched_state = next((st for st in KNOWN_STATES if re.search(rf'\b{re.escape(st.lower())}\b', q)), None)
    if matched_state:
        # 4A. State + Risk Tier
        target_risk_tier = None
        if 'critical' in q: target_risk_tier = 'CRITICAL'
        elif 'high risk' in q or 'high-risk' in q or ('high' in q and 'risk' in q): target_risk_tier = 'HIGH'
        elif 'moderate risk' in q or 'moderate-risk' in q or 'moderate' in q: target_risk_tier = 'MODERATE'
        elif 'low risk' in q or 'low-risk' in q or ('low' in q and 'risk' in q): target_risk_tier = 'LOW'

        if target_risk_tier:
            res = ProjectQueryService.get_projects_by_state_and_risk(matched_state, target_risk_tier, limit=5)
            list_text = (
                '\n\n'.join([
                    f"{i + 1}. **{p.name}** (`{p.code or p.id}`)\n"
                    f"   - **Risk Score**: **{p.riskScore}/100** [{p.riskTier}]\n"
                    f"   - **Sector**: {p.sector} | **Implementing Agency**: {p.implementingAgency}\n"
                    f"   - **Physical Progress**: {p.physicalProgressPercent}% | Spend: ₹{(p.cumulativeExpenditureCr or 0.0):,.0f} Cr ({p.expenditurePctOfRevisedCost}% of revised budget)\n"
                    f"   - **Overrun**: Schedule +{p.timeOverrunMonths} mo | Cost +{p.costOverrunPercent}%"
                    for i, p in enumerate(res['displayProjects'])
                ])
                if res['displayProjects'] else
                f"No dedicated projects found in {res['canonicalState']} matching the {target_risk_tier} risk tier."
            )

            multi_note = f"\n\n*Note on Multi-State Corridors:* {res['multiStateNotice']}" if res.get('multiStateNotice') else ''
            band_desc = '80–100' if target_risk_tier == 'CRITICAL' else ('60–79' if target_risk_tier == 'HIGH' else ('40–59' if target_risk_tier == 'MODERATE' else '0–39'))

            return FactualContext(
                intent='STATE_RISK_FILTER',
                summary_text=f"""PAIMANA State Risk Analysis: **{res['canonicalState']}** ({target_risk_tier} Risk)
- **Authoritative In-State Projects**: Exactly **{res['totalCount']} projects** located in {res['canonicalState']} are classified in the **{target_risk_tier}** risk band ({band_desc}).

{f"Showing **{len(res['displayProjects'])} of {res['totalCount']}** verified in-state {target_risk_tier.lower()}-risk projects:\n\n{list_text}" if res['totalCount'] > 0 else list_text}{multi_note}""",
                grounded_projects=res['displayProjects'],
                suggested_questions=[
                    f"Which projects need intervention first in {res['canonicalState']}?",
                    f"Show {'low' if target_risk_tier == 'HIGH' else 'high'}-risk projects in {res['canonicalState']}",
                    f"What is the average risk in {res['canonicalState']}?"
                ],
                total_matching=res['totalCount']
            )

        # 4B. State + Priority
        if any(k in q for k in ['intervention', 'priority', 'attention first', 'p1']):
            res = ProjectQueryService.get_priority_projects(state=matched_state, limit=5)
            list_text = (
                '\n\n'.join([
                    f"{i + 1}. **{p.name}** (`{p.code or p.id}`)\n"
                    f"   - **Priority Tier**: **{p.priorityTier}** (Priority Score: **{p.priorityScore}**, Urgency: {p.urgency}/100)\n"
                    f"   - **PRISM Risk Index**: {p.riskScore}/100 [{p.riskTier}]\n"
                    f"   - **Sector**: {p.sector} | **Physical Progress**: {p.physicalProgressPercent}%\n"
                    f"   - **Recommended Action**: {p.recommendedAction or 'Monitor progress'}"
                    for i, p in enumerate(res['projects'])
                ])
                if res['projects'] else f"No prioritized projects found in {matched_state}."
            )

            return FactualContext(
                intent='STATE_PRIORITY_FILTER',
                summary_text=f"""PRISM Intervention Priority Queue for **{matched_state}**:
Total monitored in-state projects: **{res['totalMatching']}** (P1 Immediate: **{res['p1Count']}**, P2 Oversight: **{res['p2Count']}**, P3 Routine: **{res['p3Count']}**).

Top prioritized projects in {matched_state} requiring administrative intervention:
{list_text}""",
                grounded_projects=res['projects'],
                suggested_questions=[
                    f"Show high-risk projects in {matched_state}",
                    f"Why is project {res['projects'][0].id if res['projects'] else '701396'} high risk?",
                    f"Show low-risk projects in {matched_state}"
                ],
                total_matching=res['totalMatching']
            )

        # 4C. State General Summary
        partition = ProjectQueryService.get_state_partition(matched_state)
        if not partition:
            return FactualContext(
                intent='STATE_SUMMARY',
                summary_text=f"No matching PAIMANA projects found for the state of **{matched_state}**.",
                grounded_projects=[],
                suggested_questions=DEFAULT_SUGGESTED_QUESTIONS
            )

        top_state_projects = sorted(
            [p for p in partition['dedicatedProjects'] if p.riskScore is not None],
            key=lambda p: (-(p.riskScore or 0), p.id)
        )[:5]

        top_state_list = '\n'.join([
            f"{i + 1}. **{p.name}** (`{p.code or p.id}`): Risk **{p.riskScore}/100** [{p.riskTier}], {p.sector}. Physical: {p.physicalProgressPercent}%, Cost Overrun: +{p.costOverrunPercent}%. Driver: {p.primaryRiskDriver or 'Progress Stagnation'}"
            for i, p in enumerate(top_state_projects)
        ])

        multi_state_bd = (
            f"\n- **Multi-State Corridors Involving {partition['canonicalState']}**: **{partition['multiStateCount']} projects** (High Risk: {partition['multiStateByRisk']['HIGH']}, Moderate: {partition['multiStateByRisk']['MODERATE']}, Low: {partition['multiStateByRisk']['LOW']})\n- **Total Associated Footprint**: **{partition['totalAssociatedCount']} projects**"
            if partition['multiStateCount'] > 0 else ''
        )

        return FactualContext(
            intent='STATE_SUMMARY',
            summary_text=f"""PAIMANA State Portfolio: **{partition['canonicalState']}**
- **Dedicated In-State Projects**: **{partition['dedicatedCount']} projects**
- **Committed Capital Outlay (In-State)**: ₹{partition['dedicatedKPIs'].totalBudgetCr:,.0f} Cr
- **Risk Stratification (Dedicated In-State)**:
  * Critical (80–100): **{partition['dedicatedByRisk']['CRITICAL']}**
  * High Risk (60–79): **{partition['dedicatedByRisk']['HIGH']}**
  * Moderate Risk (40–59): **{partition['dedicatedByRisk']['MODERATE']}**
  * Low Risk (0–39): **{partition['dedicatedByRisk']['LOW']}**
- **Average Physical Progress**: **{partition['dedicatedKPIs'].averagePhysicalProgress}%**{multi_state_bd}

Top elevated-risk dedicated in-state projects:
{top_state_list}""",
            grounded_projects=top_state_projects,
            suggested_questions=[
                f"Show high-risk projects in {partition['canonicalState']}",
                f"Show low-risk projects in {partition['canonicalState']}",
                f"Which projects need intervention first in {partition['canonicalState']}?"
            ],
            total_matching=partition['dedicatedCount']
        )

    # 5. Healthy / Good Pace Portfolio
    if any(k in q for k in ['good pace', 'performing well', 'healthy', 'on schedule', 'best performing']):
        healthy_res = ProjectQueryService.get_healthy_pace_projects(limit=5)
        list_text = '\n\n'.join([
            f"{i + 1}. **{p.name}** (`{p.code or p.id}`)\n"
            f"   - **PRISM Risk Index**: **{p.riskScore}/100** [{p.riskTier}]\n"
            f"   - **Physical Progress**: **{p.physicalProgressPercent}%**\n"
            f"   - **Schedule Overrun**: 0 months (Strictly On Schedule)\n"
            f"   - **Cost Overrun**: 0% (Within Sanctioned Budget)\n"
            f"   - **Sector & State**: {p.sector} • {p.state}"
            for i, p in enumerate(healthy_res['projects'])
        ])

        return FactualContext(
            intent='HEALTHY_PACE_PORTFOLIO',
            summary_text=f"""PRISM Verified Healthy Pace Assessment:
Across the national PAIMANA portfolio, **{healthy_res['totalHealthy']} projects** strictly satisfy PRISM's healthy execution standards:
1. **PRISM Risk Tier LOW** (Risk Index 0–39)
2. **Zero Schedule Slippage** (0 recorded overrun months)
3. **Zero Cost Escalation** (Within original sanction)
4. **Verified Physical Progress** (> 0%)

> ⚠️ **Qualification Rule:** In infrastructure project monitoring, high physical completion alone (e.g. 98%) does NOT equal "good pace" if a project suffered multi-year delays or extensive budget revisions. Only projects executing on-time and within-budget qualify.

Top verified healthy-pace infrastructure projects:
{list_text}""",
            grounded_projects=healthy_res['projects'],
            suggested_questions=[
                'Which projects have the highest risk?',
                'Which projects show stagnant progress?',
                'Which sectors have the highest average risk?'
            ],
            total_matching=healthy_res['totalHealthy']
        )

    # 6. Highest Risk Projects
    if any(k in q for k in ['highest risk', 'top risk', 'critical projects', 'highest-risk', 'most risky']) or ('highest' in q and 'risk' in q and 'sector' not in q):
        top_res = ProjectQueryService.get_top_risk_projects(limit=5)
        list_text = '\n\n'.join([
            f"{i + 1}. **{p.name}** (`{p.code or p.id}`)\n"
            f"   - **Risk Score**: **{p.riskScore}/100** [{p.riskTier}]\n"
            f"   - **Sector & State**: {p.sector} • {p.state}\n"
            f"   - **Progress vs Spend**: Physical {p.physicalProgressPercent}% | Spend ₹{(p.cumulativeExpenditureCr or 0.0):,.0f} Cr ({p.expenditurePctOfRevisedCost}% of revised budget)\n"
            f"   - **Overrun**: Schedule +{p.timeOverrunMonths} mo | Cost +{p.costOverrunPercent}%\n"
            f"   - **Primary Driver**: {p.primaryRiskDriver or 'Progress Stagnation'}"
            for i, p in enumerate(top_res['projects'])
        ])

        return FactualContext(
            intent='HIGHEST_RISK_PORTFOLIO',
            summary_text=f"""Portfolio Risk Assessment across **{len(all_projects)} monitored PAIMANA projects**:
- **Critical Projects (Risk 80–100)**: **{top_res['totalCritical']} projects**
- **High Risk Projects (Risk 60–79)**: **{top_res['totalHigh']} projects**

Top highest-risk infrastructure projects (deterministic ranking):
{list_text}""",
            grounded_projects=top_res['projects'],
            suggested_questions=[
                f"Why is project {top_res['projects'][0].id if top_res['projects'] else '701396'} high risk?",
                'Which sectors have the highest average risk?',
                'Which projects need intervention first?'
            ],
            total_matching=top_res['totalCritical'] + top_res['totalHigh']
        )

    # 7. Sector Queries
    if any(k in q for k in ['which sector has the highest average risk', 'sector has the highest average risk', 'sector has the highest risk', 'highest average risk', 'sectors with highest risk']):
        sec_stats = paimana_repository.get_sector_stats()
        sorted_secs = sorted(sec_stats, key=lambda s: s.avgRiskScore, reverse=True)
        highest_sec = sorted_secs[0]

        ranking_text = '\n'.join([
            f"{i + 1}. **{s.sector}**: Avg Risk **{s.avgRiskScore}/100** ({s.totalProjects} projects, {s.criticalProjects} Critical, {s.highRiskProjects} High, ₹{s.totalBudgetCr:,.0f} Cr outlay)"
            for i, s in enumerate(sorted_secs)
        ])

        return FactualContext(
            intent='SECTOR_HIGHEST_RISK',
            summary_text=f"""The infrastructure sector with the highest average risk is **{highest_sec.sector}** with an average PRISM Risk Index of **{highest_sec.avgRiskScore} / 100**.

**Sector Overview for {highest_sec.sector}**:
- Total Projects: **{highest_sec.totalProjects}**
- Critical Risk Projects: **{highest_sec.criticalProjects}**
- High Risk Projects: **{highest_sec.highRiskProjects}**
- Average Physical Progress: **{highest_sec.avgPhysicalProgress}%**
- Total Capital Outlay: **₹{highest_sec.totalBudgetCr:,.0f} Cr**

**Complete Sector Risk Ranking (Highest to Lowest)**:
{ranking_text}""",
            grounded_projects=[],
            suggested_questions=[
                'How many high-risk railway projects are there?',
                'Which projects have the highest risk?',
                'Which projects show stagnant progress?'
            ],
            total_matching=highest_sec.totalProjects
        )

    # Sector specific query
    sec_entry = next(((k, v) for k, v in KNOWN_SECTORS.items() if k in q), None)
    if sec_entry and any(k in q for k in ['how many', 'average risk', 'high-risk', 'projects in']):
        canonical_sec = sec_entry[1]
        sec_projs = [
            p for p in all_projects
            if canonical_sec.lower() in p.sector.lower() or (p.derivedSector and canonical_sec.lower() in p.derivedSector.lower())
        ]
        high_sec = [p for p in sec_projs if p.riskTier == 'HIGH']
        crit_sec = [p for p in sec_projs if p.riskTier == 'CRITICAL']
        avg_sec_risk = round(sum(p.riskScore or 0 for p in sec_projs) / (len(sec_projs) or 1), 1)
        avg_sec_prog = round(sum(p.physicalProgressPercent or 0.0 for p in sec_projs) / (len(sec_projs) or 1), 1)
        tot_sec_bud = round(sum(p.revisedCostCr or 0.0 for p in sec_projs))

        top_sec = sorted(
            [p for p in sec_projs if p.riskScore is not None],
            key=lambda p: (-(p.riskScore or 0), p.id)
        )[:5]

        top_sec_list = '\n'.join([
            f"{i + 1}. **{p.name}** (`{p.code or p.id}`): Risk **{p.riskScore}/100** [{p.riskTier}] ({p.state}). Physical: {p.physicalProgressPercent}%, Delay: +{p.timeOverrunMonths} mo."
            for i, p in enumerate(top_sec)
        ])

        return FactualContext(
            intent='SECTOR_SPECIFIC_SUMMARY',
            summary_text=f"""PAIMANA Sector Assessment: **{canonical_sec}**
- **Total Monitored Projects**: **{len(sec_projs)} projects**
- **Critical Risk Projects (80–100)**: **{len(crit_sec)} projects**
- **High Risk Projects (60–79)**: **{len(high_sec)} projects**
- **Average PRISM Risk Index**: **{avg_sec_risk} / 100**
- **Average Physical Progress**: **{avg_sec_prog}%**
- **Total Capital Commitment**: ₹{tot_sec_bud:,.0f} Cr

Top elevated-risk projects in {canonical_sec}:
{top_sec_list}""",
            grounded_projects=top_sec,
            suggested_questions=[
                'Which sector has the highest average risk?',
                'Which projects have the highest risk?',
                'Which projects need intervention first?'
            ],
            total_matching=len(sec_projs)
        )

    # 8. Stagnant Projects
    if any(k in q for k in ['stagnant progress', 'stagnant', 'stagnation', 'frozen progress']):
        stag_res = ProjectQueryService.get_stagnant_projects(limit=5)
        list_text = '\n\n'.join([
            f"{i + 1}. **{p.name}** (`{p.code or p.id}`)\n"
            f"   - **Risk**: {p.riskScore}/100 [{p.riskTier}] | **State**: {p.state} | **Sector**: {p.sector}\n"
            f"   - **Physical Progress**: {p.physicalProgressPercent}%\n"
            f"   - **Stagnation Evidence**: {p.primaryRiskDriver or (next((d.description for d in p.topRiskDrivers if 'stagnat' in d.label.lower()), 'Progress change ≤ 0.5 pp over consecutive observations'))}"
            for i, p in enumerate(stag_res['projects'])
        ])

        return FactualContext(
            intent='PROGRESS_STAGNATION',
            summary_text=f"""Progress Stagnation Analysis:
Across the national PAIMANA portfolio, **{stag_res['totalStagnant']} projects** exhibit progress stagnation (≤ 0.5 pp progress change across consecutive reporting months in the April–July 2026 window).

Top highest-risk projects exhibiting chronic progress stagnation:
{list_text}""",
            grounded_projects=stag_res['projects'],
            suggested_questions=[
                f"Why is project {stag_res['projects'][0].id if stag_res['projects'] else '701396'} high risk?",
                'Which projects show deteriorating progress?',
                'Which projects need intervention first?'
            ],
            total_matching=stag_res['totalStagnant']
        )

    # 9. Intervention Priority Queue
    if any(k in q for k in ['attention first', 'prioritize', 'priority queue', 'p1', 'need intervention', 'priority tier']):
        prio_res = ProjectQueryService.get_priority_projects(limit=5)
        list_text = '\n\n'.join([
            f"{i + 1}. **{p.name}** (`{p.code or p.id}`)\n"
            f"   - **Priority Tier**: **{p.priorityTier}** (Priority Score: **{p.priorityScore}**, Urgency: {p.urgency}/100)\n"
            f"   - **PRISM Risk Index**: {p.riskScore}/100 [{p.riskTier}]\n"
            f"   - **Sector & State**: {p.sector} • {p.state}\n"
            f"   - **Recommended Action**: {p.recommendedAction or 'Maintain standard PMG oversight'}"
            for i, p in enumerate(prio_res['projects'])
        ])

        return FactualContext(
            intent='INTERVENTION_PRIORITY_QUEUE',
            summary_text=f"""PRISM Intervention Priority Queue (Phase 3A):
The priority engine rank-orders projects by combining **PRISM Risk Index (40%)**, **Schedule Urgency (25%)**, **Recent Progress Deterioration (20%)**, and **Evidence Confidence (15%)**.

- **P1 Immediate Intervention (Priority ≥ 70)**: **{prio_res['p1Count']} projects**
- **P2 High-Priority Monitoring (50–69)**: **{prio_res['p2Count']} projects**
- **P3 Routine Monitoring (< 50)**: **{prio_res['p3Count']} projects**

Top prioritized projects requiring immediate inter-ministerial intervention:
{list_text}""",
            grounded_projects=prio_res['projects'],
            suggested_questions=[
                f"Why is project {prio_res['projects'][0].id if prio_res['projects'] else '701396'} high risk?",
                'Which projects have the highest risk?',
                'Which sectors have the highest average risk?'
            ],
            total_matching=prio_res['totalMatching']
        )

    # 10. Portfolio Overview
    if any(k in q for k in ['how many projects are being monitored', 'how many projects are monitored', 'how many projects', 'average portfolio risk', 'portfolio risk', 'overview']):
        kpis = paimana_repository.compute_kpis()
        return FactualContext(
            intent='PORTFOLIO_KPI_OVERVIEW',
            summary_text=f"""National Infrastructure Portfolio (MoSPI PAIMANA Monitoring):
- **Total Monitored Projects**: **{kpis.totalProjects:,} projects**
- **Total Committed Capital Outlay**: ₹{kpis.totalBudgetCr:,.0f} Cr
- **Average PRISM Risk Index**: **{kpis.averageRiskScore} / 100**
- **Average Physical Progress**: **{kpis.averagePhysicalProgress}%**
- **Average Schedule Slippage**: **{kpis.averageDelayMonths} months**
- **Average Cost Escalation**: **+{kpis.averageCostEscalationPercent}%**

**Risk Stratification (Canonical PRISM Tiers)**:
- **CRITICAL (80–100)**: **{kpis.criticalProjects} projects** (Immediate PMG intervention)
- **HIGH (60–79)**: **{kpis.highRiskProjects} projects** (Priority watchlist)
- **MODERATE (40–59)**: **{kpis.moderateRiskProjects} projects** (Routine oversight)
- **LOW (0–39)**: **{kpis.lowRiskProjects} projects** (Normal progression)
- **UNRATED**: **{kpis.unratedProjects} projects**""",
            grounded_projects=[p for p in all_projects if p.riskTier == 'CRITICAL'][:5],
            suggested_questions=[
                'Which projects have the highest risk?',
                'Which sector has the highest average risk?',
                'Which projects show stagnant progress?'
            ],
            total_matching=kpis.totalProjects
        )

    # 11. Generic Search across projects
    matched = [
        p for p in all_projects
        if q in p.name.lower() or q in p.code.lower() or q in p.implementingAgency.lower()
    ]
    if matched:
        top_matches = matched[:5]
        list_text = '\n'.join([
            f"{i + 1}. **{p.name}** (`{p.code or p.id}`): Risk {p.riskScore}/100 [{p.riskTier}], {p.sector} ({p.state}). Physical: {p.physicalProgressPercent}%, Spend: ₹{(p.cumulativeExpenditureCr or 0.0):,.0f} Cr."
            for i, p in enumerate(top_matches)
        ])
        return FactualContext(
            intent='MATCHED_SEARCH',
            summary_text=f"Found **{len(matched)} matching PAIMANA projects** for \"{user_query}\":\n\n{list_text}",
            grounded_projects=top_matches,
            suggested_questions=[
                f"Why is project {top_matches[0].id} high risk?",
                'Which projects have the highest risk?',
                'Which sectors have the highest average risk?'
            ],
            total_matching=len(matched)
        )

    return FactualContext(
        intent='NO_MATCH',
        summary_text='No matching PAIMANA projects found.',
        grounded_projects=[],
        suggested_questions=DEFAULT_SUGGESTED_QUESTIONS
    )

def map_grounded_project(p: Project) -> GroundedProject:
    return GroundedProject(
        id=p.id,
        name=p.name,
        riskScore=p.riskScore or 0,
        riskTier=p.riskTier,
        priorityTier=p.priorityTier,
        state=p.state,
        sector=p.derivedSector or p.sector or 'Infrastructure',
        physicalProgressPercent=p.physicalProgressPercent,
        primaryRiskDriver=p.primaryRiskDriver or p.priorityReason
    )

class CopilotService:
    @classmethod
    async def chat(
        cls,
        user_query: str,
        projects: List[Project],
        active_project_id: Optional[str] = None
    ) -> CopilotResponse:
        active_project = (
            paimana_repository.get_project_by_id(active_project_id)
            if active_project_id else None
        )

        factual = resolve_query_factual_context(user_query, projects, active_project)
        grounded_entities = [map_grounded_project(p) for p in factual.grounded_projects]

        client = get_gemini_client()

        if client and not factual.refuse_score_calc and factual.intent != 'NO_MATCH':
            try:
                system_instruction = """
You are the PRISM Risk Intelligence Copilot, an expert infrastructure monitoring analyst supporting the Ministry of Statistics & Programme Implementation (MoSPI) and Cabinet Project Monitoring Group (PMG).

CRITICAL OPERATIONAL RULES:
1. GEMINI IS NOT THE SOURCE OF TRUTH. The factual context provided below contains verified, authoritative figures from the PAIMANA repository. You MUST adhere strictly to these figures.
2. NEVER invent or hallucinate project names, codes, budgets, progress percentages, dates, risk scores, or locations.
3. NEVER calculate, alter, or predict risk scores. The PRISM Risk Engine is the sole authoritative source.
4. If asked to calculate risk yourself, state clearly that the PRISM Risk Engine provides the authoritative assessment based on 6 evidence-based indicators.
5. QUANTITATIVE PRECISION & CANONICAL TRUTH:
   - State the EXACT numerical counts, averages, and project IDs provided in the factual context.
   - Never recalculate counts, percentages, or averages.
6. STATE & MULTI-STATE DISTINCTION:
   - Differentiate clearly between dedicated state projects (e.g. 17 in Delhi) and multi-state transit corridors.
   - If reporting dedicated state projects, cite that dedicated count (e.g., 6 High-Risk projects).
7. "GOOD PACE" / "PERFORMANCE" CRITERIA:
   - Do NOT equate high physical completion with "good pace". A project at 98% completion with 40 months of delay and cost escalation is not on good pace.
   - Only describe projects as "on good pace" if verified by the context (Low risk, 0 delay, 0 cost escalation).
8. Use official PRISM terminology: "PRISM Risk Index", "PRISM Risk Engine", "PRISM Risk Indicators", "Evidence Weight", "Scenario Simulation".
   DO NOT use terms like SHAP, TreeSHAP, XGBoost, ML Risk Model, or Phase 2 calibration.
9. Present your answer with clear markdown headings, bullet points, and bold key metrics.
10. Keep responses concise, professional, and policy-grade (under 250 words).
"""
                prompt = f"""
AUTHORITATIVE PAIMANA REPOSITORY FACTUAL CONTEXT:
{factual.summary_text}

USER QUESTION:
"{user_query}"

Synthesize and explain this verified PAIMANA data directly in response to the user's question. Do not fabricate any numbers.
"""
                response = client.models.generate_content(
                    model='gemini-3.6-flash',
                    contents=prompt,
                    config={
                        'system_instruction': system_instruction,
                        'temperature': 0.1
                    }
                )

                text = response.text or ''
                if text.strip():
                    return CopilotResponse(
                        answer=text.strip(),
                        groundedProjects=grounded_entities,
                        suggestedQuestions=factual.suggested_questions,
                        totalMatching=factual.total_matching or len(grounded_entities),
                        displayedCount=len(grounded_entities)
                    )
            except Exception as err:
                print(f"[CopilotService] Gemini API call failed, using deterministic fallback: {err}")

        # Resilient Local Grounded Intelligence Engine (Fallback / Offline)
        return CopilotResponse(
            answer=factual.summary_text,
            groundedProjects=grounded_entities,
            suggestedQuestions=factual.suggested_questions,
            totalMatching=factual.total_matching or len(grounded_entities),
            displayedCount=len(grounded_entities)
        )

    ask = chat

    async def generate_narrative(
        cls,
        project: Project,
        scenario: Dict[str, Any]
    ) -> InterventionNarrativeResponse:
        client = get_gemini_client()
        timestamp = datetime.now(timezone.utc).isoformat()

        levers_text = (
            ', '.join([f"*{a.get('lever')}* ({a.get('value')}: -{a.get('pointsReduced')} pts)" for a in scenario.get('assumptionImpacts', [])])
            if scenario.get('assumptionImpacts') else 'standard monitoring'
        )

        fallback_memo = f"""### 🏛️ MoSPI PMG Executive Intervention Memorandum

**1. Executive Context & PAIMANA Baseline:**
Project **{project.name}** (`{project.id}`) under **{project.ministry or project.implementingAgency}** ({project.state}) records **{project.physicalProgressPercent}%** cumulative physical completion against ₹**{(project.cumulativeExpenditureCr or 0.0):,.0f} Cr** expenditure. Under the authoritative PRISM Risk Engine, the project is categorized as **{scenario.get('originalRiskTier')}** Risk (**{scenario.get('originalRiskScore')}/100**) and **{scenario.get('originalPriorityTier')}** Priority due to {scenario.get('officerBrief', {}).get('primaryConcern', 'critical-path schedule compression and progress stagnation')}.

**2. Simulated Policy Intervention Package:**
To arrest further milestone slippage, the simulated policy package introduces targeted operational levers: {levers_text}. These parametric adjustments directly resolve the statutory and liquidity bottlenecks identified in the 6 PRISM Risk Indicators.

**3. Projected Scenario Recovery:**
Under full operationalization of these measures, the modeled risk profile improves from **{scenario.get('originalRiskScore')}** ({scenario.get('originalRiskTier')}) to **{scenario.get('simulatedRiskScore')}** ({scenario.get('simulatedRiskTier')}), precipitating a priority tier transition from **{scenario.get('originalPriorityTier')}** to **{scenario.get('simulatedPriorityTier')}** and averting an estimated **~{scenario.get('delaySavedMonths', 0)} months** of cumulative project delay.

*Disclaimer: Illustrative Policy Scenario — Not an Observed Forecast. Parametric sensitivities do not modify official MoSPI PAIMANA historical records.*"""

        if client:
            try:
                system_instruction = """You are the PRISM MoSPI Executive Brief Synthesizer.
You draft high-level, policy-grade memoranda for the Cabinet Secretariat, Ministry of Statistics & Programme Implementation (MoSPI), and Project Monitoring Group (PMG).

CRITICAL CONSTRAINTS:
1. You MUST NOT calculate or modify risk scores or priority tiers. All figures provided in the prompt are authoritative outputs from the PRISM Deterministic Engines.
2. DO NOT hallucinate progress figures, costs, or dates. Cite only the structured data provided.
3. Clearly state that the simulated scenario is an "Illustrative Policy Scenario — Not an Observed Forecast".
4. Format in exactly 3 concise, formal paragraphs:
   - Paragraph 1: Executive Context & PAIMANA Baseline
   - Paragraph 2: Simulated Policy Intervention Levers
   - Paragraph 3: Projected Recovery Trajectory & Policy Disclaimer
5. Keep tone formal, authoritative, and policy-focused (under 250 words)."""

                prompt = f"""
STRUCTURED PROJECT & SCENARIO CONTEXT:
- Project Name: {project.name} ({project.id})
- Ministry / Implementing Agency: {project.ministry or project.implementingAgency}
- State / Sector: {project.state} / {project.derivedSector or project.sector}
- Physical Completion: {project.physicalProgressPercent}% | Cumulative Spend: ₹{project.cumulativeExpenditureCr} Cr
- Cost Overrun: +{project.costOverrunPercent}% | Time Overrun: +{project.timeOverrunMonths} months
- Current PRISM Risk: {scenario.get('originalRiskScore')}/100 ({scenario.get('originalRiskTier')})
- Current Intervention Priority: {scenario.get('originalPriorityTier')} ({scenario.get('originalPriorityScore')}/100)
- Simulated Scenario Risk: {scenario.get('simulatedRiskScore')}/100 ({scenario.get('simulatedRiskTier')}) [Delta: {scenario.get('riskScoreDelta')} pts]
- Simulated Intervention Priority: {scenario.get('simulatedPriorityTier')} ({scenario.get('simulatedPriorityScore')}/100) [Delta: {scenario.get('priorityScoreDelta')} pts]
- Delay Recovered: ~{scenario.get('delaySavedMonths')} months | Cost Escalation Curtailed: ₹{scenario.get('costSavedCr')} Cr
- Applied Policy Levers: {scenario.get('assumptionImpacts', [])}
- Indicator Changes: {scenario.get('indicatorChanges', [])}
- Primary Concern: {scenario.get('officerBrief', {}).get('primaryConcern')}
- Recommended Action: {scenario.get('officerBrief', {}).get('recommendedAction')}

Synthesize an official executive intervention memorandum based exclusively on these verified facts.
"""
                response = client.models.generate_content(
                    model='gemini-3.6-flash',
                    contents=prompt,
                    config={
                        'system_instruction': system_instruction,
                        'temperature': 0.1
                    }
                )

                text = response.text or ''
                if text.strip():
                    return InterventionNarrativeResponse(
                        narrative=text.strip(),
                        isAIGenerated=True,
                        generatedAt=timestamp
                    )
            except Exception as err:
                print(f"[CopilotService] Gemini narrative generation failed, using fallback: {err}")

        return InterventionNarrativeResponse(
            narrative=fallback_memo,
            isAIGenerated=False,
            generatedAt=timestamp
        )
