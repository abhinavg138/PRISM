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
# Default to gemini-3.6-flash per current GenAI model availability
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.6-flash")

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

STATE_SYNONYMS: Dict[str, str] = {
    'new delhi': 'Delhi',
    'delhi ncr': 'Delhi',
    'nct of delhi': 'Delhi',
    'up': 'Uttar Pradesh',
    'u.p.': 'Uttar Pradesh',
    'mp': 'Madhya Pradesh',
    'm.p.': 'Madhya Pradesh',
    'ap': 'Andhra Pradesh',
    'a.p.': 'Andhra Pradesh',
    'wb': 'West Bengal',
    'w.b.': 'West Bengal',
    'j&k': 'Jammu & Kashmir',
    'jk': 'Jammu & Kashmir',
}

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

def _extract_state_intent(q: str) -> tuple[Optional[str], List[str]]:
    """Returns (state, state_exclude)."""
    state_exclude: List[str] = []
    state: Optional[str] = None

    # 1. Exclusion check: "not in delhi", "excluding delhi", "exclude delhi", "except delhi", "without delhi", "outside delhi"
    for st_raw, st_canon in [(s.lower(), s) for s in KNOWN_STATES] + list(STATE_SYNONYMS.items()):
        pattern_ex = rf'\b(?:not\s+in|excluding|exclude|except|without|outside)\s+{re.escape(st_raw)}\b'
        if re.search(pattern_ex, q):
            if st_canon not in state_exclude:
                state_exclude.append(st_canon)

    for st_raw, st_canon in [(s.lower(), s) for s in KNOWN_STATES] + list(STATE_SYNONYMS.items()):
        if re.search(rf'\b(?:excluding|exclude)\s+{re.escape(st_raw)}\b', q):
            if st_canon not in state_exclude:
                state_exclude.append(st_canon)

    # 2. Positive mention check:
    for st_raw, st_canon in [(s.lower(), s) for s in KNOWN_STATES] + list(STATE_SYNONYMS.items()):
        if st_canon in state_exclude:
            continue
        pattern = rf'\b{re.escape(st_raw)}\b'
        if re.search(pattern, q):
            state = st_canon
            break

    return state, state_exclude

def _extract_sector_intent(q: str) -> tuple[Optional[str], List[str]]:
    """Returns (sector, sector_exclude)."""
    sector_exclude: List[str] = []
    sector: Optional[str] = None

    for sec_raw, sec_canon in KNOWN_SECTORS.items():
        pattern_ex = rf'\b(?:not\s+in|excluding|exclude|except|without|outside|non-)\s*{re.escape(sec_raw)}\b'
        if re.search(pattern_ex, q):
            if sec_canon not in sector_exclude:
                sector_exclude.append(sec_canon)

    for sec_raw, sec_canon in KNOWN_SECTORS.items():
        if sec_canon in sector_exclude:
            continue
        pattern = rf'\b{re.escape(sec_raw)}\b'
        if re.search(pattern, q):
            sector = sec_canon
            break

    return sector, sector_exclude

def _extract_risk_intent(q: str) -> tuple[Optional[str], List[str], Optional[str], Optional[str]]:
    """Returns (risk_tier, risk_tier_exclude, sort_by, sort_direction)."""
    risk_tier_exclude: List[str] = []
    risk_tier: Optional[str] = None
    sort_by: Optional[str] = None
    sort_direction: Optional[str] = None

    # Negation check
    if (
        re.search(r"\b(?:without|not|aren't|arent|except|don't\s+show|dont\s+show|exclude)\s+(?:a\s+)?(?:high|highly|critical|elevated)[\s-]*risk\b", q) or
        re.search(r"\b(?:without|not|aren't|arent|except|don't\s+show|dont\s+show|exclude)\s+(?:high|critical)\b", q) or
        re.search(r"\b(?:show\s+everything\s+except\s+high[\s-]*risk)\b", q) or
        re.search(r"\bnon-risky\b", q)
    ):
        risk_tier_exclude.extend(['HIGH', 'CRITICAL'])

    if re.search(r"\b(?:without|not|aren't|arent|except|don't\s+show|dont\s+show|exclude)\s+(?:a\s+)?(?:low|safest|safe)[\s-]*risk\b", q):
        risk_tier_exclude.append('LOW')

    if re.search(r"\b(?:without|not|aren't|arent|except|don't\s+show|dont\s+show|exclude)\s+(?:moderate|medium)[\s-]*risk\b", q):
        risk_tier_exclude.append('MODERATE')

    # Positive risk tier (if not negated)
    if any(k in q for k in [
        'least risk', 'least-risk', 'least risky', 'least-risky',
        'lowest risk', 'lowest-risk', 'safest', 'safe projects',
        'low risk', 'low-risk'
    ]) and 'LOW' not in risk_tier_exclude:
        risk_tier = 'LOW'
        sort_by = 'riskScore'
        sort_direction = 'asc'
    elif any(k in q for k in ['critical risk', 'critical-risk', 'critical projects']) and 'CRITICAL' not in risk_tier_exclude:
        risk_tier = 'CRITICAL'
        sort_by = 'riskScore'
        sort_direction = 'desc'
    elif any(k in q for k in ['highest risk', 'highest-risk', 'most risky', 'top risk', 'highest']):
        sort_by = 'riskScore'
        sort_direction = 'desc'
    elif any(k in q for k in [
        'high risk', 'high-risk', 'highly risky', 'highly-risky',
        'elevated risk', 'elevated-risk', 'severely risky', 'risky projects'
    ]) and 'HIGH' not in risk_tier_exclude:
        risk_tier = 'HIGH'
        sort_by = 'riskScore'
        sort_direction = 'desc'
    elif any(k in q for k in ['moderate risk', 'moderate-risk', 'medium risk', 'medium-risk', 'moderate']) and 'MODERATE' not in risk_tier_exclude:
        risk_tier = 'MODERATE'

    return risk_tier, risk_tier_exclude, sort_by, sort_direction

