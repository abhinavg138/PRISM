import { Project, RiskDriver, RiskTier } from '../src/types/index';

export interface SimulationParams {
  projectId: string;
  landClearanceAccelerationWeeks: number; // 0 to 24 weeks expedited
  contractorLiquidityInjectionPercent: number; // 0 to 50% working capital support
  weatherGeologicalMitigationLevel: number; // 0 to 100% engineering buffer
  fastTrackHighPowerCommittee: boolean;
}

export interface SimulationResult {
  projectId: string;
  originalRiskScore: number | null;
  originalRiskTier: RiskTier;
  simulatedRiskScore: number | null;
  simulatedRiskTier: RiskTier;
  riskScoreDelta: number | null;
  predictedDelayMonthsOriginal: number | null;
  predictedDelayMonthsSimulated: number | null;
  delaySavedMonths: number | null;
  predictedCostEscalationCrOriginal: number | null;
  predictedCostEscalationCrSimulated: number | null;
  costSavedCr: number | null;
  updatedDrivers: RiskDriver[];
  actionableInsights: string[];
}

/**
 * Rule-based Scenario Simulation Engine for Infrastructure Policy Interventions.
 * Simulates policy interventions (land clearance, liquidity injection, geotechnical mitigation, HPC)
 * on top of computed PRISM Risk Indices and indicator weights.
 * Note: Uses rule-based sensitivity multipliers; not an ungrounded ML black-box.
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
    shapDrivers: RiskDriver[]; // Retained field name for interface compatibility; contains evidence weights
  } {
    // Return null / UNRATED only for projects without a computed risk score.
    // PAIMANA projects now receive a deterministic score from PRISMRiskEngine.
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
    const physical = p.physicalProgressPercent;
    const financial = p.financialProgressPercent || 0;
    const timeOverrun = p.timeOverrunMonths;
    const costOverrun = p.costOverrunPercent;
    const budgetCr = p.revisedCostCr;

    // Simulation modifiers
    const landBoost = simParams?.landClearanceAccelerationWeeks || 0;
    const cashBoost = simParams?.contractorLiquidityInjectionPercent || 0;
    const geoMitigation = simParams?.weatherGeologicalMitigationLevel || 0;
    const hpc = simParams?.fastTrackHighPowerCommittee ? 1 : 0;

    let rawScore = p.riskScore;

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
   * Runs What-If Simulation and generates actionable insights
   */
  public static simulate(p: Project, params: SimulationParams): SimulationResult {
    if (p.riskScore == null) {
      return {
        projectId: p.id,
        originalRiskScore: null,
        originalRiskTier: 'UNRATED',
        simulatedRiskScore: null,
        simulatedRiskTier: 'UNRATED',
        riskScoreDelta: null,
        predictedDelayMonthsOriginal: null,
        predictedDelayMonthsSimulated: null,
        delaySavedMonths: null,
        predictedCostEscalationCrOriginal: null,
        predictedCostEscalationCrSimulated: null,
        costSavedCr: null,
        updatedDrivers: [],
        actionableInsights: [
          'Risk score unavailable. What-If simulation requires a computed PRISM Risk Index.'
        ]
      };
    }

    const originalScore = p.riskScore;
    const originalTier = p.riskTier;
    const originalDelay = p.predictedDelayMonths ?? 0;
    const originalCost = p.predictedCostEscalationCr ?? 0;

    const result = this.calculateProjectRisk(p, params);
    const riskScoreDelta = result.riskScore != null ? Math.round((result.riskScore - originalScore) * 10) / 10 : 0;
    const delaySaved = result.predictedDelayMonths != null ? Math.max(0, Math.round((originalDelay - result.predictedDelayMonths) * 10) / 10) : 0;
    const costSaved = result.predictedCostEscalationCr != null ? Math.max(0, Math.round(originalCost - result.predictedCostEscalationCr)) : 0;

    const insights: string[] = [];
    if (params.landClearanceAccelerationWeeks > 8) {
      insights.push(`Expediting statutory land approvals by ${params.landClearanceAccelerationWeeks} weeks neutralizes prime critical path bottleneck, recovering ~${(params.landClearanceAccelerationWeeks * 0.3).toFixed(1)} months.`);
    }
    if (params.contractorLiquidityInjectionPercent > 15) {
      insights.push(`Releasing ${params.contractorLiquidityInjectionPercent}% escrow working capital advance curbs subcontractor demobilization and material supply disruptions.`);
    }
    if (params.weatherGeologicalMitigationLevel > 40) {
      insights.push(`Deploying engineered geotechnical rock-bolting and heated batching facilities mitigates high-altitude seasonal stoppages.`);
    }
    if (params.fastTrackHighPowerCommittee) {
      insights.push(`Convening the Chief Secretary High-Power Inter-Departmental Committee circumvents multi-agency municipal and utility right-of-way disputes.`);
    }
    if (insights.length === 0) {
      insights.push('Standard operating progression without accelerated intervention triggers.');
    }

    return {
      projectId: p.id,
      originalRiskScore: originalScore,
      originalRiskTier: originalTier,
      simulatedRiskScore: result.riskScore,
      simulatedRiskTier: result.riskTier,
      riskScoreDelta,
      predictedDelayMonthsOriginal: originalDelay,
      predictedDelayMonthsSimulated: result.predictedDelayMonths,
      delaySavedMonths: delaySaved,
      predictedCostEscalationCrOriginal: originalCost,
      predictedCostEscalationCrSimulated: result.predictedCostEscalationCr,
      costSavedCr: costSaved,
      updatedDrivers: result.shapDrivers,
      actionableInsights: insights
    };
  }
}
