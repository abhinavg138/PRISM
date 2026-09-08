import {
  Project, RiskDriver, RiskTier, PriorityTier,
  IndicatorChange, AssumptionImpact, InterventionBriefData, InterventionLabResult
} from '../src/types/index';
import { RiskAssessment } from './riskEngine';
import { PriorityAssessment } from './priorityEngine';

export interface SimulationParams {
  projectId: string;
  landClearanceAccelerationWeeks: number; // 0 to 24 weeks expedited
  contractorLiquidityInjectionPercent: number; // 0 to 50% working capital support
  weatherGeologicalMitigationLevel: number; // 0 to 100% engineering buffer
  fastTrackHighPowerCommittee: boolean;
}

export interface SimulationResult extends InterventionLabResult {}

/**
 * Rule-based Scenario Simulation Engine for Infrastructure Policy Interventions.
 * Simulates policy interventions (land clearance, liquidity injection, geotechnical mitigation, HPC)
 * on top of computed PRISM Risk Indices, Priority Scores, and 6 PRISM Risk Indicators.
 * Note: Uses rule-based sensitivity multipliers; not an ungrounded ML black-box.
 * Explicitly labeled: "Illustrative Policy Scenario — Not an Observed Forecast"
 */
export class MLRiskEngine {
  public static calculateProjectRisk(
    p: Project,
    simParams?: Partial<SimulationParams>
  ): {
    riskScore: number | null;
    riskTier: RiskTier;
    predictedDelayMonths: number | null;
    predictedCostEscalationCr: number | null;
    confidenceScore: number | null;
    shapDrivers: RiskDriver[];
  } {
    // Return null / UNRATED only for projects without a computed risk score.
    if (p.riskScore == null) {
      return {
        riskScore: null,
        riskTier: 'UNRATED',
        predictedDelayMonths: null,
        predictedCostEscalationCr: null,
        confidenceScore: null,
        shapDrivers: []
      };
    }

    // Baseline features
    const landBoost = simParams?.landClearanceAccelerationWeeks || 0;
    const cashBoost = simParams?.contractorLiquidityInjectionPercent || 0;
    const geoMitigation = simParams?.weatherGeologicalMitigationLevel || 0;
    const hpc = simParams?.fastTrackHighPowerCommittee ? 1 : 0;

    let rawScore = p.riskScore;

    // Edge case: 100% completed project
    if (p.physicalProgressPercent >= 100) {
      return {
        riskScore: rawScore,
        riskTier: p.riskTier,
        predictedDelayMonths: 0,
        predictedCostEscalationCr: 0,
        confidenceScore: p.confidenceScore ?? 1,
        shapDrivers: p.topRiskDrivers || []
      };
    }

    // Factor in simulation improvements
    const landDeduction = landBoost * 0.75; // e.g. 12 weeks saves ~9 points
    const cashDeduction = cashBoost * 0.35; // e.g. 20% injection saves ~7 points
    const geoDeduction = (geoMitigation / 100) * 8.5; // up to 8.5 points
    const hpcDeduction = hpc * 5.0; // 5 points

    const totalReduction = landDeduction + cashDeduction + geoDeduction + hpcDeduction;
    const simulatedScore = Math.max(10, Math.min(98, Math.round((rawScore - totalReduction) * 10) / 10));

    // Determine Tier
    let simulatedTier: RiskTier = 'LOW';
    if (simulatedScore >= 80) {
      simulatedTier = 'CRITICAL';
    } else if (simulatedScore >= 60) {
      simulatedTier = 'HIGH';
    } else if (simulatedScore >= 40) {
      simulatedTier = 'MODERATE';
    }

    // Proportional delay and cost escalation impact
    const scoreRatio = simulatedScore / (rawScore || 1);
    const predictedDelay = p.predictedDelayMonths != null ? Math.max(0.2, Math.round(p.predictedDelayMonths * scoreRatio * 10) / 10) : null;
    const predictedCostEscalation = p.predictedCostEscalationCr != null ? Math.max(0, Math.round(p.predictedCostEscalationCr * scoreRatio)) : null;

    // Dynamic attribution weight adjustment under simulated intervention
    const updatedDrivers: RiskDriver[] = (p.topRiskDrivers || []).map((driver) => {
      let adjShap = driver.shapValue;
      if (driver.category === 'Land Acquisition' || driver.category === 'Clearances & Approvals') {
        adjShap = Math.round((adjShap - (landBoost * 0.4 + hpc * 3.0)) * 10) / 10;
      } else if (driver.category === 'Contractor & Cashflow') {
        adjShap = Math.round((adjShap - cashBoost * 0.25) * 10) / 10;
      } else if (driver.category === 'Geological & Weather') {
        adjShap = Math.round((adjShap - (geoMitigation / 100) * 6.0) * 10) / 10;
      }

      return {
        ...driver,
        shapValue: adjShap,
        severity: adjShap >= 18 ? 'critical' : adjShap >= 10 ? 'high' : adjShap >= 5 ? 'medium' : 'low'
      };
    });

    return {
      riskScore: simulatedScore,
      riskTier: simulatedTier,
      predictedDelayMonths: predictedDelay,
      predictedCostEscalationCr: predictedCostEscalation,
      confidenceScore: p.confidenceScore ?? null,
      shapDrivers: updatedDrivers
    };
  }