def _extract_numerical_intent(q: str) -> Dict[str, Any]:
    res: Dict[str, Any] = {
        'min_risk': None,
        'max_risk': None,
        'min_cost_cr': None,
        'max_cost_cr': None,
        'min_progress_pct': None,
        'max_progress_pct': None,
        'min_delay_months': None,
        'max_delay_months': None,
    }

    # Risk bounds: "risk below 20", "risk above 80", "between risk 40 and 60"
    m_between = re.search(r'(?:between\s+risk|risk\s+between)\s+(\d+(?:\.\d+)?)\s+(?:and|to)\s+(\d+(?:\.\d+)?)', q)
    if m_between:
        r1, r2 = float(m_between.group(1)), float(m_between.group(2))
        res['min_risk'] = min(r1, r2)
        res['max_risk'] = max(r1, r2)
    else:
        m_below = re.search(r'(?:risk\s+(?:below|under|<|less\s+than)|(?:below|under|<|less\s+than)\s+(\d+(?:\.\d+)?)\s+risk)\s*(\d+(?:\.\d+)?)?', q)
        if m_below:
            val = m_below.group(2) or m_below.group(1)
            if val:
                res['max_risk'] = float(val)
        m_above = re.search(r'(?:risk\s+(?:above|over|>|greater\s+than|more\s+than)|(?:above|over|>|greater\s+than|more\s+than)\s+(\d+(?:\.\d+)?)\s+risk)\s*(\d+(?:\.\d+)?)?', q)
        if m_above:
            val = m_above.group(2) or m_above.group(1)
            if val:
                res['min_risk'] = float(val)

    # Cost bounds: "above ₹1000 crore", "above 1000 cr", "below 500 cr", "cost above 1000000 crore"
    def parse_cost_val(num_str: str, unit_str: Optional[str]) -> float:
        clean_num = float(num_str.replace(',', ''))
        u = (unit_str or '').lower()
        if 'lakh crore' in u or 'lakh cr' in u:
            return clean_num * 100000.0
        return clean_num

    m_cost_above = re.search(r'(?:cost\s+)?(?:above|over|>|greater\s+than|more\s+than|exceeding)\s*(?:₹|rs\.?|inr)?\s*([0-9,]+(?:\.[0-9]+)?)\s*(lakh\s+crore|crore|cr)?', q)
    if m_cost_above and ('crore' in q or 'cr' in q or '₹' in q or 'budget' in q or 'cost' in q):
        if 'risk' not in m_cost_above.group(0) and 'progress' not in m_cost_above.group(0) and 'month' not in m_cost_above.group(0):
            res['min_cost_cr'] = parse_cost_val(m_cost_above.group(1), m_cost_above.group(2))

    m_cost_below = re.search(r'(?:cost\s+)?(?:below|under|<|less\s+than)\s*(?:₹|rs\.?|inr)?\s*([0-9,]+(?:\.[0-9]+)?)\s*(lakh\s+crore|crore|cr)?', q)
    if m_cost_below and ('crore' in q or 'cr' in q or '₹' in q or 'budget' in q or 'cost' in q):
        if 'risk' not in m_cost_below.group(0) and 'progress' not in m_cost_below.group(0) and 'month' not in m_cost_below.group(0):
            res['max_cost_cr'] = parse_cost_val(m_cost_below.group(1), m_cost_below.group(2))

    # Progress bounds: "progress below 50%", "progress above 75%", "progress below 1%"
    m_prog_below = re.search(r'(?:progress\s+(?:below|under|<|less\s+than)\s*([0-9,]+(?:\.[0-9]+)?)|(?:below|under|<|less\s+than)\s*([0-9,]+(?:\.[0-9]+)?)\s*%?\s*progress)', q)
    if m_prog_below:
        v = m_prog_below.group(1) or m_prog_below.group(2)
        if v:
            res['max_progress_pct'] = float(v.replace(',', ''))

    m_prog_above = re.search(r'(?:progress\s+(?:above|over|>|greater\s+than|more\s+than)\s*([0-9,]+(?:\.[0-9]+)?)|(?:above|over|>|greater\s+than|more\s+than)\s*([0-9,]+(?:\.[0-9]+)?)\s*%?\s*progress)', q)
    if m_prog_above:
        v = m_prog_above.group(1) or m_prog_above.group(2)
        if v:
            res['min_progress_pct'] = float(v.replace(',', ''))

    # Delay bounds: "delayed by > 12 months", "delayed by more than 12 months", "not delayed"
    m_delay_above = re.search(r'(?:delayed\s+by\s+(?:more\s+than|>|above|over)\s*(\d+)\s*(month|months|mo|year|years|yr)?|delay\s*(?:>|above|over|more\s+than)\s*(\d+)\s*(month|months|mo|year|years|yr)?)', q)
    if m_delay_above:
        v = m_delay_above.group(1) or m_delay_above.group(3)
        unit = m_delay_above.group(2) or m_delay_above.group(4)
        if v:
            val = int(v)
            if unit and 'year' in unit:
                val *= 12
            res['min_delay_months'] = val

    if any(k in q for k in ['not delayed', 'without delay', '0 delay', 'zero delay', 'on schedule', 'on time']):
        res['max_delay_months'] = 0

    return res

