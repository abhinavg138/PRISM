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
    def query_structured(
        cls,
        state: Optional[str] = None,
        state_exclude: Optional[List[str]] = None,
        sector: Optional[str] = None,
        sector_exclude: Optional[List[str]] = None,
        risk_tier: Optional[str] = None,
        risk_tier_exclude: Optional[List[str]] = None,
        priority_tier: Optional[str] = None,
        min_risk: Optional[float] = None,
        max_risk: Optional[float] = None,
        min_cost_cr: Optional[float] = None,
        max_cost_cr: Optional[float] = None,
        min_progress_pct: Optional[float] = None,
        max_progress_pct: Optional[float] = None,
        min_delay_months: Optional[int] = None,
        max_delay_months: Optional[int] = None,
        sort_by: Optional[str] = None,
        sort_direction: Optional[str] = None,
        limit: Optional[int] = 5,
        offset: Optional[int] = 0,
        include_multi_state: bool = False
    ) -> Dict[str, Any]:
        """
        Deterministic, adversarial-hardened structured project retrieval engine.
        Supports multi-criteria combinations, negations, numerical bounds,
        dynamic sorting, and deterministic pagination.
        """
        all_projects = paimana_repository.list_projects()['allMatching']
        canonical_state = None
        multi_state_notice: Optional[str] = None

        # 1. State filtering
        if state:
            s = state.strip().lower()
            if s in ('new delhi', 'delhi ncr', 'nct of delhi'):
                s = 'delhi'
            exact_match = next((p for p in all_projects if p.state.strip().lower() == s), None)
            canonical_state = exact_match.state.strip() if exact_match else state.strip()

            dedicated = [p for p in all_projects if p.state.strip().lower() == s]
            multi_state = [
                p for p in all_projects
                if p.state.strip().lower() != s and s in p.state.lower()
            ]

            pool = (dedicated + multi_state) if include_multi_state else dedicated
        else:
            pool = list(all_projects)

        # 2. State exclusion
        if state_exclude:
            normalized_ex = [
                ('delhi' if ex.strip().lower() in ('new delhi', 'delhi ncr', 'nct of delhi') else ex.strip().lower())
                for ex in state_exclude if ex
            ]
            pool = [p for p in pool if not any(ex in p.state.lower() for ex in normalized_ex)]

        # 3. Sector filtering
        if sector:
            sec = sector.strip().lower()
            pool = [
                p for p in pool
                if sec in p.sector.lower() or (p.derivedSector and sec in p.derivedSector.lower())
            ]

        # 4. Sector exclusion
        if sector_exclude:
            ex_secs = [ex.strip().lower() for ex in sector_exclude if ex]
            pool = [
                p for p in pool
                if not any(
                    ex in p.sector.lower() or (p.derivedSector and ex in p.derivedSector.lower())
                    for ex in ex_secs
                )
            ]

        # 5. Risk Tier filtering
        if risk_tier and risk_tier.upper() != 'ALL':
            rt = risk_tier.strip().upper()
            pool = [p for p in pool if p.riskTier == rt]

        # 6. Risk Tier exclusion
        if risk_tier_exclude:
            ex_tiers = {t.strip().upper() for t in risk_tier_exclude if t}
            pool = [p for p in pool if (p.riskTier or 'UNRATED') not in ex_tiers]

        # 7. Priority Tier filtering
        if priority_tier and priority_tier.upper() != 'ALL':
            pt = priority_tier.strip().upper()
            pool = [p for p in pool if p.priorityTier == pt]

        # 8. Numerical Bounds
        if min_risk is not None:
            pool = [p for p in pool if p.riskScore is not None and p.riskScore >= min_risk]

        if max_risk is not None:
            pool = [p for p in pool if p.riskScore is not None and p.riskScore <= max_risk]

        if min_cost_cr is not None:
            pool = [
                p for p in pool
                if (p.revisedCostCr if p.revisedCostCr is not None else (p.originalCostCr or 0.0)) >= min_cost_cr
            ]

        if max_cost_cr is not None:
            pool = [
                p for p in pool
                if (p.revisedCostCr if p.revisedCostCr is not None else (p.originalCostCr or 0.0)) <= max_cost_cr
            ]

        if min_progress_pct is not None:
            pool = [p for p in pool if (p.physicalProgressPercent or 0.0) >= min_progress_pct]

        if max_progress_pct is not None:
            pool = [p for p in pool if (p.physicalProgressPercent or 0.0) <= max_progress_pct]

        if min_delay_months is not None:
            pool = [p for p in pool if (p.timeOverrunMonths or 0) >= min_delay_months]

        if max_delay_months is not None:
            pool = [p for p in pool if (p.timeOverrunMonths or 0) <= max_delay_months]

        # 9. Deterministic Sorting
        sb = (sort_by or '').lower().strip()
        sd = (sort_direction or '').lower().strip()

        # Sensible defaults based on intent
        if not sb:
            if risk_tier == 'LOW' or (max_risk is not None and min_risk is None):
                sb = 'riskscore'
                if not sd:
                    sd = 'asc'
            else:
                sb = 'riskscore'
                if not sd:
                    sd = 'desc'
        elif not sd:
            sd = 'asc' if ('least' in sb or 'low' in sb or 'safest' in sb) else 'desc'

        if sb in ('riskscore', 'risk'):
            if sd == 'asc':
                sort_key = lambda p: ((p.riskScore if p.riskScore is not None else 999), p.id)
            else:
                sort_key = lambda p: (-(p.riskScore if p.riskScore is not None else -1), p.id)
        elif sb in ('cost', 'costcr', 'budget'):
            if sd == 'asc':
                sort_key = lambda p: ((p.revisedCostCr or p.originalCostCr or 0.0), p.id)
            else:
                sort_key = lambda p: (-((p.revisedCostCr or p.originalCostCr or 0.0)), p.id)
        elif sb in ('progress', 'physicalprogress', 'progresspercent'):
            if sd == 'asc':
                sort_key = lambda p: ((p.physicalProgressPercent or 0.0), p.id)
            else:
                sort_key = lambda p: (-(p.physicalProgressPercent or 0.0), p.id)
        elif sb in ('delay', 'timeoverrun', 'overrun'):
            if sd == 'asc':
                sort_key = lambda p: ((p.timeOverrunMonths or 0), p.id)
            else:
                sort_key = lambda p: (-(p.timeOverrunMonths or 0), p.id)
        elif sb in ('priority', 'priorityscore'):
            if sd == 'asc':
                sort_key = lambda p: ((p.priorityScore or 0), p.id)
            else:
                sort_key = lambda p: (-(p.priorityScore or 0), p.id)
        else:
            sort_key = lambda p: (-(p.riskScore if p.riskScore is not None else -1), p.id)

        pool.sort(key=sort_key)

        # Multi-state notice if dedicated state was isolated
        if state and not include_multi_state and canonical_state:
            s_name = canonical_state.strip().lower()
            matching_multi = [
                p for p in all_projects
                if p.state.strip().lower() != s_name and s_name in p.state.lower()
            ]
            if matching_multi:
                corridors = ', '.join(f"{p.name.split('(')[0].strip()} [{p.id}]" for p in matching_multi[:3])
                multi_state_notice = (
                    f"There are also {len(matching_multi)} multi-state project(s) crossing {canonical_state} ({corridors})."
                )

        off = offset or 0
        display_projects = pool[off:off + limit] if limit is not None else pool[off:]

        return {
            'canonicalState': canonical_state,
            'totalCount': len(pool),
            'matchingProjects': pool,
            'displayProjects': display_projects,
            'multiStateNotice': multi_state_notice,
            'appliedFilters': {
                'state': canonical_state,
                'state_exclude': state_exclude,
                'sector': sector,
                'sector_exclude': sector_exclude,
                'risk_tier': risk_tier,
                'risk_tier_exclude': risk_tier_exclude,
                'min_risk': min_risk,
                'max_risk': max_risk,
                'min_cost_cr': min_cost_cr,
                'max_cost_cr': max_cost_cr,
                'min_progress_pct': min_progress_pct,
                'max_progress_pct': max_progress_pct,
                'min_delay_months': min_delay_months,
                'max_delay_months': max_delay_months,
                'sort_by': sb,
                'sort_direction': sd,
                'limit': limit
            }
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
        include_multi_state: bool = False,
        sort_ascending: bool = False
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

        # Sort deterministically: ascending for LOW tier (least risky first), descending for others
        if sort_ascending:
            def sort_fn(p: Project):
                return ((p.riskScore if p.riskScore is not None else 999), p.id)
        else:
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
