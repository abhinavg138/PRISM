import math
import os
import re
from pathlib import Path
from typing import List, Dict, Optional, Set, Any, Tuple
import pandas as pd
from backend.config import EXCEL_PATH, CSV_PATH
from backend.models.common import RiskTier, PriorityTier
from backend.models.project import (
    Project, PaimanaObservation, LocationGeo, RiskDriver,
    ProgressHistoryPoint, AuditEvent, PortfolioKPIs, SectorStat,
    EarlyWarningAlert
)
from backend.models.risk import RiskAssessment, PriorityAssessment
from backend.services.risk_engine import (
    PRISMRiskEngine, parse_completion_date_to_fractional_year, report_month_to_fractional_year
)
from backend.services.priority_engine import PRISMPriorityEngine
from backend.services.alert_engine import PRISMAlertEngine

MONTH_DISPLAY_MAP: Dict[str, str] = {
    '2026-04': 'Apr 2026',
    '2026-05': 'May 2026',
    '2026-06': 'Jun 2026',
    '2026-07': 'Jul 2026'
}

def derive_sector_from_agency(agency: str = '', project_name: str = '') -> str:
    text = f"{agency} {project_name}".lower()
    if re.search(r'railway|rail|rly|krcl|irctc|rvnl|dfccil', text):
        return 'Railways'
    if re.search(r'road|highway|nhai|morth|pwd|expressway|bridge', text):
        return 'Road Transport & Highways'
    if re.search(r'power|ntpc|powergrid|electricity|energy|dvc|solar|wind|hydro|nhpc|sjvn|neepco', text):
        return 'Power & Energy'
    if re.search(r'petroleum|gas|iocl|ongc|bpcl|hpcl|gail|oil|refinery|pipeline', text):
        return 'Petroleum & Gas'
    if re.search(r'metro|urban|smart city|housing|delhi metro|bangalore metro|maha metro|mmrda|crda', text):
        return 'Urban Affairs & Metro'
    if re.search(r'port|shipping|inland water|sagarmala|maritime|shipyard|dock', text):
        return 'Ports & Shipping'
    if re.search(r'telecom|dot|bharatnet|bsnl|bbnl|broadband|optical fibre', text):
        return 'Telecommunications'
    if re.search(r'coal|cil|mines|mining|ecl|wcl|ccl|bccl|secl|ncl|mcl|singareni', text):
        return 'Coal & Mining'
    if re.search(r'airport|aai|aviation', text):
        return 'Civil Aviation'
    if re.search(r'water|irrigation|dam|narmada|canal', text):
        return 'Water Resources'
    if re.search(r'steel|sail|rinl|metallurg|iron', text):
        return 'Steel & Heavy Industry'
    return 'Other Infrastructure'

def parse_mm_yyyy(date_str: Optional[str]) -> Optional[Tuple[int, int]]:
    if not date_str or not isinstance(date_str, str):
        return None
    parts = date_str.strip().split('/')
    if len(parts) != 2:
        return None
    try:
        m = int(parts[0])
        y = int(parts[1])
        return (m, y)
    except (ValueError, TypeError):
        return None

def calc_month_difference(orig_str: Optional[str], rev_str: Optional[str]) -> int:
    orig = parse_mm_yyyy(orig_str)
    rev = parse_mm_yyyy(rev_str)
    if not orig or not rev:
        return 0
    diff = (rev[1] - orig[1]) * 12 + (rev[0] - orig[0])
    return max(0, diff)

def compute_forward_looking_forecast(
    obs_list: List[PaimanaObservation],
    project: Project
) -> Tuple[Optional[float], Optional[float]]:
    """
    Computes an empirical, forward-looking Earned Schedule and EAC forecast.
    Methodology: Earned Schedule / Earned Value Management (EVM - ISO 21508)
    Grounded strictly on actual observed monthly physical velocity and burn rate.
    """
    if not obs_list:
        return None, None
    latest = obs_list[-1]
    phys = latest.physical_progress_pct or 0.0
    if phys >= 100.0:
        return 0.0, 0.0

    # 1. Earned Progress Velocity (pp/month)
    deltas = []
    if len(obs_list) >= 2:
        for i in range(1, len(obs_list)):
            d = (obs_list[i].physical_progress_pct or 0.0) - (obs_list[i-1].physical_progress_pct or 0.0)
            deltas.append(d)

    avg_velocity = (sum(deltas) / len(deltas)) if deltas else (latest.physical_progress_change_mom_pct_points or 0.0)
    remaining_work = max(0.0, 100.0 - phys)

    # 2. Schedule Forecast
    target_date_str = latest.revised_target_completion_mm_yyyy or latest.original_target_completion_mm_yyyy
    target_year = parse_completion_date_to_fractional_year(target_date_str)
    report_year = report_month_to_fractional_year(latest.report_month or '2026-07')

    if avg_velocity and avg_velocity > 0.1:
        months_to_complete = remaining_work / avg_velocity
        projected_completion_year = report_year + (months_to_complete / 12.0)
        if target_year is not None:
            delay_months = round(max(0.0, (projected_completion_year - target_year) * 12.0), 1)
        else:
            delay_months = round(months_to_complete, 1)
    else:
        current_slip = round(max(0.0, (report_year - target_year) * 12.0), 1) if target_year else 6.0
        delay_months = round(max(current_slip, 6.0) + (remaining_work * 0.2), 1)

    # 3. Cost Escalation Forecast (EAC)
    orig_cost = latest.original_cost_cr or 0.0
    rev_cost = latest.revised_cost_cr or orig_cost
    cum_exp = latest.cumulative_expenditure_cr or 0.0
    base_escalation = max(0.0, rev_cost - orig_cost)

    if phys > 5.0 and cum_exp > 0:
        unit_cost_pct = cum_exp / phys
        projected_final_cost = cum_exp + (remaining_work * unit_cost_pct)
        projected_cost_escalation = round(max(base_escalation, projected_final_cost - orig_cost), 1)
    else:
        projected_cost_escalation = round(base_escalation, 1)

    return delay_months, projected_cost_escalation