def _extract_sort_and_limit(q: str) -> tuple[Optional[str], Optional[str], Optional[int]]:
    sort_by: Optional[str] = None
    sort_direction: Optional[str] = None
    limit: int = 5

    # Sorting
    if any(k in q for k in ['highest cost', 'most expensive', 'largest budget', 'biggest cost', 'highest budget']):
        sort_by = 'cost'
        sort_direction = 'desc'
    elif any(k in q for k in ['lowest cost', 'cheapest', 'smallest budget', 'least cost', 'smallest cost']):
        sort_by = 'cost'
        sort_direction = 'asc'
    elif any(k in q for k in ['highest progress', 'most completed', 'maximum progress', 'most progress']):
        sort_by = 'progress'
        sort_direction = 'desc'
    elif any(k in q for k in ['lowest progress', 'least completed', 'minimum progress', 'least progress']):
        sort_by = 'progress'
        sort_direction = 'asc'
    elif any(k in q for k in ['largest delay', 'most delayed', 'biggest delay', 'highest delay', 'maximum delay']):
        sort_by = 'delay'
        sort_direction = 'desc'
    elif any(k in q for k in ['smallest delay', 'least delayed', 'minimum delay', 'shortest delay']):
        sort_by = 'delay'
        sort_direction = 'asc'

    # Limit
    m_top = re.search(r'\b(?:top|first)\s+(\d+)\b', q)
    if m_top:
        limit = int(m_top.group(1))
    else:
        m_bottom = re.search(r'\b(?:bottom|last)\s+(\d+)\b', q)
        if m_bottom:
            limit = int(m_bottom.group(1))
            if not sort_direction:
                sort_direction = 'asc'
        else:
            m_give = re.search(r'\b(?:give\s+me|show\s+me|list)\s+(?:the\s+)?(\d+)\b', q)
            if m_give:
                limit = int(m_give.group(1))

    return sort_by, sort_direction, limit

