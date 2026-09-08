from typing import Optional, List, Dict, Any
from backend.models.project import Project, PortfolioKPIs
from backend.models.common import RiskTier, PriorityTier
from backend.repositories.paimana_repository import paimana_repository

class ProjectQueryService:
    """
    PRISM Canonical Project Query Service.
    Single Source of Truth for querying, filtering, ranking, and aggregating projects
    across Dashboard, Table, Analytics, and AI Copilot.
    """
    @classmethod
    def query(
        cls,
        search: Optional[str] = None,
        state: Optional[str] = None,
        agency: Optional[str] = None,
        sector: Optional[str] = None,
        risk_tier: Optional[str] = None,
        priority_tier: Optional[str] = None,
        sort_by: Optional[str] = None,
        sort_direction: Optional[str] = None,
        limit: Optional[int] = None,
        offset: Optional[int] = None
    ) -> Dict[str, Any]:
        default_sort_by = sort_by or (
            'riskScore' if risk_tier and risk_tier != 'ALL'
            else ('priorityScore' if priority_tier and priority_tier != 'ALL' else 'id')
        )
        default_sort_dir = sort_direction or (
            'desc' if default_sort_by in ('riskScore', 'priorityScore') else 'asc'
        )

        res = paimana_repository.list_projects(
            search=search,
            state=state,
            agency=agency,
            sector=sector,
            risk_tier=risk_tier,
            priority_tier=priority_tier,
            sort_by=default_sort_by,
            sort_direction=default_sort_dir,
            limit=limit,
            offset=offset
        )

        # Compute KPIs on the complete matching dataset, NEVER on paginated slice
        kpis = paimana_repository.compute_kpis(res['allMatching'])

        return {
            'projects': [p.model_dump() for p in res['projects']],
            'allMatching': res['allMatching'],
            'totalCount': res['totalCount'],
            'kpis': kpis.model_dump()
        }

    @classmethod
    def get_state_partition(cls, state_name: str) -> Optional[Dict[str, Any]]:
        s = state_name.strip().lower()
        all_projects = paimana_repository.list_projects()['allMatching']

        # Find canonical state name
        exact_match = next((p for p in all_projects if p.state.strip().lower() == s), None)
        canonical_state = exact_match.state.strip() if exact_match else state_name.strip()

        dedicated = [p for p in all_projects if p.state.strip().lower() == s]
        multi_state = [
            p for p in all_projects
            if p.state.strip().lower() != s and s in p.state.lower()
        ]

        if not dedicated and not multi_state:
            return None

        all_associated = dedicated + multi_state

        def init_counts() -> Dict[str, int]:
            return {'CRITICAL': 0, 'HIGH': 0, 'MODERATE': 0, 'LOW': 0, 'UNRATED': 0}

        dedicated_by_risk = init_counts()
        for p in dedicated:
            t = p.riskTier or 'UNRATED'
            dedicated_by_risk[t] = dedicated_by_risk.get(t, 0) + 1

        multi_by_risk = init_counts()
        for p in multi_state:
            t = p.riskTier or 'UNRATED'
            multi_by_risk[t] = multi_by_risk.get(t, 0) + 1

        total_by_risk = init_counts()
        for p in all_associated:
            t = p.riskTier or 'UNRATED'
            total_by_risk[t] = total_by_risk.get(t, 0) + 1

        return {
            'canonicalState': canonical_state,
            'dedicatedProjects': dedicated,
            'multiStateProjects': multi_state,
            'allAssociatedProjects': all_associated,
            'dedicatedCount': len(dedicated),
            'multiStateCount': len(multi_state),
            'totalAssociatedCount': len(all_associated),
            'dedicatedKPIs': paimana_repository.compute_kpis(dedicated),
            'allAssociatedKPIs': paimana_repository.compute_kpis(all_associated),
            'dedicatedByRisk': dedicated_by_risk,
            'multiStateByRisk': multi_by_risk,
            'totalByRisk': total_by_risk
        }

    @classmethod
    def get_projects_by_state_and_risk(
        cls,
        state_name: str,
        risk_tier: str,
        limit: int = 5,
        include_multi_state: bool = False
    ) -> Dict[str, Any]:
        partition = cls.get_state_partition(state_name)
        target_tier = risk_tier.upper()

        if not partition:
            return {
                'canonicalState': state_name,
                'riskTier': target_tier,
                'dedicatedProjects': [],
                'multiStateProjects': [],
                'totalCount': 0,
                'matchingProjects': [],
                'displayProjects': [],
                'multiStateNotice': None
            }

        # Sort deterministically: riskScore DESC, id ASC
        def sort_fn(p: Project):
            return (-(p.riskScore if p.riskScore is not None else -1), p.id)

        dedicated_matching = sorted(
            [p for p in partition['dedicatedProjects'] if p.riskTier == target_tier],
            key=sort_fn
        )
        multi_matching = sorted(
            [p for p in partition['multiStateProjects'] if p.riskTier == target_tier],
            key=sort_fn
        )

        canonical_matching = (
            sorted(dedicated_matching + multi_matching, key=sort_fn)
            if include_multi_state else dedicated_matching
        )

        display_projects = canonical_matching[:limit]

        multi_state_notice: Optional[str] = None
        if not include_multi_state and multi_matching:
            corridor_names = ', '.join(f"{p.name.split('(')[0].strip()} [{p.id}]" for p in multi_matching)
            multi_state_notice = (
                f"There are also {len(multi_matching)} multi-state project(s) involving "
                f"{partition['canonicalState']} with {target_tier} risk ({corridor_names})."
            )

        return {
            'canonicalState': partition['canonicalState'],
            'riskTier': target_tier,
            'dedicatedProjects': dedicated_matching,
            'multiStateProjects': multi_matching,
            'totalCount': len(dedicated_matching),
            'matchingProjects': canonical_matching,
            'displayProjects': display_projects,
            'multiStateNotice': multi_state_notice
        }

    @classmethod
    def get_priority_projects(
        cls,
        state: Optional[str] = None,
        sector: Optional[str] = None,
        priority_tier: Optional[str] = None,
        limit: int = 5
    ) -> Dict[str, Any]:
        proj_list = paimana_repository.list_projects()['allMatching']

        if state and state != 'ALL':
            s = state.strip().lower()
            proj_list = [p for p in proj_list if p.state.lower() == s]

        if sector and sector != 'ALL':
            sec = sector.strip().lower()
            proj_list = [
                p for p in proj_list
                if p.sector.lower() == sec or (p.derivedSector or '').lower() == sec
            ]

        if priority_tier and priority_tier != 'ALL':
            pt = priority_tier.strip().upper()
            proj_list = [p for p in proj_list if p.priorityTier == pt]

        # Deterministic sort: priorityScore DESC, riskScore DESC, id ASC
        proj_list.sort(
            key=lambda p: (
                -(p.priorityScore if p.priorityScore is not None else -1),
                -(p.riskScore if p.riskScore is not None else -1),
                p.id
            )
        )

        p1_count = sum(1 for p in proj_list if p.priorityTier == 'P1')
        p2_count = sum(1 for p in proj_list if p.priorityTier == 'P2')
        p3_count = sum(1 for p in proj_list if p.priorityTier == 'P3')

        return {
            'projects': proj_list[:limit],
            'totalMatching': len(proj_list),
            'p1Count': p1_count,
            'p2Count': p2_count,
            'p3Count': p3_count
        }

    @classmethod
    def get_top_risk_projects(
        cls,
        state: Optional[str] = None,
        sector: Optional[str] = None,
        limit: int = 5
    ) -> Dict[str, Any]:
        proj_list = [p for p in paimana_repository.list_projects()['allMatching'] if p.riskScore is not None]

        if state and state != 'ALL':
            s = state.strip().lower()
            proj_list = [p for p in proj_list if p.state.lower() == s]

        if sector and sector != 'ALL':
            sec = sector.strip().lower()
            proj_list = [
                p for p in proj_list
                if p.sector.lower() == sec or (p.derivedSector or '').lower() == sec
            ]

        total_critical = sum(1 for p in proj_list if p.riskTier == 'CRITICAL')
        total_high = sum(1 for p in proj_list if p.riskTier == 'HIGH')

        # Deterministic sort: riskScore DESC, id ASC
        proj_list.sort(key=lambda p: (-(p.riskScore or 0), p.id))

        return {
            'projects': proj_list[:limit],
            'totalCritical': total_critical,
            'totalHigh': total_high
        }

    @classmethod
    def get_stagnant_projects(
        cls,
        state: Optional[str] = None,
        sector: Optional[str] = None,
        limit: int = 5
    ) -> Dict[str, Any]:
        proj_list = paimana_repository.list_projects()['allMatching']

        if state and state != 'ALL':
            s = state.strip().lower()
            proj_list = [p for p in proj_list if p.state.lower() == s]

        if sector and sector != 'ALL':
            sec = sector.strip().lower()
            proj_list = [
                p for p in proj_list
                if p.sector.lower() == sec or (p.derivedSector or '').lower() == sec
            ]

        stagnant = []
        for p in proj_list:
            has_stagnant_driver = (
                (p.primaryRiskDriver and 'stagnat' in p.primaryRiskDriver.lower()) or
                (p.topRiskDrivers and any('stagnat' in d.label.lower() for d in p.topRiskDrivers))
            )
            has_stagnant_alert = (p.alert and p.alert.alertType == 'Progress Stagnation')
            if has_stagnant_driver or has_stagnant_alert:
                stagnant.append(p)

        # Deterministic sort: riskScore DESC, id ASC
        stagnant.sort(key=lambda p: (-(p.riskScore if p.riskScore is not None else -1), p.id))

        return {
            'projects': stagnant[:limit],
            'totalStagnant': len(stagnant)
        }

    @classmethod
    def get_healthy_pace_projects(
        cls,
        state: Optional[str] = None,
        sector: Optional[str] = None,
        limit: int = 5
    ) -> Dict[str, Any]:
        proj_list = paimana_repository.list_projects()['allMatching']

        if state and state != 'ALL':
            s = state.strip().lower()
            proj_list = [p for p in proj_list if p.state.lower() == s]

        if sector and sector != 'ALL':
            sec = sector.strip().lower()
            proj_list = [
                p for p in proj_list
                if p.sector.lower() == sec or (p.derivedSector or '').lower() == sec
            ]

        pristine = [
            p for p in proj_list
            if p.riskTier == 'LOW' and
               (p.timeOverrunMonths or 0) <= 0 and
               (p.costOverrunPercent or 0.0) <= 0.0 and
               (p.physicalProgressPercent or 0.0) > 0.0
        ]

        # Deterministic sort: physicalProgressPercent DESC, lowest riskScore ASC, id ASC
        pristine.sort(
            key=lambda p: (
                -(p.physicalProgressPercent or 0.0),
                (p.riskScore if p.riskScore is not None else 999),
                p.id
            )
        )

        return {
            'projects': pristine[:limit],
            'totalHealthy': len(pristine),
            'qualificationNote': 'Healthy pace qualification requires: PRISM Risk Tier LOW (0–39), 0 months schedule slippage, 0% cost overrun, and positive verified physical progress.'
        }
