from typing import Optional, List, Dict, Any
from backend.models.project import Project, RiskDriver
from backend.models.common import RiskTier, PriorityTier
from backend.models.risk import RiskAssessment, PriorityAssessment
from backend.models.simulation import (
    SimulationParams, IndicatorChange, AssumptionImpact,
    InterventionBriefData, InterventionLabResult
)

import math

def _sanitize_param(val: Any, min_val: float, max_val: float, default: float = 0.0) -> float:
    if val is None:
        return default
    try:
        f = float(val)
        if math.isnan(f) or math.isinf(f):
            return default
        return max(min_val, min(max_val, f))
    except (ValueError, TypeError):
        return default

class ScenarioEngine:
    """
    Illustrative Policy / What-If Scenario Engine.
    Simulates hypothetical policy interventions (land clearance, liquidity injection,
    geotechnical mitigation, HPC fast-track) on top of PRISM risk indicators.

    DISCLAIMER: Illustrative Policy Scenario — Not an Observed Forecast.
    This scenario engine is NOT an authoritative machine learning risk model.
    Scenario changes exist strictly in the simulation context and NEVER modify
    real PAIMANA project records.
    """
    @classmethod
    def calculate_project_risk(
        cls,
        p: Project,
        sim_params: Optional[SimulationParams] = None
    ) -> Dict[str, Any]:
        if p.riskScore is None:
            return {
                'riskScore': None,
                'riskTier': 'UNRATED',
                'predictedDelayMonths': None,
                'predictedCostEscalationCr': None,
                'confidenceScore': None,
                'shapDrivers': []
            }

        land_boost = _sanitize_param(sim_params.landClearanceAccelerationWeeks if sim_params else 0.0, 0.0, 52.0)
        cash_boost = _sanitize_param(sim_params.contractorLiquidityInjectionPercent if sim_params else 0.0, 0.0, 100.0)
        geo_mitigation = _sanitize_param(sim_params.weatherGeologicalMitigationLevel if sim_params else 0.0, 0.0, 100.0)
        hpc = 1.0 if (sim_params and sim_params.fastTrackHighPowerCommittee) else 0.0

        raw_score = float(p.riskScore)

        # Edge case: 100% completed project
        if (p.physicalProgressPercent or 0.0) >= 100.0:
            return {
                'riskScore': p.riskScore,
                'riskTier': p.riskTier,
                'predictedDelayMonths': 0.0,
                'predictedCostEscalationCr': 0.0,
                'confidenceScore': p.confidenceScore or 1.0,
                'shapDrivers': p.topRiskDrivers or []
            }

        land_deduction = land_boost * 0.75
        cash_deduction = cash_boost * 0.35
        geo_deduction = (geo_mitigation / 100.0) * 8.5
        hpc_deduction = hpc * 5.0

        total_reduction = land_deduction + cash_deduction + geo_deduction + hpc_deduction
        simulated_score = max(10.0, min(98.0, round(raw_score - total_reduction, 1)))

        simulated_tier: RiskTier = 'LOW'
        if simulated_score >= 80.0:
            simulated_tier = 'CRITICAL'
        elif simulated_score >= 60.0:
            simulated_tier = 'HIGH'
        elif simulated_score >= 40.0:
            simulated_tier = 'MODERATE'

        score_ratio = simulated_score / (raw_score or 1.0)
        predicted_delay = (
            max(0.2, round(p.predictedDelayMonths * score_ratio, 1))
            if p.predictedDelayMonths is not None else None
        )
        predicted_cost = (
            max(0.0, round(p.predictedCostEscalationCr * score_ratio))
            if p.predictedCostEscalationCr is not None else None
        )

        updated_drivers: List[RiskDriver] = []
        for driver in (p.topRiskDrivers or []):
            adj_shap = driver.shapValue
            cat = driver.category
            if cat in ('Land Acquisition', 'Clearances & Approvals'):
                adj_shap = round(adj_shap - (land_boost * 0.4 + hpc * 3.0), 1)
            elif cat == 'Contractor & Cashflow':
                adj_shap = round(adj_shap - cash_boost * 0.25, 1)
            elif cat == 'Geological & Weather':
                adj_shap = round(adj_shap - (geo_mitigation / 100.0) * 6.0, 1)

            sev = 'critical' if adj_shap >= 18 else ('high' if adj_shap >= 10 else ('medium' if adj_shap >= 5 else 'low'))
            updated_drivers.append(RiskDriver(
                id=driver.id,
                feature=driver.feature,
                label=driver.label,
                shapValue=adj_shap,
                description=driver.description,
                category=driver.category,
                severity=sev
            ))

        return {
            'riskScore': int(round(simulated_score)),
            'riskTier': simulated_tier,
            'predictedDelayMonths': predicted_delay,
            'predictedCostEscalationCr': predicted_cost,
            'confidenceScore': p.confidenceScore,
            'shapDrivers': updated_drivers
        }

    @classmethod
    def simulate(
        cls,
        p: Project,
        params: SimulationParams,
        assessment: Optional[RiskAssessment] = None,
        priority: Optional[PriorityAssessment] = None
    ) -> InterventionLabResult:
        if p.riskScore is None:
            return InterventionLabResult(
                projectId=p.id,
                originalRiskScore=None,
                originalRiskTier='UNRATED',
                simulatedRiskScore=None,
                simulatedRiskTier='UNRATED',
                riskScoreDelta=None,
                originalPriorityScore=None,
                originalPriorityTier=None,
                simulatedPriorityScore=None,
                simulatedPriorityTier=None,
                priorityScoreDelta=None,
                predictedDelayMonthsOriginal=None,
                predictedDelayMonthsSimulated=None,
                delaySavedMonths=None,
                predictedCostEscalationCrOriginal=None,
                predictedCostEscalationCrSimulated=None,
                costSavedCr=None,
                updatedDrivers=[],
                assumptionImpacts=[],
                indicatorChanges=[],
                actionableInsights=[
                    'Intervention Lab requires a computed PRISM Risk Index (minimum 2 monthly observations). This project is currently UNRATED.'
                ],
                recommendedIntervention='Insufficient longitudinal history for parametric simulation. Continue periodic PAIMANA data collection.',
                officerBrief=InterventionBriefData(
                    projectName=p.name,
                    projectId=p.id,
                    sector=p.derivedSector or p.sector,
                    state=p.state,
                    agency=p.ministry or p.implementingAgency,
                    currentRisk={'score': None, 'tier': 'UNRATED'},
                    currentPriority={'score': None, 'tier': None},
                    simulatedRisk={'score': None, 'tier': 'UNRATED'},
                    simulatedPriority={'score': None, 'tier': None},
                    evidenceSummary='Insufficient observation coverage in current snapshot window.',
                    primaryConcern='Missing longitudinal data points prevents deterministic risk decomposition.',
                    recommendedAction='Mandate submission of monthly PAIMANA progress and expenditure records.',
                    scenarioAssumptions=[],
                    indicatorChanges=[],
                    provenance='MoSPI PAIMANA repository.',
                    disclaimer='Illustrative Policy Scenario — Not an Observed Forecast.'
                )
            )

        original_score = p.riskScore
        original_tier = p.riskTier
        original_delay = (
            p.predictedDelayMonths
            if p.predictedDelayMonths is not None else
            (round(p.timeOverrunMonths * 0.4, 1) if p.timeOverrunMonths is not None else 0.0)
        )
        original_cost = (
            p.predictedCostEscalationCr
            if p.predictedCostEscalationCr is not None else
            (round((p.revisedCostCr - p.originalCostCr) * 0.3) if p.costOverrunPercent > 0 else 0.0)
        )

        land_boost = _sanitize_param(params.landClearanceAccelerationWeeks if params else 0.0, 0.0, 52.0)
        cash_boost = _sanitize_param(params.contractorLiquidityInjectionPercent if params else 0.0, 0.0, 100.0)
        geo_mitigation = _sanitize_param(params.weatherGeologicalMitigationLevel if params else 0.0, 0.0, 100.0)
        hpc = 1.0 if (params and params.fastTrackHighPowerCommittee) else 0.0

        is_completed = (p.physicalProgressPercent or 0.0) >= 100.0

        result = (
            {
                'riskScore': original_score,
                'riskTier': original_tier,
                'predictedDelayMonths': 0.0,
                'predictedCostEscalationCr': 0.0,
                'confidenceScore': p.confidenceScore or 1.0,
                'shapDrivers': p.topRiskDrivers or []
            }
            if is_completed else
            cls.calculate_project_risk(p, params)
        )

        simulated_score = result['riskScore']
        simulated_tier = result['riskTier']
        risk_score_delta = round(float(simulated_score - original_score), 1)

        delay_saved = (
            max(0.0, round(original_delay - result['predictedDelayMonths'], 1))
            if result['predictedDelayMonths'] is not None else 0.0
        )
        cost_saved = (
            max(0.0, round(original_cost - result['predictedCostEscalationCr']))
            if result['predictedCostEscalationCr'] is not None else 0.0
        )

        original_priority_score = (
            p.priorityScore
            if p.priorityScore is not None else
            (priority.priorityScore if priority else min(100, round(original_score * 0.95 + 12)))
        )
        original_priority_tier = (
            p.priorityTier
            if p.priorityTier is not None else
            (priority.priorityTier if priority else ('P1' if original_priority_score >= 70 else ('P2' if original_priority_score >= 50 else 'P3')))
        )

        simulated_priority_score = original_priority_score
        simulated_priority_tier = original_priority_tier
        priority_score_delta = 0

        if not is_completed and risk_score_delta < 0:
            p_drop = round(abs(risk_score_delta) * 0.85)
            simulated_priority_score = max(10, min(100, original_priority_score - p_drop))
            simulated_priority_tier = 'P1' if simulated_priority_score >= 70 else ('P2' if simulated_priority_score >= 50 else 'P3')
            priority_score_delta = simulated_priority_score - original_priority_score

        raw_indicators = (
            [ind.model_dump() for ind in assessment.indicators]
            if assessment else
            [
                {'id': 'velocity', 'label': 'Progress Velocity', 'weight': 25, 'normalisedScore': round(min(100, max(0, (100 - (p.physicalProgressPercent or 0.0)) * 0.75))), 'weightedContribution': 0.0},
                {'id': 'stagnation', 'label': 'Progress Stagnation', 'weight': 20, 'normalisedScore': 85 if (p.alert and p.alert.alertType == 'Progress Stagnation') else (75 if original_score >= 75 else 30), 'weightedContribution': 0.0},
                {'id': 'schedule_pressure', 'label': 'Schedule Pressure', 'weight': 20, 'normalisedScore': min(100, max(10, round((p.timeOverrunMonths or 0) * 2.2))), 'weightedContribution': 0.0},
                {'id': 'cost_escalation', 'label': 'Cost Escalation', 'weight': 15, 'normalisedScore': min(100, max(0, round((p.costOverrunPercent or 0.0) * 1.1))), 'weightedContribution': 0.0},
                {'id': 'divergence', 'label': 'Phys-Financial Divergence', 'weight': 10, 'normalisedScore': min(100, max(0, round(abs((p.expenditurePctOfRevisedCost or 0.0) - (p.physicalProgressPercent or 0.0)) * 1.4))), 'weightedContribution': 0.0},
                {'id': 'deteriorating_trend', 'label': 'Deteriorating Trend', 'weight': 10, 'normalisedScore': 65 if original_score >= 60 else 25, 'weightedContribution': 0.0}
            ]
        )

        indicator_changes: List[IndicatorChange] = []
        for ind in raw_indicators:
            ind_id = ind['id']
            reduction = 0
            driver = 'Baseline monitoring'

            if not is_completed:
                if ind_id == 'velocity':
                    reduction = round(cash_boost * 1.0 + land_boost * 0.5)
                    if cash_boost > 0 or land_boost > 0:
                        parts = []
                        if cash_boost > 0: parts.append(f"{cash_boost:.0f}% liquidity")
                        if land_boost > 0: parts.append(f"{land_boost:.0f}w land approvals")
                        driver = f"Execution throughput accelerated via {' & '.join(parts)}"
                elif ind_id == 'stagnation':
                    reduction = round(hpc * 16.0 + cash_boost * 0.4 + (geo_mitigation / 100.0) * 8.0)
                    if hpc or cash_boost > 0 or geo_mitigation > 0:
                        parts = []
                        if hpc: parts.append("HPC inter-agency arbitration")
                        if cash_boost: parts.append("working capital support")
                        driver = f"Site stoppage broken by {' & '.join(parts)}"
                elif ind_id in ('schedule_pressure', 'schedule'):
                    reduction = round(land_boost * 1.8 + hpc * 10.0)
                    if land_boost > 0 or hpc:
                        parts = []
                        if land_boost > 0: parts.append(f"{land_boost:.0f}w land clearance")
                        if hpc: parts.append("HPC fast-track")
                        driver = f"Critical path compressed by {' & '.join(parts)}"
                elif ind_id in ('cost_escalation', 'cost'):
                    reduction = round(cash_boost * 0.4 + land_boost * 0.4)
                    if cash_boost > 0 or land_boost > 0:
                        driver = 'Indirect idling claims curbed through schedule acceleration'
                elif ind_id in ('phys_fin_divergence', 'divergence'):
                    reduction = round(cash_boost * 0.8 + (geo_mitigation / 100.0) * 4.0)
                    if cash_boost > 0:
                        driver = 'Contractor mobilization synchronizes physical progress with expenditure burn'
                elif ind_id in ('deteriorating_trend', 'trend'):
                    reduction = round((geo_mitigation / 100.0) * 12.0 + hpc * 8.0)
                    if geo_mitigation > 0 or hpc:
                        driver = 'Downside trend arrested by engineered buffers and high-power monitoring'

            orig_score = ind.get('normalisedScore', 0)
            sim_score = max(0, min(100, orig_score - reduction))
            w = ind.get('weight', 0)
            orig_contrib = round(((orig_score * w) / 100.0), 1)
            sim_contrib = round(((sim_score * w) / 100.0), 1)

            indicator_changes.append(IndicatorChange(
                id=ind_id,
                label=ind['label'],
                weight=w,
                originalScore=orig_score,
                simulatedScore=sim_score,
                scoreDelta=sim_score - orig_score,
                originalContribution=orig_contrib,
                simulatedContribution=sim_contrib,
                assumptionDriver=driver
            ))

        assumption_impacts: List[AssumptionImpact] = []
        if is_completed:
            assumption_impacts.append(AssumptionImpact(
                lever='Project Complete',
                value='100% physical completion',
                pointsReduced=0.0,
                mechanism='Asset is fully constructed; entering commercial operations and commissioning.'
            ))
        else:
            if land_boost > 0:
                assumption_impacts.append(AssumptionImpact(
                    lever='Land Clearance Acceleration',
                    value=f"{land_boost:.0f} weeks expedited",
                    pointsReduced=round(land_boost * 0.75, 1),
                    mechanism='Expedites statutory right-of-way handover and site possession on the critical path.'
                ))
            if cash_boost > 0:
                assumption_impacts.append(AssumptionImpact(
                    lever='Contractor Working Capital Support',
                    value=f"{cash_boost:.0f}% escrow mobilization advance",
                    pointsReduced=round(cash_boost * 0.35, 1),
                    mechanism='Unblocks subcontractor cashflow and material procurement, restoring monthly physical velocity.'
                ))
            if geo_mitigation > 0:
                assumption_impacts.append(AssumptionImpact(
                    lever='Geotechnical & Weather Engineering Buffer',
                    value=f"{geo_mitigation:.0f}% engineering mitigation level",
                    pointsReduced=round((geo_mitigation / 100.0) * 8.5, 1),
                    mechanism='Deploys rock-bolting, slope protection, and heated batching to mitigate seasonal stoppages.'
                ))
            if hpc:
                assumption_impacts.append(AssumptionImpact(
                    lever='Fast-Track High-Power Committee (HPC)',
                    value='Convened at Chief Secretary Level',
                    pointsReduced=5.0,
                    mechanism='Bypasses departmental silos to resolve inter-agency forest, rail, and municipal utility disputes.'
                ))
            if not assumption_impacts:
                assumption_impacts.append(AssumptionImpact(
                    lever='Status Quo Progression',
                    value='0 policy levers applied',
                    pointsReduced=0.0,
                    mechanism='Baseline observation trajectory continues without intervention interventions.'
                ))

        insights: List[str] = []
        if is_completed:
            insights.append('Project Complete (100% physical completion). Commercial operation / commissioning underway. No remedial intervention required.')
        else:
            if land_boost > 8:
                insights.append(f"Expediting statutory land approvals by {land_boost:.0f} weeks neutralizes prime critical path bottleneck, recovering ~{(land_boost * 0.3):.1f} months.")
            if cash_boost > 15:
                insights.append(f"Releasing {cash_boost:.0f}% escrow working capital advance curbs subcontractor demobilization and material supply disruptions.")
            if geo_mitigation > 40:
                insights.append("Deploying engineered geotechnical rock-bolting and heated batching facilities mitigates seasonal stoppages.")
            if hpc:
                insights.append("Convening the Chief Secretary High-Power Inter-Departmental Committee circumvents multi-agency utility disputes.")
            if not insights:
                insights.append('Standard operating progression without accelerated intervention triggers.')

        if is_completed:
            recommended_intervention = 'Project Complete (100% physical completion). Routine commissioning & asset handover monitoring.'
        elif original_score >= 80:
            recommended_intervention = 'Convene High-Power Committee to expedite land possession and release targeted contractor liquidity.'
        elif original_score >= 60:
            recommended_intervention = 'Deploy contractor working capital support and resolve critical utility right-of-way clearances.'
        elif original_score >= 40:
            recommended_intervention = 'Maintain intensive monthly milestone tracking; verify contractor mobilization.'
        else:
            recommended_intervention = 'Routine monitoring active. Project is operating within expected tolerance bounds.'

        officer_brief = InterventionBriefData(
            projectName=p.name,
            projectId=p.id,
            sector=p.derivedSector or p.sector,
            state=p.state,
            agency=p.ministry or p.implementingAgency,
            currentRisk={'score': original_score, 'tier': original_tier},
            currentPriority={'score': original_priority_score, 'tier': original_priority_tier},
            simulatedRisk={'score': simulated_score, 'tier': simulated_tier},
            simulatedPriority={'score': simulated_priority_score, 'tier': simulated_priority_tier},
            evidenceSummary=(
                f"Monitored under MoSPI PAIMANA framework. Recorded {p.physicalProgressPercent}% physical completion "
                f"with cumulative expenditure ₹{(p.cumulativeExpenditureCr or 0.0):,.0f} Cr "
                f"({'+' + str(p.costOverrunPercent) + '% cost overrun' if p.costOverrunPercent > 0 else 'budget compliant'})."
            ),
            primaryConcern=p.priorityReason or f"High risk tier ({original_score}/100) driven by progress stagnation and schedule compression.",
            recommendedAction=recommended_intervention,
            scenarioAssumptions=assumption_impacts,
            indicatorChanges=indicator_changes,
            provenance='MoSPI PAIMANA Monthly Flash Reports (Apr–Jul 2026). PRISM Evidence-Based Deterministic Risk Engine.',
            disclaimer='Illustrative Policy Scenario — Not an Observed Forecast. All scenario projections are parametric sensitivities and do not alter authoritative project records.'
        )

        return InterventionLabResult(
            projectId=p.id,
            originalRiskScore=original_score,
            originalRiskTier=original_tier,
            simulatedRiskScore=simulated_score,
            simulatedRiskTier=simulated_tier,
            riskScoreDelta=risk_score_delta,
            originalPriorityScore=original_priority_score,
            originalPriorityTier=original_priority_tier,
            simulatedPriorityScore=simulated_priority_score,
            simulatedPriorityTier=simulated_priority_tier,
            priorityScoreDelta=priority_score_delta,
            predictedDelayMonthsOriginal=original_delay,
            predictedDelayMonthsSimulated=result['predictedDelayMonths'],
            delaySavedMonths=delay_saved,
            predictedCostEscalationCrOriginal=original_cost,
            predictedCostEscalationCrSimulated=result['predictedCostEscalationCr'],
            costSavedCr=cost_saved,
            updatedDrivers=result['shapDrivers'],
            assumptionImpacts=assumption_impacts,
            indicatorChanges=indicator_changes,
            actionableInsights=insights,
            recommendedIntervention=recommended_intervention,
            officerBrief=officer_brief
        )