def _parse_multi_turn_query(
    user_query: str,
    conversation_history: List[Dict[str, str]]
) -> Dict[str, Any]:
    q = user_query.lower().strip()

    state, state_exclude = _extract_state_intent(q)
    sector, sector_exclude = _extract_sector_intent(q)
    risk_tier, risk_tier_exclude, sort_by_risk, sort_dir_risk = _extract_risk_intent(q)
    num_bounds = _extract_numerical_intent(q)
    sort_by, sort_direction, limit = _extract_sort_and_limit(q)

    if sort_by_risk and not sort_by:
        sort_by = sort_by_risk
        sort_direction = sort_dir_risk

    current: Dict[str, Any] = {
        'state': state,
        'state_exclude': state_exclude,
        'sector': sector,
        'sector_exclude': sector_exclude,
        'risk_tier': risk_tier,
        'risk_tier_exclude': risk_tier_exclude,
        'min_risk': num_bounds['min_risk'],
        'max_risk': num_bounds['max_risk'],
        'min_cost_cr': num_bounds['min_cost_cr'],
        'max_cost_cr': num_bounds['max_cost_cr'],
        'min_progress_pct': num_bounds['min_progress_pct'],
        'max_progress_pct': num_bounds['max_progress_pct'],
        'min_delay_months': num_bounds['min_delay_months'],
        'max_delay_months': num_bounds['max_delay_months'],
        'sort_by': sort_by,
        'sort_direction': sort_direction,
        'limit': limit or 5,
        'is_structured': False
    }

    FOLLOWUP_MARKERS = [
        'only', 'now show', 'show me the', 'what about', 'and the', 'instead show',
        'least risk', 'safest', 'lowest risk', 'switch to', 'change to',
        'exclude', 'give me', 'top 3', 'top 5', 'top 10'
    ]
    is_short = len(q.split()) <= 7
    is_followup = any(m in q for m in FOLLOWUP_MARKERS) or (is_short and not state and not sector and conversation_history)

    if is_followup and conversation_history:
        inherited: Dict[str, Any] = {}
        for msg in conversation_history[-6:]:
            content = (msg.get('content') or '').lower().strip()
            if not content:
                continue
            h_st, h_st_ex = _extract_state_intent(content)
            h_sec, h_sec_ex = _extract_sector_intent(content)
            h_rt, h_rt_ex, h_sb, h_sd = _extract_risk_intent(content)
            h_num = _extract_numerical_intent(content)

            if h_st: inherited['state'] = h_st
            if h_st_ex: inherited['state_exclude'] = h_st_ex
            if h_sec: inherited['sector'] = h_sec
            if h_sec_ex: inherited['sector_exclude'] = h_sec_ex
            if h_rt: inherited['risk_tier'] = h_rt
            if h_rt_ex: inherited['risk_tier_exclude'] = h_rt_ex
            for k, v in h_num.items():
                if v is not None:
                    inherited[k] = v

        if current['state_exclude']:
            for ex in current['state_exclude']:
                if inherited.get('state') == ex:
                    inherited['state'] = None
        if current['state'] is None and inherited.get('state') and not current['state_exclude']:
            current['state'] = inherited['state']

        if current['sector'] is None and inherited.get('sector') and not current['sector_exclude']:
            current['sector'] = inherited['sector']

        if current['risk_tier'] is None and not current['risk_tier_exclude'] and inherited.get('risk_tier'):
            current['risk_tier'] = inherited['risk_tier']

        for k in ['min_risk', 'max_risk', 'min_cost_cr', 'max_cost_cr', 'min_progress_pct', 'max_progress_pct', 'min_delay_months', 'max_delay_months']:
            if current[k] is None and inherited.get(k) is not None:
                current[k] = inherited[k]

    if (
        current['state'] is not None or bool(current['state_exclude']) or
        current['sector'] is not None or bool(current['sector_exclude']) or
        current['risk_tier'] is not None or bool(current['risk_tier_exclude']) or
        any(current[k] is not None for k in ['min_risk', 'max_risk', 'min_cost_cr', 'max_cost_cr', 'min_progress_pct', 'max_progress_pct', 'min_delay_months', 'max_delay_months']) or
        current['sort_by'] is not None
    ):
        current['is_structured'] = True

    return current