  /**
   * Runs Intervention Lab Simulation with full indicator before/after,
   * priority transitions (P1 -> P2), assumption mathematical attribution,
   * and structured officer brief generation.
   */
  public static simulate(
    p: Project,
    params: SimulationParams,
    options?: { assessment?: RiskAssessment; priority?: PriorityAssessment }
  ): SimulationResult {
    // Edge case: UNRATED / Missing history
    if (p.riskScore == null) {
      return {
        projectId: p.id,
        originalRiskScore: null,
        originalRiskTier: 'UNRATED',
        simulatedRiskScore: null,
        simulatedRiskTier: 'UNRATED',
        riskScoreDelta: null,
        originalPriorityScore: null,
        originalPriorityTier: null,
        simulatedPriorityScore: null,
        simulatedPriorityTier: null,
        priorityScoreDelta: null,
        predictedDelayMonthsOriginal: null,
        predictedDelayMonthsSimulated: null,
        delaySavedMonths: null,
        predictedCostEscalationCrOriginal: null,
        predictedCostEscalationCrSimulated: null,
        costSavedCr: null,
        updatedDrivers: [],
        assumptionImpacts: [],
        indicatorChanges: [],
        actionableInsights: [
          'Intervention Lab requires a computed PRISM Risk Index (minimum 2 monthly observations). This project is currently UNRATED.'
        ],
        recommendedIntervention: 'Insufficient longitudinal history for parametric simulation. Continue periodic PAIMANA data collection.',
        officerBrief: {
          projectName: p.name,
          projectId: p.id,
          sector: p.derivedSector || p.sector,
          state: p.state,
          agency: p.ministry || p.implementingAgency,
          currentRisk: { score: null, tier: 'UNRATED' },
          currentPriority: { score: null, tier: null },
          simulatedRisk: { score: null, tier: 'UNRATED' },
          simulatedPriority: { score: null, tier: null },
          evidenceSummary: 'Insufficient observation coverage in current snapshot window.',
          primaryConcern: 'Missing longitudinal data points prevents deterministic risk decomposition.',
          recommendedAction: 'Mandate submission of monthly PAIMANA progress and expenditure records.',
          scenarioAssumptions: [],
          indicatorChanges: [],
          provenance: 'MoSPI PAIMANA repository.',
          disclaimer: 'Illustrative Policy Scenario — Not an Observed Forecast.'
        }
      };
    }

    const originalScore = p.riskScore;
    const originalTier = p.riskTier;
    const originalDelay = p.predictedDelayMonths ?? (p.timeOverrunMonths != null ? Math.round(p.timeOverrunMonths * 0.4 * 10) / 10 : 0);
    const originalCost = p.predictedCostEscalationCr ?? (p.costOverrunPercent > 0 ? Math.round((p.revisedCostCr - p.originalCostCr) * 0.3) : 0);

    const landBoost = params.landClearanceAccelerationWeeks || 0;
    const cashBoost = params.contractorLiquidityInjectionPercent || 0;
    const geoMitigation = params.weatherGeologicalMitigationLevel || 0;
    const hpc = params.fastTrackHighPowerCommittee ? 1 : 0;

    // Edge case: 100% completed project
    const isCompleted = p.physicalProgressPercent >= 100;

    const result = isCompleted
      ? {
          riskScore: originalScore,
          riskTier: originalTier,
          predictedDelayMonths: 0,
          predictedCostEscalationCr: 0,
          confidenceScore: p.confidenceScore ?? 1,
          shapDrivers: p.topRiskDrivers || []
        }
      : this.calculateProjectRisk(p, params);

    const simulatedScore = result.riskScore!;
    const simulatedTier = result.riskTier;
    const riskScoreDelta = Math.round((simulatedScore - originalScore) * 10) / 10;
    const delaySaved = result.predictedDelayMonths != null ? Math.max(0, Math.round((originalDelay - result.predictedDelayMonths) * 10) / 10) : 0;
    const costSaved = result.predictedCostEscalationCr != null ? Math.max(0, Math.round(originalCost - result.predictedCostEscalationCr)) : 0;

    // Priority Engine Transitions (P1 -> P2)
    const originalPriorityScore = p.priorityScore ?? (options?.priority?.priorityScore ?? Math.min(100, Math.round(originalScore * 0.95 + 12)));
    const originalPriorityTier: PriorityTier = p.priorityTier ?? (options?.priority?.priorityTier ?? (originalPriorityScore >= 70 ? 'P1' : originalPriorityScore >= 50 ? 'P2' : 'P3'));

    let simulatedPriorityScore = originalPriorityScore;
    let simulatedPriorityTier: PriorityTier = originalPriorityTier;
    let priorityScoreDelta = 0;

    if (!isCompleted && riskScoreDelta < 0) {
      const pDrop = Math.round(Math.abs(riskScoreDelta) * 0.85);
      simulatedPriorityScore = Math.max(10, Math.min(100, originalPriorityScore - pDrop));
      simulatedPriorityTier = simulatedPriorityScore >= 70 ? 'P1' : simulatedPriorityScore >= 50 ? 'P2' : 'P3';
      priorityScoreDelta = simulatedPriorityScore - originalPriorityScore;
    }

    // 6 PRISM Risk Indicators: Before vs After calculation
    const rawIndicators = options?.assessment?.indicators || [
      { id: 'velocity', label: 'Progress Velocity', weight: 25, normalisedScore: Math.round(Math.min(100, Math.max(0, (100 - p.physicalProgressPercent) * 0.75))), weightedContribution: 0 },
      { id: 'stagnation', label: 'Progress Stagnation', weight: 20, normalisedScore: p.alert?.alertType === 'Progress Stagnation' ? 85 : (originalScore >= 75 ? 75 : 30), weightedContribution: 0 },
      { id: 'schedule_pressure', label: 'Schedule Pressure', weight: 20, normalisedScore: Math.min(100, Math.max(10, Math.round((p.timeOverrunMonths || 0) * 2.2))), weightedContribution: 0 },
      { id: 'cost_escalation', label: 'Cost Escalation', weight: 15, normalisedScore: Math.min(100, Math.max(0, Math.round((p.costOverrunPercent || 0) * 1.1))), weightedContribution: 0 },
      { id: 'divergence', label: 'Phys-Financial Divergence', weight: 10, normalisedScore: Math.min(100, Math.max(0, Math.round(Math.abs((p.expenditurePctOfRevisedCost || 0) - p.physicalProgressPercent) * 1.4))), weightedContribution: 0 },
      { id: 'deteriorating_trend', label: 'Deteriorating Trend', weight: 10, normalisedScore: originalScore >= 60 ? 65 : 25, weightedContribution: 0 },
    ];

    const indicatorChanges: IndicatorChange[] = rawIndicators.map((ind) => {
      let reduction = 0;
      let driver = 'Baseline monitoring';

      if (!isCompleted) {
        if (ind.id === 'velocity') {
          reduction = Math.round(cashBoost * 1.0 + landBoost * 0.5);
          if (cashBoost > 0 || landBoost > 0) {
            driver = `Execution throughput accelerated via ${cashBoost > 0 ? `${cashBoost}% liquidity` : ''}${cashBoost > 0 && landBoost > 0 ? ' & ' : ''}${landBoost > 0 ? `${landBoost}w land approvals` : ''}`;
          }
        } else if (ind.id === 'stagnation') {
          reduction = Math.round(hpc * 16.0 + cashBoost * 0.4 + (geoMitigation / 100) * 8.0);
          if (hpc || cashBoost > 0 || geoMitigation > 0) {
            driver = `Site stoppage broken by ${hpc ? 'HPC inter-agency arbitration' : ''}${hpc && (cashBoost || geoMitigation) ? ' & ' : ''}${cashBoost ? 'working capital support' : ''}`;
          }
        } else if (ind.id === 'schedule_pressure') {
          reduction = Math.round(landBoost * 1.8 + hpc * 10.0);
          if (landBoost > 0 || hpc) {
            driver = `Critical path compressed by ${landBoost > 0 ? `${landBoost}w land clearance` : ''}${landBoost > 0 && hpc ? ' & ' : ''}${hpc ? 'HPC fast-track' : ''}`;
          }
        } else if (ind.id === 'cost_escalation') {
          reduction = Math.round(cashBoost * 0.4 + landBoost * 0.4);
          if (cashBoost > 0 || landBoost > 0) {
            driver = 'Indirect idling claims curbed through schedule acceleration';
          }
        } else if (ind.id === 'divergence') {
          reduction = Math.round(cashBoost * 0.8 + (geoMitigation / 100) * 4.0);
          if (cashBoost > 0) {
            driver = 'Contractor mobilization synchronizes physical progress with expenditure burn';
          }
        } else if (ind.id === 'deteriorating_trend') {
          reduction = Math.round((geoMitigation / 100) * 12.0 + hpc * 8.0);
          if (geoMitigation > 0 || hpc) {
            driver = 'Downside trend arrested by engineered buffers and high-power monitoring';
          }
        }
      }

      const origScore = ind.normalisedScore ?? 0;
      const simScore = Math.max(0, Math.min(100, origScore - reduction));
      const origContrib = Math.round(((origScore * ind.weight) / 100) * 10) / 10;
      const simContrib = Math.round(((simScore * ind.weight) / 100) * 10) / 10;

      return {
        id: ind.id,
        label: ind.label,
        weight: ind.weight,
        originalScore: origScore,
        simulatedScore: simScore,
        scoreDelta: simScore - origScore,
        originalContribution: origContrib,
        simulatedContribution: simContrib,
        assumptionDriver: driver
      };
    });

    // Assumption mathematical attribution
    const assumptionImpacts: AssumptionImpact[] = [];
    if (isCompleted) {
      assumptionImpacts.push({
        lever: 'Project Complete',
        value: '100% physical completion',
        pointsReduced: 0,
        mechanism: 'Asset is fully constructed; entering commercial operations and commissioning.'
      });
    } else {
      if (landBoost > 0) {
        assumptionImpacts.push({
          lever: 'Land Clearance Acceleration',
          value: `${landBoost} weeks expedited`,
          pointsReduced: Math.round(landBoost * 0.75 * 10) / 10,
          mechanism: 'Expedites statutory right-of-way handover and site possession on the critical path.'
        });
      }
      if (cashBoost > 0) {
        assumptionImpacts.push({
          lever: 'Contractor Working Capital Support',
          value: `${cashBoost}% escrow mobilization advance`,
          pointsReduced: Math.round(cashBoost * 0.35 * 10) / 10,
          mechanism: 'Unblocks subcontractor cashflow and material procurement, restoring monthly physical velocity.'
        });
      }
      if (geoMitigation > 0) {
        assumptionImpacts.push({
          lever: 'Geotechnical & Weather Engineering Buffer',
          value: `${geoMitigation}% engineering mitigation level`,
          pointsReduced: Math.round(((geoMitigation / 100) * 8.5) * 10) / 10,
          mechanism: 'Deploys rock-bolting, slope protection, and heated batching to mitigate seasonal stoppages.'
        });
      }
      if (hpc) {
        assumptionImpacts.push({
          lever: 'Fast-Track High-Power Committee (HPC)',
          value: 'Convened at Chief Secretary Level',
          pointsReduced: 5.0,
          mechanism: 'Bypasses departmental silos to resolve inter-agency forest, rail, and municipal utility disputes.'
        });
      }
      if (assumptionImpacts.length === 0) {
        assumptionImpacts.push({
          lever: 'Status Quo Progression',
          value: '0 policy levers applied',
          pointsReduced: 0,
          mechanism: 'Baseline observation trajectory continues without intervention interventions.'
        });
      }
    }

    // Actionable insights & tailored recommended intervention
    const insights: string[] = [];
    if (isCompleted) {
      insights.push('Project Complete (100% physical completion). Commercial operation / commissioning underway. No remedial intervention required.');
    } else {
      if (landBoost > 8) {
        insights.push(`Expediting statutory land approvals by ${landBoost} weeks neutralizes prime critical path bottleneck, recovering ~${(landBoost * 0.3).toFixed(1)} months.`);
      }
      if (cashBoost > 15) {
        insights.push(`Releasing ${cashBoost}% escrow working capital advance curbs subcontractor demobilization and material supply disruptions.`);
      }
      if (geoMitigation > 40) {
        insights.push(`Deploying engineered geotechnical rock-bolting and heated batching facilities mitigates seasonal stoppages.`);
      }
      if (hpc) {
        insights.push('Convening the Chief Secretary High-Power Inter-Departmental Committee circumvents multi-agency utility disputes.');
      }
      if (insights.length === 0) {
        insights.push('Standard operating progression without accelerated intervention triggers.');
      }
    }

    let recommendedIntervention: string;
    if (isCompleted) {
      recommendedIntervention = 'Project Complete (100% physical completion). Routine commissioning & asset handover monitoring.';
    } else if (originalScore >= 80) {
      recommendedIntervention = 'Convene High-Power Committee to expedite land possession and release targeted contractor liquidity.';
    } else if (originalScore >= 60) {
      recommendedIntervention = 'Deploy contractor working capital support and resolve critical utility right-of-way clearances.';
    } else if (originalScore >= 40) {
      recommendedIntervention = 'Maintain intensive monthly milestone tracking; verify contractor mobilization.';
    } else {
      recommendedIntervention = 'Routine monitoring active. Project is operating within expected tolerance bounds.';
    }

    // Officer Brief
    const officerBrief: InterventionBriefData = {
      projectName: p.name,
      projectId: p.id,
      sector: p.derivedSector || p.sector,
      state: p.state,
      agency: p.ministry || p.implementingAgency,
      currentRisk: { score: originalScore, tier: originalTier },
      currentPriority: { score: originalPriorityScore, tier: originalPriorityTier },
      simulatedRisk: { score: simulatedScore, tier: simulatedTier },
      simulatedPriority: { score: simulatedPriorityScore, tier: simulatedPriorityTier },
      evidenceSummary: `Monitored under MoSPI PAIMANA framework. Recorded ${p.physicalProgressPercent}% physical completion with cumulative expenditure ₹${(p.cumulativeExpenditureCr || 0).toLocaleString()} Cr (${p.costOverrunPercent > 0 ? `+${p.costOverrunPercent}% cost overrun` : 'budget compliant'}).`,
      primaryConcern: p.priorityReason || `High risk tier (${originalScore}/100) driven by progress stagnation and schedule compression.`,
      recommendedAction: recommendedIntervention,
      scenarioAssumptions: assumptionImpacts,
      indicatorChanges,
      provenance: 'MoSPI PAIMANA Monthly Flash Reports (Apr–Jul 2026). PRISM Evidence-Based Deterministic Risk Engine.',
      disclaimer: 'Illustrative Policy Scenario — Not an Observed Forecast. All scenario projections are parametric sensitivities and do not alter authoritative project records.'
    };

    return {
      projectId: p.id,
      originalRiskScore: originalScore,
      originalRiskTier: originalTier,
      simulatedRiskScore: simulatedScore,
      simulatedRiskTier: simulatedTier,
      riskScoreDelta,
      originalPriorityScore,
      originalPriorityTier,
      simulatedPriorityScore,
      simulatedPriorityTier,
      priorityScoreDelta,
      predictedDelayMonthsOriginal: originalDelay,
      predictedDelayMonthsSimulated: result.predictedDelayMonths,
      delaySavedMonths: delaySaved,
      predictedCostEscalationCrOriginal: originalCost,
      predictedCostEscalationCrSimulated: result.predictedCostEscalationCr,
      costSavedCr: costSaved,
      updatedDrivers: result.shapDrivers,
      assumptionImpacts,
      indicatorChanges,
      actionableInsights: insights,
      recommendedIntervention,
      officerBrief
    };
  }
}