class PaimanaRepository:
    """
    Authoritative Repository for loading, indexing, querying, and aggregating
    the official MoSPI PAIMANA dataset (April-July 2026).
    """
    def __init__(self, excel_path: str = EXCEL_PATH, csv_path: str = CSV_PATH):
        self.excel_path = excel_path
        self.csv_path = csv_path
        self.observations: List[PaimanaObservation] = []
        self.projects_map: Dict[str, Project] = {}
        self.project_observations_map: Dict[str, List[PaimanaObservation]] = {}
        self.risk_assessments_map: Dict[str, RiskAssessment] = {}
        self.priority_assessments_map: Dict[str, PriorityAssessment] = {}
        self.alerts_map: Dict[str, EarlyWarningAlert] = {}
        self.alerts_list: List[EarlyWarningAlert] = []
        self.states_set: Set[str] = set()
        self.agencies_set: Set[str] = set()
        self.sectors_set: Set[str] = set()
        self.months_set: Set[str] = set()
        self.is_loaded: bool = False

    def load(self) -> None:
        if self.is_loaded:
            return

        loaded_rows: List[Dict[str, Any]] = []

        # Primary load: Excel workbook
        if os.path.exists(self.excel_path):
            try:
                print(f"[PaimanaRepository] Loading primary dataset from Excel: {self.excel_path}")
                xl = pd.ExcelFile(self.excel_path)
                sheet_name = 'project_snapshots' if 'project_snapshots' in xl.sheet_names else xl.sheet_names[0]
                df = pd.read_excel(xl, sheet_name=sheet_name)
                loaded_rows = df.to_dict(orient='records')
                print(f"[PaimanaRepository] Loaded {len(loaded_rows)} snapshot rows from Excel sheet '{sheet_name}'.")
            except Exception as err:
                print(f"[PaimanaRepository] Failed to read Excel workbook: {err}")

        # Fallback load: CSV
        if not loaded_rows and os.path.exists(self.csv_path):
            try:
                print(f"[PaimanaRepository] Loading dataset from CSV: {self.csv_path}")
                df = pd.read_csv(self.csv_path)
                loaded_rows = df.to_dict(orient='records')
                print(f"[PaimanaRepository] Loaded {len(loaded_rows)} snapshot rows from CSV.")
            except Exception as csv_err:
                print(f"[PaimanaRepository] Error loading CSV data: {csv_err}")

        if not loaded_rows:
            raise RuntimeError(f"[PaimanaRepository] Could not load PAIMANA dataset from {self.excel_path} or {self.csv_path}")

        self.observations = []
        self.months_set.clear()
        self.states_set.clear()
        self.agencies_set.clear()

        def clean_val(val: Any) -> Any:
            if pd.isna(val):
                return None
            return val

        def float_val(val: Any, default: float = 0.0) -> float:
            if pd.isna(val) or val is None:
                return default
            try:
                return float(val)
            except (ValueError, TypeError):
                return default

        for r in loaded_rows:
            orig_cost = float_val(r.get('original_cost_cr'))
            rev_cost = float_val(r.get('revised_cost_cr'), orig_cost)
            cum_exp = float_val(r.get('cumulative_expenditure_cr'))
            phys_prog = float_val(r.get('physical_progress_pct'))

            exp_pct_raw = r.get('expenditure_pct_of_revised_cost')
            if pd.notna(exp_pct_raw) and exp_pct_raw is not None:
                exp_pct = float(exp_pct_raw)
            else:
                exp_pct = round(((cum_exp / rev_cost) * 100.0), 2) if rev_cost > 0 else 0.0

            rep_month = str(clean_val(r.get('report_month')) or '').strip()
            state_str = str(clean_val(r.get('state')) or '').strip()
            agency_str = str(clean_val(r.get('agency')) or '').strip()
            proj_id = str(clean_val(r.get('project_id')) or '').strip()
            proj_name = str(clean_val(r.get('project_name')) or '').strip()

            legacy_code = clean_val(r.get('legacy_ocms_code'))
            pmg_id = clean_val(r.get('pmgid'))

            obs = PaimanaObservation(
                report_month=rep_month,
                report_page=clean_val(r.get('report_page')),
                row_no=clean_val(r.get('row_no')),
                project_id=proj_id,
                project_name=proj_name,
                agency=agency_str,
                legacy_ocms_code=str(legacy_code).strip() if legacy_code is not None else None,
                pmgid=str(pmg_id).strip() if pmg_id is not None else None,
                state=state_str,
                approval_start_mm_yyyy=str(clean_val(r.get('approval_start_mm_yyyy'))).strip() if clean_val(r.get('approval_start_mm_yyyy')) is not None else None,
                revised_start_mm_yyyy=str(clean_val(r.get('revised_start_mm_yyyy'))).strip() if clean_val(r.get('revised_start_mm_yyyy')) is not None else None,
                original_target_completion_mm_yyyy=str(clean_val(r.get('original_target_completion_mm_yyyy'))).strip() if clean_val(r.get('original_target_completion_mm_yyyy')) is not None else None,
                revised_target_completion_mm_yyyy=str(clean_val(r.get('revised_target_completion_mm_yyyy'))).strip() if clean_val(r.get('revised_target_completion_mm_yyyy')) is not None else None,
                original_cost_cr=orig_cost,
                revised_cost_cr=rev_cost,
                cumulative_expenditure_cr=cum_exp,
                physical_progress_pct=phys_prog,
                source=str(clean_val(r.get('source'))) if clean_val(r.get('source')) is not None else None,
                source_file=str(clean_val(r.get('source_file'))) if clean_val(r.get('source_file')) is not None else None,
                expenditure_pct_of_revised_cost=exp_pct,
                cost_revision_pct=float_val(r.get('cost_revision_pct')),
                physical_progress_change_mom_pct_points=float_val(r.get('physical_progress_change_mom_pct_points')),
                expenditure_change_mom_cr=float_val(r.get('expenditure_change_mom_cr')),
                revised_cost_change_mom_cr=float_val(r.get('revised_cost_change_mom_cr')),
                progress_change=float_val(r.get('progress_change')),
                expenditure_change=float_val(r.get('expenditure_change')),
                expenditure_pct=float_val(r.get('expenditure_pct'), exp_pct),
                progress_expenditure_gap=float_val(r.get('progress_expenditure_gap'), (phys_prog - exp_pct))
            )

            if obs.report_month:
                self.months_set.add(obs.report_month)
            if obs.state:
                self.states_set.add(obs.state)
            if obs.agency:
                self.agencies_set.add(obs.agency)

            self.observations.append(obs)

        # Group observations by project_id
        self.project_observations_map.clear()
        for obs in self.observations:
            if not obs.project_id:
                continue
            if obs.project_id not in self.project_observations_map:
                self.project_observations_map[obs.project_id] = []
            self.project_observations_map[obs.project_id].append(obs)

        # Sort observations chronologically by report_month
        for pid, obs_list in self.project_observations_map.items():
            obs_list.sort(key=lambda o: o.report_month)

        # Build Project representations
        self.projects_map.clear()
        self.sectors_set.clear()

        for pid, obs_list in self.project_observations_map.items():
            latest = obs_list[-1]
            derived_sector = derive_sector_from_agency(latest.agency, latest.project_name)
            self.sectors_set.add(derived_sector)

            # S-curve monthly trend points
            monthly_trend = [
                ProgressHistoryPoint(
                    month=MONTH_DISPLAY_MAP.get(o.report_month, o.report_month),
                    reportMonth=o.report_month,
                    plannedPercent=None,
                    actualPercent=o.physical_progress_pct,
                    financialExpenditureCr=o.cumulative_expenditure_cr,
                    expenditurePctOfRevisedCost=o.expenditure_pct_of_revised_cost
                )
                for o in obs_list
            ]

            # Audit trail
            audit_trail = [
                AuditEvent(
                    id=f"aud-{pid}-{o.report_month}",
                    date=o.report_month,
                    event=f"PAIMANA Central Flash Report ({MONTH_DISPLAY_MAP.get(o.report_month, o.report_month)}): Physical progress recorded at {o.physical_progress_pct}%, cumulative spend ₹{o.cumulative_expenditure_cr} Cr.",
                    reportedBy=o.source or 'PAIMANA Central Flash Report',
                    type='milestone'
                )
                for o in obs_list
            ]

            time_overrun_months = calc_month_difference(
                latest.original_target_completion_mm_yyyy,
                latest.revised_target_completion_mm_yyyy
            )

            cost_overrun_percent = (
                max(0.0, round(((latest.revised_cost_cr - latest.original_cost_cr) / latest.original_cost_cr) * 100.0, 1))
                if latest.original_cost_cr > 0 else 0.0
            )

            proj = Project(
                id=pid,
                name=latest.project_name,
                code=latest.legacy_ocms_code or (f"PMG-{latest.pmgid}" if latest.pmgid else f"PAIMANA-{pid}"),
                sector=derived_sector,
                derivedSector=derived_sector,
                ministry=None,
                state=latest.state,
                implementingAgency=latest.agency,
                location=LocationGeo(lat=None, lng=None, city="", state=latest.state),
                originalCostCr=latest.original_cost_cr,
                revisedCostCr=latest.revised_cost_cr,
                cumulativeExpenditureCr=latest.cumulative_expenditure_cr,
                costOverrunPercent=cost_overrun_percent,
                expenditurePctOfRevisedCost=latest.expenditure_pct_of_revised_cost,
                originalStartDate=latest.approval_start_mm_yyyy or "",
                originalCompletionDate=latest.original_target_completion_mm_yyyy or "",
                revisedCompletionDate=latest.revised_target_completion_mm_yyyy or latest.original_target_completion_mm_yyyy or "",
                timeOverrunMonths=time_overrun_months,
                physicalProgressPercent=latest.physical_progress_pct,
                financialProgressPercent=None,
                riskScore=None,
                riskTier='UNRATED',
                predictedDelayMonths=None,
                predictedCostEscalationCr=None,
                confidenceScore=None,
                primaryDelayCause=(
                    f"Completion target revised from {latest.original_target_completion_mm_yyyy} to {latest.revised_target_completion_mm_yyyy} under MoSPI PAIMANA monitoring."
                    if latest.revised_target_completion_mm_yyyy else
                    "Project monitored under MoSPI PAIMANA infrastructure flash reporting."
                ),
                lastUpdated=latest.report_month,
                topRiskDrivers=[],
                mitigationRoadmap=[],
                monthlyTrend=monthly_trend,
                auditTrail=audit_trail,
                dataSource='PAIMANA',
                rawPaimana=latest
            )
            self.projects_map[pid] = proj

        # Compute Risk and Priority Assessments
        rated_count = 0
        self.risk_assessments_map.clear()
        self.priority_assessments_map.clear()

        for pid, obs_list in self.project_observations_map.items():
            try:
                assessment = PRISMRiskEngine.assess(obs_list)
                self.risk_assessments_map[pid] = assessment

                project = self.projects_map.get(pid)
                priority_assessment = PRISMPriorityEngine.assess(obs_list, assessment)
                if project:
                    priority_assessment.sector = project.sector
                    if priority_assessment.evidence:
                        priority_assessment.evidence.timeOverrunMonths = project.timeOverrunMonths
                self.priority_assessments_map[pid] = priority_assessment

                if project:
                    project.riskScore = assessment.riskScore
                    project.riskTier = assessment.riskTier
                    project.priorityScore = priority_assessment.priorityScore
                    project.priorityTier = priority_assessment.priorityTier
                    project.primaryRiskDriver = priority_assessment.primaryRiskDriver
                    project.recommendedAction = priority_assessment.recommendedAction
                    project.priorityReason = priority_assessment.priorityReason
                    project.urgency = priority_assessment.urgency
                    project.evidenceConfidence = priority_assessment.evidenceConfidence

                    # Map top risk drivers
                    sorted_inds = sorted(
                        [ind for ind in assessment.indicators if ind.normalisedScore >= 25],
                        key=lambda ind: ind.weightedContribution,
                        reverse=True
                    )[:5]

                    cat_map = {
                        'Schedule': 'Clearances & Approvals',
                        'Cost': 'Contractor & Cashflow',
                        'Execution': 'Contractor & Cashflow',
                        'Trend': 'Scope & Design'
                    }

                    project.topRiskDrivers = [
                        RiskDriver(
                            id=ind.id,
                            feature=ind.id,
                            label=ind.label,
                            shapValue=round(ind.weightedContribution, 2),
                            description=ind.description,
                            category=cat_map.get(ind.category, 'Coordination'),
                            severity='low' if ind.severity == 'none' else ind.severity
                        )
                        for ind in sorted_inds
                    ]

                    if assessment.primaryConcerns:
                        project.primaryDelayCause = assessment.primaryConcerns[0]

                    delay_pred, cost_pred = compute_forward_looking_forecast(obs_list, project)
                    project.predictedDelayMonths = delay_pred
                    project.predictedCostEscalationCr = cost_pred
                    rated_count += 1
            except Exception as err:
                print(f"[PaimanaRepository] Risk/priority engine failed for project {pid}: {err}")

        # Early Warning Alerts
        self.alerts_map.clear()
        self.alerts_list = PRISMAlertEngine.generate_alerts(
            list(self.projects_map.values()),
            self.project_observations_map
        )
        for alert in self.alerts_list:
            self.alerts_map[alert.projectId] = alert
            proj = self.projects_map.get(alert.projectId)
            if proj:
                proj.alert = alert

        self.is_loaded = True
        print(f"[PaimanaRepository] Successfully initialized {len(self.projects_map)} PAIMANA projects from {len(self.observations)} observations. Risk & Priority assessed: {rated_count}. Early Warning Alerts: {len(self.alerts_list)}.")

    def ensure_loaded(self) -> None:
        if not self.is_loaded:
            self.load()

    def list_projects(
        self,
        search: Optional[str] = None,
        state: Optional[str] = None,
        agency: Optional[str] = None,
        sector: Optional[str] = None,
        risk_tier: Optional[str] = None,
        priority_tier: Optional[str] = None,
        sort_by: str = 'id',
        sort_direction: str = 'asc',
        limit: Optional[int] = None,
        offset: Optional[int] = None
    ) -> Dict[str, Any]:
        self.ensure_loaded()
        proj_list = list(self.projects_map.values())

        # 1. Search Filter
        if search and isinstance(search, str):
            q = search.lower().strip()
            proj_list = [
                p for p in proj_list
                if q in p.name.lower() or
                   q in p.code.lower() or
                   q in p.id.lower() or
                   q in p.implementingAgency.lower() or
                   q in p.state.lower()
            ]

        # 2. State Filter
        if state and state != 'ALL':
            s = state.strip().lower()
            proj_list = [p for p in proj_list if p.state.lower() == s]

        # 3. Agency Filter
        if agency and agency != 'ALL':
            a = agency.strip().lower()
            proj_list = [p for p in proj_list if p.implementingAgency.lower() == a]

        # 4. Sector Filter
        if sector and sector != 'ALL':
            sec = sector.strip().lower()
            proj_list = [
                p for p in proj_list
                if p.sector.lower() == sec or (p.derivedSector or '').lower() == sec
            ]

        # 5. Risk Tier Filter
        if risk_tier and risk_tier != 'ALL':
            rt = risk_tier.strip().upper()
            proj_list = [p for p in proj_list if p.riskTier == rt]

        # 5b. Priority Tier Filter
        if priority_tier and priority_tier != 'ALL':
            pt = priority_tier.strip().upper()
            proj_list = [p for p in proj_list if p.priorityTier == pt]

        # 6. Deterministic Sorting
        is_asc = (sort_direction == 'asc')

        def sort_key(p: Project):
            val = getattr(p, sort_by, None)
            # Handle nulls
            has_val = (val is not None)
            if isinstance(val, str):
                val_comp = val.lower()
            else:
                val_comp = val

            # Primary sort value, secondary id
            return (not has_val if is_asc else has_val, val_comp if has_val else 0, p.id)

        # In python reverse=True for desc
        if not is_asc:
            # Custom sort function for exact Node parity
            def compare_items(a: Project, b: Project) -> int:
                val_a = getattr(a, sort_by, None)
                val_b = getattr(b, sort_by, None)
                if val_a is None and val_b is None:
                    return -1 if a.id < b.id else (1 if a.id > b.id else 0)
                if val_a is None:
                    return 1
                if val_b is None:
                    return -1
                if isinstance(val_a, str):
                    s_a = val_a.lower()
                    s_b = str(val_b).lower()
                    if s_a != s_b:
                        return -1 if s_a > s_b else 1
                else:
                    if val_a != val_b:
                        return -1 if val_a > val_b else 1
                return -1 if a.id < b.id else (1 if a.id > b.id else 0)

            import functools
            proj_list.sort(key=functools.cmp_to_key(compare_items))
        else:
            def compare_items_asc(a: Project, b: Project) -> int:
                val_a = getattr(a, sort_by, None)
                val_b = getattr(b, sort_by, None)
                if val_a is None and val_b is None:
                    return -1 if a.id < b.id else (1 if a.id > b.id else 0)
                if val_a is None:
                    return 1
                if val_b is None:
                    return -1
                if isinstance(val_a, str):
                    s_a = val_a.lower()
                    s_b = str(val_b).lower()
                    if s_a != s_b:
                        return -1 if s_a < s_b else 1
                else:
                    if val_a != val_b:
                        return -1 if val_a < val_b else 1
                return -1 if a.id < b.id else (1 if a.id > b.id else 0)

            import functools
            proj_list.sort(key=functools.cmp_to_key(compare_items_asc))

        total_count = len(proj_list)
        all_matching = proj_list

        paginated_list = proj_list
        if offset is not None or limit is not None:
            off = max(0, offset or 0)
            lim = max(0, limit) if limit is not None else total_count
            paginated_list = proj_list[off: off + lim]

        return {
            'projects': paginated_list,
            'allMatching': all_matching,
            'totalCount': total_count
        }

    def get_project_by_id(self, proj_id: str) -> Optional[Project]:
        self.ensure_loaded()
        return self.projects_map.get(proj_id)

    def get_project_observations(self, proj_id: str) -> List[PaimanaObservation]:
        self.ensure_loaded()
        return self.project_observations_map.get(proj_id, [])

    def get_project_risk_assessment(self, proj_id: str) -> Optional[RiskAssessment]:
        self.ensure_loaded()
        return self.risk_assessments_map.get(proj_id)

    def get_project_priority_assessment(self, proj_id: str) -> Optional[PriorityAssessment]:
        self.ensure_loaded()
        return self.priority_assessments_map.get(proj_id)

    def get_project_benchmark(self, proj_id: str) -> Optional[Dict[str, Any]]:
        """
        Computes comparative peer sector benchmarking for SIH PS 26103.
        Evaluates project's performance, cost escalation, and velocity against sector peers.
        """
        self.ensure_loaded()
        project = self.projects_map.get(proj_id)
        if not project:
            return None

        sector = project.sector
        peers = [p for p in self.projects_map.values() if p.sector == sector]
        if not peers:
            peers = [project]

        peer_count = len(peers)
        avg_risk = round(sum(p.riskScore or 0 for p in peers) / peer_count, 1)
        avg_cost_overrun = round(sum(p.costOverrunPercent or 0.0 for p in peers) / peer_count, 1)
        avg_progress = round(sum(p.physicalProgressPercent or 0.0 for p in peers) / peer_count, 1)

        velocities = []
        for p in peers:
            if p.rawPaimana and p.rawPaimana.physical_progress_change_mom_pct_points is not None:
                velocities.append(p.rawPaimana.physical_progress_change_mom_pct_points)
        avg_velocity = round(sum(velocities) / len(velocities), 2) if velocities else 0.0

        project_risk = project.riskScore or 0
        project_overrun = project.costOverrunPercent or 0.0
        project_progress = project.physicalProgressPercent or 0.0
        project_velocity = (
            project.rawPaimana.physical_progress_change_mom_pct_points
            if project.rawPaimana and project.rawPaimana.physical_progress_change_mom_pct_points is not None
            else 0.0
        )

        lower_risk_peers = sum(1 for p in peers if (p.riskScore or 0) < project_risk)
        percentile_in_sector = round((lower_risk_peers / peer_count) * 100.0, 1)

        risk_tier_distribution = {'CRITICAL': 0, 'HIGH': 0, 'MODERATE': 0, 'LOW': 0}
        for p in peers:
            rt = p.riskTier or 'LOW'
            if rt in risk_tier_distribution:
                risk_tier_distribution[rt] += 1

        risk_delta = round(project_risk - avg_risk, 1)
        cost_overrun_delta = round(project_overrun - avg_cost_overrun, 1)
        velocity_delta = round(project_velocity - avg_velocity, 2)

        if percentile_in_sector >= 75 and cost_overrun_delta > 15:
            verdict = "Significantly underperforming sector benchmark with critical cost and schedule risk"
            performance_tier = "UNDERPERFORMING"
        elif velocity_delta < -1.0 and project_progress < avg_progress:
            verdict = "Progress velocity lagging behind sector peer pace"
            performance_tier = "LAGGING"
        elif project_risk < avg_risk and project_overrun <= avg_cost_overrun:
            verdict = "Outperforming sector peer benchmark across cost and risk stability"
            performance_tier = "OUTPERFORMING"
        else:
            verdict = "Performing within expected sector variance parameters"
            performance_tier = "NORMAL"

        return {
            'projectId': project.id,
            'projectName': project.name,
            'sector': sector,
            'peerCount': peer_count,
            'projectMetrics': {
                'riskScore': project_risk,
                'costOverrunPercent': project_overrun,
                'physicalProgressPercent': project_progress,
                'monthlyVelocityPp': project_velocity,
                'predictedDelayMonths': project.predictedDelayMonths,
                'predictedCostEscalationCr': project.predictedCostEscalationCr
            },
            'sectorBenchmark': {
                'avgRiskScore': avg_risk,
                'avgCostOverrunPercent': avg_cost_overrun,
                'avgPhysicalProgressPercent': avg_progress,
                'avgMonthlyVelocityPp': avg_velocity,
                'riskTierDistribution': risk_tier_distribution
            },
            'deltas': {
                'riskScoreDelta': risk_delta,
                'costOverrunDelta': cost_overrun_delta,
                'velocityDelta': velocity_delta,
                'percentileInSector': percentile_in_sector
            },
            'verdict': verdict,
            'performanceTier': performance_tier
        }

    def get_stats(self) -> Dict[str, Any]:
        self.ensure_loaded()
        projects_with_4_months = sum(1 for obs in self.project_observations_map.values() if len(obs) == 4)
        projects_missing_coordinates = sum(
            1 for p in self.projects_map.values()
            if p.location.lat is None or p.location.lng is None
        )
        projects_unrated = sum(
            1 for p in self.projects_map.values()
            if p.riskTier == 'UNRATED' or p.riskScore is None
        )

        return {
            'totalObservations': len(self.observations),
            'uniqueProjects': len(self.projects_map),
            'projectsWith4Months': projects_with_4_months,
            'projectsMissingCoordinates': projects_missing_coordinates,
            'projectsUnrated': projects_unrated,
            'reportMonths': sorted(list(self.months_set))
        }

    def get_states(self) -> List[str]:
        self.ensure_loaded()
        return sorted([s for s in self.states_set if s])

    def get_agencies(self) -> List[str]:
        self.ensure_loaded()
        return sorted([a for a in self.agencies_set if a])

    def get_sectors(self) -> List[str]:
        self.ensure_loaded()
        return sorted([s for s in self.sectors_set if s])

    def get_sector_stats(self, projects: Optional[List[Project]] = None) -> List[SectorStat]:
        self.ensure_loaded()
        target_projects = projects if projects is not None else list(self.projects_map.values())
        mapping: Dict[str, Dict[str, Any]] = {}

        for p in target_projects:
            sec = p.sector or 'Other Infrastructure'
            if sec not in mapping:
                mapping[sec] = {
                    'totalProjects': 0,
                    'totalProgress': 0.0,
                    'highRiskProjects': 0,
                    'criticalProjects': 0,
                    'totalRisk': 0.0,
                    'ratedCount': 0,
                    'totalBudgetCr': 0.0
                }
            entry = mapping[sec]
            entry['totalProjects'] += 1
            entry['totalProgress'] += (p.physicalProgressPercent or 0.0)
            entry['totalBudgetCr'] += (p.revisedCostCr or 0.0)
            if p.riskTier == 'CRITICAL':
                entry['criticalProjects'] += 1
            if p.riskTier == 'HIGH':
                entry['highRiskProjects'] += 1
            if p.riskScore is not None:
                entry['totalRisk'] += p.riskScore
                entry['ratedCount'] += 1

        result: List[SectorStat] = []
        for sec, stats in mapping.items():
            tot = stats['totalProjects']
            rated = stats['ratedCount']
            result.append(SectorStat(
                sector=sec,
                totalProjects=tot,
                avgPhysicalProgress=round(stats['totalProgress'] / tot, 1) if tot > 0 else 0.0,
                criticalProjects=stats['criticalProjects'],
                highRiskProjects=stats['highRiskProjects'],
                avgRiskScore=round(stats['totalRisk'] / rated, 1) if rated > 0 else 0.0,
                totalBudgetCr=round(stats['totalBudgetCr'])
            ))

        result.sort(key=lambda s: s.totalProjects, reverse=True)
        return result

    def compute_kpis(self, projects: Optional[List[Project]] = None) -> PortfolioKPIs:
        self.ensure_loaded()
        target_projects = projects if projects is not None else list(self.projects_map.values())
        total_projects = len(target_projects)

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

        for p in target_projects:
            rev_cost = p.revisedCostCr or 0.0
            total_budget_cr += rev_cost
            total_delay_months += (p.timeOverrunMonths or 0)
            total_cost_escalation_pct += (p.costOverrunPercent or 0.0)
            total_physical_progress += (p.physicalProgressPercent or 0.0)

            if p.riskScore is not None:
                total_risk_score += p.riskScore
                rated_risk_count += 1

            if p.riskTier == 'CRITICAL':
                critical_projects += 1
                budget_at_risk_cr += rev_cost
            elif p.riskTier == 'HIGH':
                high_risk_projects += 1
                budget_at_risk_cr += rev_cost * 0.65
            elif p.riskTier == 'MODERATE':
                moderate_risk_projects += 1
                budget_at_risk_cr += rev_cost * 0.25
            elif p.riskTier == 'LOW':
                low_risk_projects += 1
                budget_at_risk_cr += rev_cost * 0.05
            else:
                unrated_projects += 1

            if p.priorityTier == 'P1':
                p1_projects += 1
            elif p.priorityTier == 'P2':
                p2_projects += 1
            elif p.priorityTier == 'P3':
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

    def get_full_analytics(self, target_projects: Optional[List[Project]] = None) -> Dict[str, Any]:
        self.ensure_loaded()
        projects = target_projects if target_projects is not None else list(self.projects_map.values())
        total_projects = len(projects)
        kpis = self.compute_kpis(projects)

        # 1. Observations by Month & Longitudinal Coverage
        observations_by_month: Dict[str, int] = {}
        for obs in self.observations:
            if obs.report_month:
                observations_by_month[obs.report_month] = observations_by_month.get(obs.report_month, 0) + 1

        coverage_counts = {'4 Observations': 0, '3 Observations': 0, '2 Observations': 0, '1 Observation': 0}
        for p in projects:
            length = len(p.monthlyTrend or [])
            if length >= 4:
                coverage_counts['4 Observations'] += 1
            elif length == 3:
                coverage_counts['3 Observations'] += 1
            elif length == 2:
                coverage_counts['2 Observations'] += 1
            else:
                coverage_counts['1 Observation'] += 1

        # 2. Risk Distribution
        risk_distribution = [
            {'name': 'Critical (80–100)', 'tier': 'CRITICAL', 'count': kpis.criticalProjects, 'percent': round((kpis.criticalProjects / total_projects) * 100.0, 1) if total_projects > 0 else 0.0, 'color': '#ef4444'},
            {'name': 'High (60–79)', 'tier': 'HIGH', 'count': kpis.highRiskProjects, 'percent': round((kpis.highRiskProjects / total_projects) * 100.0, 1) if total_projects > 0 else 0.0, 'color': '#f97316'},
            {'name': 'Moderate (40–59)', 'tier': 'MODERATE', 'count': kpis.moderateRiskProjects, 'percent': round((kpis.moderateRiskProjects / total_projects) * 100.0, 1) if total_projects > 0 else 0.0, 'color': '#eab308'},
            {'name': 'Low (0–39)', 'tier': 'LOW', 'count': kpis.lowRiskProjects, 'percent': round((kpis.lowRiskProjects / total_projects) * 100.0, 1) if total_projects > 0 else 0.0, 'color': '#10b981'}
        ]

        # 3. Priority Distribution
        p1_cnt = kpis.p1Projects or 0
        p2_cnt = kpis.p2Projects or 0
        p3_cnt = kpis.p3Projects or 0
        priority_distribution = [
            {'name': 'P1 Immediate Urgency (≥70)', 'tier': 'P1', 'count': p1_cnt, 'percent': round((p1_cnt / total_projects) * 100.0, 1) if total_projects > 0 else 0.0, 'color': '#ef4444'},
            {'name': 'P2 Significant Oversight (50–69)', 'tier': 'P2', 'count': p2_cnt, 'percent': round((p2_cnt / total_projects) * 100.0, 1) if total_projects > 0 else 0.0, 'color': '#f97316'},
            {'name': 'P3 Routine Monitoring (<50)', 'tier': 'P3', 'count': p3_cnt, 'percent': round((p3_cnt / total_projects) * 100.0, 1) if total_projects > 0 else 0.0, 'color': '#10b981'}
        ]

        # 4. Sector-Wise Detailed Analytics
        sector_stats = self.get_sector_stats(projects)
        sector_analytics = []
        for s in sector_stats:
            sector_projs = [p for p in projects if p.sector == s.sector]
            orig_cost = sum(p.originalCostCr or 0.0 for p in sector_projs)
            rev_cost = s.totalBudgetCr
            overrun_pct = round(((rev_cost - orig_cost) / orig_cost) * 100.0, 1) if orig_cost > 0 else 0.0
            avg_delay = round(sum(p.timeOverrunMonths or 0 for p in sector_projs) / (len(sector_projs) or 1))

            sector_analytics.append({
                'sector': s.sector,
                'projectCount': s.totalProjects,
                'portfolioPercent': round((s.totalProjects / total_projects) * 100.0, 1) if total_projects > 0 else 0.0,
                'originalCostCr': round(orig_cost),
                'revisedCostCr': rev_cost,
                'costOverrunPercent': overrun_pct,
                'avgPhysicalProgress': s.avgPhysicalProgress,
                'avgRiskScore': s.avgRiskScore,
                'criticalProjects': s.criticalProjects,
                'highRiskProjects': s.highRiskProjects,
                'avgDelayMonths': avg_delay
            })

        # 5. State-Wise Detailed Analytics
        state_map: Dict[str, Dict[str, Any]] = {}
        for p in projects:
            st = p.state or 'Unspecified'
            if st not in state_map:
                state_map[st] = {
                    'count': 0,
                    'totalBudget': 0.0,
                    'totalRisk': 0.0,
                    'ratedCount': 0,
                    'criticalCount': 0,
                    'highCount': 0,
                    'totalProgress': 0.0
                }
            item = state_map[st]
            item['count'] += 1
            item['totalBudget'] += (p.revisedCostCr or 0.0)
            item['totalProgress'] += (p.physicalProgressPercent or 0.0)
            if p.riskTier == 'CRITICAL':
                item['criticalCount'] += 1
            if p.riskTier == 'HIGH':
                item['highCount'] += 1
            if p.riskScore is not None:
                item['totalRisk'] += p.riskScore
                item['ratedCount'] += 1

        state_analytics = [
            {
                'state': st,
                'projectCount': data['count'],
                'totalBudgetCr': round(data['totalBudget']),
                'avgRiskScore': round(data['totalRisk'] / data['ratedCount'], 1) if data['ratedCount'] > 0 else 0.0,
                'criticalCount': data['criticalCount'],
                'highCount': data['highCount'],
                'avgPhysicalProgress': round(data['totalProgress'] / data['count'], 1) if data['count'] > 0 else 0.0
            }
            for st, data in state_map.items()
        ]
        state_analytics.sort(key=lambda x: x['projectCount'], reverse=True)

        # 6. Cost Escalation Brackets
        total_orig = sum(p.originalCostCr or 0.0 for p in projects)
        total_rev = sum(p.revisedCostCr or 0.0 for p in projects)
        overrun_severe = 0
        overrun_mod = 0
        overrun_minor = 0
        overrun_none = 0

        for p in projects:
            over = p.costOverrunPercent or 0.0
            if over >= 50:
                overrun_severe += 1
            elif over >= 20:
                overrun_mod += 1
            elif over > 0:
                overrun_minor += 1
            else:
                overrun_none += 1

        cost_escalation = {
            'totalOriginalCostCr': round(total_orig),
            'totalRevisedCostCr': round(total_rev),
            'totalEscalationCr': round(total_rev - total_orig),
            'overallOverrunPercent': round(((total_rev - total_orig) / total_orig) * 100.0, 1) if total_orig > 0 else 0.0,
            'brackets': [
                {'name': 'Severe (>50%)', 'count': overrun_severe, 'percent': round((overrun_severe / total_projects) * 100.0, 1) if total_projects > 0 else 0.0, 'color': '#ef4444'},
                {'name': 'Moderate (20–50%)', 'count': overrun_mod, 'percent': round((overrun_mod / total_projects) * 100.0, 1) if total_projects > 0 else 0.0, 'color': '#f97316'},
                {'name': 'Minor (1–20%)', 'count': overrun_minor, 'percent': round((overrun_minor / total_projects) * 100.0, 1) if total_projects > 0 else 0.0, 'color': '#eab308'},
                {'name': 'On Budget (0%)', 'count': overrun_none, 'percent': round((overrun_none / total_projects) * 100.0, 1) if total_projects > 0 else 0.0, 'color': '#10b981'}
            ]
        }

        # 7. Execution Indicators
        stagnant_count = 0
        critical_urgency_count = 0
        divergence_count = 0

        for p in projects:
            trend = p.monthlyTrend or []
            if len(trend) >= 2:
                stag = 0
                for i in range(len(trend) - 1, 0, -1):
                    if abs((trend[i].actualPercent or 0.0) - (trend[i - 1].actualPercent or 0.0)) <= 0.2:
                        stag += 1
                    else:
                        break
                if stag >= 2:
                    stagnant_count += 1

            if p.urgency and p.urgency >= 80:
                critical_urgency_count += 1

            exp_pct = p.expenditurePctOfRevisedCost
            if exp_pct is None:
                exp_pct = ((p.cumulativeExpenditureCr or 0.0) / p.revisedCostCr) * 100.0 if (p.revisedCostCr or 0.0) > 0 else 0.0
            if (exp_pct - (p.physicalProgressPercent or 0.0)) >= 15.0:
                divergence_count += 1

        execution_indicators = {
            'prolongedStagnationCount': stagnant_count,
            'stagnationRate': round((stagnant_count / total_projects) * 100.0, 1) if total_projects > 0 else 0.0,
            'divergenceCount': divergence_count,
            'divergenceRate': round((divergence_count / total_projects) * 100.0, 1) if total_projects > 0 else 0.0,
            'criticalUrgencyCount': critical_urgency_count
        }

        return {
            'kpis': kpis.model_dump(),
            'observationsCoverage': {
                'totalObservations': len(self.observations),
                'observationsByMonth': observations_by_month,
                'coverageCounts': coverage_counts
            },
            'riskDistribution': risk_distribution,
            'priorityDistribution': priority_distribution,
            'sectorAnalytics': sector_analytics,
            'stateAnalytics': state_analytics,
            'costEscalation': cost_escalation,
            'executionIndicators': execution_indicators
        }

    def list_priorities(
        self,
        limit: int = 50,
        state: Optional[str] = None,
        agency: Optional[str] = None,
        sector: Optional[str] = None,
        priority_tier: Optional[str] = None
    ) -> Dict[str, Any]:
        self.ensure_loaded()
        prio_list = list(self.priority_assessments_map.values())

        if state and state != 'ALL':
            s = state.strip().lower()
            prio_list = [p for p in prio_list if p.state.lower() == s]
        if agency and agency != 'ALL':
            a = agency.strip().lower()
            prio_list = [p for p in prio_list if p.implementingAgency.lower() == a]
        if sector and sector != 'ALL':
            sec = sector.strip().lower()
            prio_list = [p for p in prio_list if p.sector.lower() == sec]

        p1_count = sum(1 for p in prio_list if p.priorityTier == 'P1')
        p2_count = sum(1 for p in prio_list if p.priorityTier == 'P2')
        p3_count = sum(1 for p in prio_list if p.priorityTier == 'P3')

        filtered = prio_list
        if priority_tier and priority_tier != 'ALL':
            pt = priority_tier.strip().upper()
            filtered = [p for p in filtered if p.priorityTier == pt]

        # Sort priorityScore DESC, riskScore DESC, projectId ASC
        filtered.sort(key=lambda p: (-p.priorityScore, -p.riskScore, p.projectId))

        lim = max(1, limit)
        sliced = filtered[:lim]

        return {
            'priorities': [p.model_dump() for p in sliced],
            'totalCount': len(filtered),
            'p1Count': p1_count,
            'p2Count': p2_count,
            'p3Count': p3_count
        }

    def get_early_warning_alerts(
        self,
        severity: Optional[str] = None,
        alert_type: Optional[str] = None,
        sector: Optional[str] = None,
        state: Optional[str] = None,
        search: Optional[str] = None,
        limit: Optional[int] = None,
        offset: Optional[int] = None
    ) -> Dict[str, Any]:
        self.ensure_loaded()
        filtered = list(self.alerts_list)

        if severity and severity != 'ALL':
            filtered = [a for a in filtered if a.severity == severity]
        if alert_type and alert_type != 'ALL':
            filtered = [a for a in filtered if a.alertType == alert_type]
        if sector and sector != 'ALL':
            filtered = [a for a in filtered if a.sector == sector]
        if state and state != 'ALL':
            filtered = [a for a in filtered if a.state == state]
        if search and isinstance(search, str):
            q = search.lower().strip()
            filtered = [
                a for a in filtered
                if q in a.projectName.lower() or
                   q in a.projectCode.lower() or
                   q in a.evidence.lower() or
                   q in a.state.lower()
            ]

        counts_by_severity = {
            'critical': sum(1 for a in self.alerts_list if a.severity == 'CRITICAL'),
            'high': sum(1 for a in self.alerts_list if a.severity == 'HIGH'),
            'medium': sum(1 for a in self.alerts_list if a.severity == 'MEDIUM'),
            'total': len(self.alerts_list)
        }

        counts_by_type: Dict[str, int] = {}
        for a in self.alerts_list:
            counts_by_type[a.alertType] = counts_by_type.get(a.alertType, 0) + 1

        total_count = len(filtered)
        off = offset or 0
        lim = limit if limit is not None else total_count
        paginated = filtered[off: off + lim]

        return {
            'alerts': [a.model_dump() for a in paginated],
            'totalCount': total_count,
            'countsBySeverity': counts_by_severity,
            'countsByType': counts_by_type
        }

    def get_project_alert(self, proj_id: str) -> Optional[EarlyWarningAlert]:
        self.ensure_loaded()
        return self.alerts_map.get(proj_id)

# Global singleton repository instance
paimana_repository = PaimanaRepository()