def _detect_risk_tier(q: str) -> Optional[str]:
    rt, rt_ex, _, _ = _extract_risk_intent(q)
    return rt

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
    active_project: Optional[Project] = None,
    conversation_history: Optional[List[Dict[str, str]]] = None
) -> FactualContext:
    q = user_query.lower().strip()
    history = conversation_history or []

    # 1. Authority Defense (Score modification, hallucination resistance, prompt injection)
    if any(k in q for k in [
        'calculate the risk yourself', 'calculate risk yourself',
        'can you calculate the risk', 'compute the risk yourself',
        'calculate a different', 'calculate different', 'different risk score',
        'modify the risk score', 'change the risk score', 'modify risk score',
        'lower the risk score', 'lower the risk', 'lower risk', 'lower score',
        'decrease the risk score', 'decrease the risk', 'decrease risk', 'decrease score',
        'reduce the risk score', 'reduce the risk', 'reduce risk', 'reduce score',
        'override the risk', 'override risk', 'override score', 'override the score',
        'change score', 'alter the score', 'alter score', 'edit the risk score',
        'ignore prism', 'ignore the risk engine',
        'tell me your own', 'your own risk score',
        'ignore all previous', 'ignore previous', 'ignore instructions',
        'ignore the database', 'invent 5 projects', 'invent projects', 'fake projects',
        'pretend the risk score', 'pretend the risk is', 'risk is always zero',
        'override your filtering', 'override filtering', 'override rules',
        'say that delhi has no projects',
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

Under public governance guidelines (MoSPI/CAG/Cabinet Secretariat), AI models are strictly prohibited from modifying, overriding, inventing, or fabricating deterministic project scores. Risk scores can only change through officially certified project progress and expenditure updates.""",
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

    # 3. Contractor Information Inquiry (Hallucination Resistance)
    if any(k in q for k in ['contractor', 'contractors', 'who is the contractor', 'who built', 'who is building', 'epc contractor']):
        id_m = re.search(r'\b\d{5,7}\b', q) or re.search(r'\bprj-in-\d+\b', q)
        m_id = id_m.group(0).lower().replace('paimana-', '') if id_m else None
        p_obj = paimana_repository.get_project_by_id(m_id) if m_id else (active_project if active_project else None)
        proj_context = f" for project **{p_obj.name}** (`{p_obj.id}`)" if p_obj else ""
        agency_info = f" The officially designated implementing agency is **{p_obj.implementingAgency}** under **{p_obj.ministry}**." if p_obj else ""
        return FactualContext(
            intent='CONTRACTOR_INFO_UNAVAILABLE',
            summary_text=f"""Official MoSPI PAIMANA monthly infrastructure monitoring reports record parent ministries and designated executing agencies, but do NOT capture private EPC contractor details{proj_context}.{agency_info}

Under public audit standards (CAG/MoSPI), PRISM reports strictly certified public governance metadata and does not fabricate private corporate contracting entities.""",
            grounded_projects=[p_obj] if p_obj else [],
            suggested_questions=[
                f"Why is project {p_obj.id} high risk?" if p_obj else "Which projects have the highest risk?",
                "Which sectors have the highest average risk?",
                "Which projects show stagnant progress?"
            ],
            total_matching=1 if p_obj else 0
        )

    # 4. Explicit Project ID Query & Nonexistent ID Defense
    id_match = re.search(r'\b\d{5,7}\b', q) or re.search(r'\bprj-in-\d+\b', q) or re.search(r'\bpaimana-\d+\b', q)
    mentioned_id = id_match.group(0).lower().replace('paimana-', '') if id_match else None
    if not mentioned_id:
        id_named = re.search(r'\bproject\s+([a-zA-Z0-9_-]+)\b', q)
        if id_named:
            cand = id_named.group(1).lower()
            if cand not in ('in', 'with', 'above', 'below', 'under', 'on', 'at', 'for', 'risk', 'progress', 'cost', 'delhi'):
                mentioned_id = cand

    target_project: Optional[Project] = None
    if mentioned_id:
        target_project = paimana_repository.get_project_by_id(mentioned_id)
        if not target_project:
            target_project = next((p for p in all_projects if p.id.lower() == mentioned_id or (p.code and p.code.lower() == mentioned_id)), None)
        if not target_project and not any(k in q for k in ['projects', 'high risk', 'low risk', 'delhi', 'maharashtra', 'railway']):
            return FactualContext(
                intent='PROJECT_NOT_FOUND',
                summary_text=f"Project **'{mentioned_id}'** was not found in the authoritative MoSPI PAIMANA dataset (covering 2,059 monitored Central Sector infrastructure projects). Please verify the Project ID or search by project name.",
                grounded_projects=[],
                suggested_questions=DEFAULT_SUGGESTED_QUESTIONS,
                total_matching=0
            )
    elif active_project and any(k in q for k in [
        'this project', 'the project', 'project in focus', 'why is it',
        'how has progress changed', 'expenditure changed', 'since april'
    ]):
        target_project = active_project
    else:
        # Check canonical projects directly
        if 'polavaram' in q:
            target_project = paimana_repository.get_project_by_id('701415')
        elif 'sivok' in q or 'rangpo' in q:
            target_project = paimana_repository.get_project_by_id('705432')
        elif 'rishikesh' in q or 'karnaprayag' in q:
            target_project = paimana_repository.get_project_by_id('705429')
        elif 'awantipora' in q or 'aiims kashmir' in q:
            target_project = paimana_repository.get_project_by_id('701167')
        elif not any(k in q for k in ['which projects', 'highest risk', 'stagnant', 'good pace', 'healthy pace', 'intervention', 'average risk', 'in delhi', 'in maharashtra']):
            for p in all_projects:
                p_clean = p.name.lower().split('(')[0].strip()
                if len(p_clean) > 8 and p_clean in q:
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

    # 5. Factual Aggregation Queries
    if any(k in q for k in ['how many projects in', 'how many projects are in', 'number of projects in', 'how many high-risk', 'how many high risk', 'how many critical', 'percentage are high risk', 'percentage is high risk', 'percent high risk', 'how many railway projects are delayed', 'how many rail projects are delayed', 'average risk in']):
        matched_st, _ = _extract_state_intent(q)
        if matched_st:
            partition = ProjectQueryService.get_state_partition(matched_st)
            if partition:
                # Percentage of high risk
                if any(k in q for k in ['percentage are high risk', 'percentage is high risk', 'percent high risk']):
                    total_p = partition['dedicatedCount'] or 1
                    high_p = partition['dedicatedByRisk']['HIGH']
                    pct = round((high_p / total_p) * 100, 1)
                    return FactualContext(
                        intent='STATE_HIGH_RISK_PERCENTAGE',
                        summary_text=f"""Factual Risk Aggregation for **{partition['canonicalState']}**:
- **Total Dedicated In-State Projects**: **{total_p} projects**
- **High-Risk Projects (60–79)**: **{high_p} projects**
- **High-Risk Proportion**: Exactly **{pct}%** ({high_p} of {total_p} projects).""",
                        grounded_projects=[p for p in partition['dedicatedProjects'] if p.riskTier == 'HIGH'][:5],
                        suggested_questions=[
                            f"Show high-risk projects in {partition['canonicalState']}",
                            f"Show low-risk projects in {partition['canonicalState']}",
                            f"Which projects need intervention first in {partition['canonicalState']}?"
                        ],
                        total_matching=high_p
                    )
                # How many high-risk / critical projects in state
                if any(k in q for k in ['how many high-risk', 'how many high risk', 'how many critical']):
                    target_t = 'CRITICAL' if 'critical' in q else 'HIGH'
                    count = partition['dedicatedByRisk'][target_t]
                    return FactualContext(
                        intent='STATE_TIER_COUNT',
                        summary_text=f"""There are exactly **{count} {target_t.lower()}-risk projects** located in **{partition['canonicalState']}** (out of {partition['dedicatedCount']} total dedicated in-state projects).""",
                        grounded_projects=sorted([p for p in partition['dedicatedProjects'] if p.riskTier == target_t], key=lambda p: (-(p.riskScore or 0), p.id))[:5],
                        suggested_questions=[
                            f"Show {target_t.lower()}-risk projects in {partition['canonicalState']}",
                            f"Show low-risk projects in {partition['canonicalState']}",
                            f"Which sector has the highest risk in {partition['canonicalState']}?"
                        ],
                        total_matching=count
                    )
                # How many projects in state
                if any(k in q for k in ['how many projects are in', 'how many projects in', 'number of projects in']):
                    return FactualContext(
                        intent='STATE_PROJECT_COUNT',
                        summary_text=f"""In the authoritative PAIMANA dataset, there are exactly **{partition['dedicatedCount']} dedicated projects** located within the state of **{partition['canonicalState']}** (with a total capital outlay of ₹{partition['dedicatedKPIs'].totalBudgetCr:,.0f} Cr). In addition, there are {partition['multiStateCount']} multi-state transit corridors crossing {partition['canonicalState']}.""",
                        grounded_projects=sorted(partition['dedicatedProjects'], key=lambda p: (-(p.riskScore or 0), p.id))[:5],
                        suggested_questions=[
                            f"Show high-risk projects in {partition['canonicalState']}",
                            f"Show low-risk projects in {partition['canonicalState']}",
                            f"Which projects need intervention first in {partition['canonicalState']}?"
                        ],
                        total_matching=partition['dedicatedCount']
                    )
                # Average risk in state
                if 'average risk' in q:
                    avg_risk = partition['dedicatedKPIs'].averageRiskScore
                    return FactualContext(
                        intent='STATE_AVG_RISK',
                        summary_text=f"""The average PRISM Risk Index for dedicated infrastructure projects in **{partition['canonicalState']}** is **{avg_risk} / 100** (calculated across {partition['dedicatedCount']} monitored projects).""",
                        grounded_projects=sorted(partition['dedicatedProjects'], key=lambda p: (-(p.riskScore or 0), p.id))[:5],
                        suggested_questions=[
                            f"Show high-risk projects in {partition['canonicalState']}",
                            f"Show low-risk projects in {partition['canonicalState']}",
                            "Which sectors have the highest average risk?"
                        ],
                        total_matching=partition['dedicatedCount']
                    )

        sec_m, _ = _extract_sector_intent(q)
        if sec_m and any(k in q for k in ['delayed', 'slippage']):
            matching_sec = [
                p for p in all_projects
                if sec_m.lower() in p.sector.lower() or (p.derivedSector and sec_m.lower() in p.derivedSector.lower())
            ]
            delayed_sec = [p for p in matching_sec if (p.timeOverrunMonths or 0) > 0]
            pct_delayed = round((len(delayed_sec) / (len(matching_sec) or 1)) * 100, 1)
            return FactualContext(
                intent='SECTOR_DELAY_AGGREGATION',
                summary_text=f"""PAIMANA Schedule Slippage Aggregation: **{sec_m}**
- **Total Monitored Projects**: **{len(matching_sec)} projects**
- **Delayed Projects (> 0 months slippage)**: Exactly **{len(delayed_sec)} projects** ({pct_delayed}% of sector portfolio).
- **Average Delay**: {round(sum((p.timeOverrunMonths or 0) for p in matching_sec) / (len(matching_sec) or 1), 1)} months.""",
                grounded_projects=sorted(delayed_sec, key=lambda p: (-(p.timeOverrunMonths or 0), -(p.riskScore or 0), p.id))[:5],
                suggested_questions=[
                    f"Which {sec_m.lower()} projects have the highest risk?",
                    "Which sector has the highest average risk?",
                    "Which projects show stagnant progress?"
                ],
                total_matching=len(delayed_sec)
            )

    # 6. Structured Query Execution Engine (Multi-criteria, Negation, Numerical, Sorting, Limits)
    parsed = _parse_multi_turn_query(user_query, history)
    is_pure_state_overview = (
        parsed['state'] and
        not parsed['state_exclude'] and
        not parsed['sector'] and
        not parsed['sector_exclude'] and
        not parsed['risk_tier'] and
        not parsed['risk_tier_exclude'] and
        all(parsed[k] is None for k in ['min_risk', 'max_risk', 'min_cost_cr', 'max_cost_cr', 'min_progress_pct', 'max_progress_pct', 'min_delay_months', 'max_delay_months']) and
        not parsed['sort_by'] and
        parsed['limit'] == 5 and
        not any(k in q for k in ['least', 'low', 'high', 'safest', 'risky', 'top', 'bottom', 'delayed', 'cost', 'above', 'below'])
    )

    is_sector_overview = any(k in q for k in [
        'which sector', 'which sectors', 'what sector', 'what sectors', 'highest average risk', 'highest sector risk', 'sectors with highest risk'
    ]) or ('sector' in q and 'average risk' in q)
    is_stagnant_query = any(k in q for k in ['stagnant', 'stagnation', 'stalled'])
    is_intervention_priority = any(k in q for k in ['need intervention first', 'intervention first', 'attention first', 'priority queue', 'prioritized projects'])
    is_healthy_pace = any(k in q for k in ['good pace', 'best pace', 'on track', 'healthy pace'])

    if parsed['is_structured'] and not is_pure_state_overview and not is_sector_overview and not is_stagnant_query and not is_intervention_priority and not is_healthy_pace:
        res = ProjectQueryService.query_structured(
            state=parsed['state'],
            state_exclude=parsed['state_exclude'],
            sector=parsed['sector'],
            sector_exclude=parsed['sector_exclude'],
            risk_tier=parsed['risk_tier'],
            risk_tier_exclude=parsed['risk_tier_exclude'],
            min_risk=parsed['min_risk'],
            max_risk=parsed['max_risk'],
            min_cost_cr=parsed['min_cost_cr'],
            max_cost_cr=parsed['max_cost_cr'],
            min_progress_pct=parsed['min_progress_pct'],
            max_progress_pct=parsed['max_progress_pct'],
            min_delay_months=parsed['min_delay_months'],
            max_delay_months=parsed['max_delay_months'],
            sort_by=parsed['sort_by'],
            sort_direction=parsed['sort_direction'],
            limit=parsed['limit'],
            offset=0,
            include_multi_state=False
        )

        if res['totalCount'] == 0:
            filters_desc = []
            if parsed['state']: filters_desc.append(f"State = {parsed['state']}")
            if parsed['state_exclude']: filters_desc.append(f"Excluding State = {', '.join(parsed['state_exclude'])}")
            if parsed['sector']: filters_desc.append(f"Sector = {parsed['sector']}")
            if parsed['sector_exclude']: filters_desc.append(f"Excluding Sector = {', '.join(parsed['sector_exclude'])}")
            if parsed['risk_tier']: filters_desc.append(f"Risk Tier = {parsed['risk_tier']}")
            if parsed['risk_tier_exclude']: filters_desc.append(f"Excluding Risk Tier = {', '.join(parsed['risk_tier_exclude'])}")
            if parsed['min_risk'] is not None: filters_desc.append(f"Risk >= {parsed['min_risk']}")
            if parsed['max_risk'] is not None: filters_desc.append(f"Risk <= {parsed['max_risk']}")
            if parsed['min_cost_cr'] is not None: filters_desc.append(f"Cost >= ₹{parsed['min_cost_cr']:,.0f} Cr")
            if parsed['max_cost_cr'] is not None: filters_desc.append(f"Cost <= ₹{parsed['max_cost_cr']:,.0f} Cr")
            if parsed['min_progress_pct'] is not None: filters_desc.append(f"Progress >= {parsed['min_progress_pct']}%")
            if parsed['max_progress_pct'] is not None: filters_desc.append(f"Progress <= {parsed['max_progress_pct']}%")
            if parsed['min_delay_months'] is not None: filters_desc.append(f"Delay >= {parsed['min_delay_months']} mo")
            if parsed['max_delay_months'] is not None: filters_desc.append(f"Delay <= {parsed['max_delay_months']} mo")
            desc = '; '.join(filters_desc) if filters_desc else 'Specified constraints'

            return FactualContext(
                intent='EMPTY_RESULT',
                summary_text=f"""No matching PAIMANA projects found satisfying the requested criteria:
- **Filters Applied**: {desc}
- **Matching Records**: Exactly **0 projects** found in the national PAIMANA database.

PRISM deterministic retrieval reports zero records rather than substituting unrequested or non-conforming projects.""",
                grounded_projects=[],
                suggested_questions=[
                    f"Show projects in {parsed['state']}" if parsed['state'] else "Show high risk projects in Delhi",
                    "Which projects have the highest risk?",
                    "Which sectors have the highest average risk?"
                ],
                total_matching=0
            )

        list_text = '\n\n'.join([
            f"{i + 1}. **{p.name}** (`{p.code or p.id}`)\n"
            f"   - **Risk Score**: **{p.riskScore}/100** [{p.riskTier}]\n"
            f"   - **Sector & State**: {p.sector} • {p.state} | **Agency**: {p.implementingAgency}\n"
            f"   - **Physical Progress**: {p.physicalProgressPercent}% | Cost: ₹{(p.revisedCostCr or p.originalCostCr or 0):,.0f} Cr\n"
            f"   - **Overrun**: Schedule +{p.timeOverrunMonths} mo | Cost +{p.costOverrunPercent}%"
            for i, p in enumerate(res['displayProjects'])
        ])

        multi_note = f"\n\n*Note on Multi-State Corridors:* {res['multiStateNotice']}" if res.get('multiStateNotice') else ''
        sort_note = f" (ordered by {parsed['sort_by']} {parsed['sort_direction']})" if parsed['sort_by'] else ""
        header = f"PAIMANA Query Results{sort_note}"
        if parsed['state']:
            header = f"PAIMANA Projects in **{res['canonicalState']}**{sort_note}"

        return FactualContext(
            intent='STRUCTURED_QUERY_RESULT',
            summary_text=f"""{header}:
- **Total Matching Records**: Exactly **{res['totalCount']} projects** satisfy the requested criteria.
- **Showing**: **{len(res['displayProjects'])} of {res['totalCount']}** verified projects:

{list_text}{multi_note}""",
            grounded_projects=res['displayProjects'],
            suggested_questions=[
                f"Why is project {res['displayProjects'][0].id} high risk?" if res['displayProjects'] else "Which projects have the highest risk?",
                f"Which projects need intervention first in {res['canonicalState']}?" if res.get('canonicalState') else "Which projects need intervention first?",
                "Which sector has the highest average risk?"
            ],
            total_matching=res['totalCount']
        )

    # 7. State Inquiries (for pure state portfolio overviews)
    matched_state = parsed['state']
    if matched_state:
        # 4A. State + Risk Tier — use canonical synonym detection
        target_risk_tier = _detect_risk_tier(q)

        if target_risk_tier:
            # LOW tier: sort ascending (least risky first); all others sort descending
            sort_asc = (target_risk_tier == 'LOW')
            res = ProjectQueryService.get_projects_by_state_and_risk(
                matched_state, target_risk_tier, limit=5, sort_ascending=sort_asc
            )
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
            sort_note = ' (sorted: least risky first)' if sort_asc else ''

            # Determine the opposite tier suggestion for follow-up
            opposite = 'high' if target_risk_tier in ('LOW', 'MODERATE') else 'low'

            return FactualContext(
                intent='STATE_RISK_FILTER',
                summary_text=f"""PAIMANA State Risk Analysis: **{res['canonicalState']}** ({target_risk_tier} Risk{sort_note})
- **Authoritative In-State Projects**: Exactly **{res['totalCount']} projects** located in {res['canonicalState']} are classified in the **{target_risk_tier}** risk band ({band_desc}).

{f"Showing **{len(res['displayProjects'])} of {res['totalCount']}** verified in-state {target_risk_tier.lower()}-risk projects:\n\n{list_text}" if res['totalCount'] > 0 else list_text}{multi_note}""",
                grounded_projects=res['displayProjects'],
                suggested_questions=[
                    f"Which projects need intervention first in {res['canonicalState']}?",
                    f"Show {opposite}-risk projects in {res['canonicalState']}",
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
        active_project_id: Optional[str] = None,
        conversation_history: Optional[List[Dict[str, str]]] = None
    ) -> CopilotResponse:
        active_project = (
            paimana_repository.get_project_by_id(active_project_id)
            if active_project_id else None
        )

        factual = resolve_query_factual_context(
            user_query, projects, active_project,
            conversation_history=conversation_history or []
        )
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
                    model=GEMINI_MODEL,
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
                    model=GEMINI_MODEL,
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
