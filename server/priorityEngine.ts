/**
 * PRISM Priority Engine (Phase 3A)
 *
 * Deterministically turns project risk assessments into an evidence-based
 * Intervention Priority Queue for infrastructure decision-makers.
 *
 * Core Principle:
 *   Priority is NOT simply riskScore.
 *   High risk alone does not imply operational urgency (e.g. a high-risk project
 *   with a completion date 5 years away does not require immediate cabinet intervention).
 *   The intervention queue prioritizes projects where high risk is BOTH credible
 *   (confirmed by longitudinal evidence) AND operationally urgent (deadline pressure,
 *   active stagnation, or acute deterioration).
 *
 * Deterministic Priority Formula:
 *   Priority Score = round(
 *       0.40 * RiskScore
 *     + 0.25 * ScheduleUrgency
 *     + 0.20 * RecentProgressDeterioration
 *     + 0.15 * (EvidenceConfidence * 100)
 *   )
 *   Bounded in [0, 100].
 *
 * Weights (Sum = 100%):
 *   1. PRISM Risk Index                 : 40% (0.40)
 *   2. Schedule Urgency                 : 25% (0.25)
 *   3. Recent Progress Deterioration    : 20% (0.20)
 *   4. Evidence Confidence              : 15% (0.15)
 *
 * Priority Tiers:
 *   P1 (Immediate intervention)        : Priority Score >= 70
 *   P2 (High-priority monitoring)       : 50 <= PriorityScore < 70
 *   P3 (Routine monitoring)             : Priority Score < 50
 *
 * Recommended Actions:
 *   Deterministic, indicator-grounded rules. No ML model claims.
 */

import { PaimanaObservation, RiskTier } from '../src/types/index';
import { PRISMRiskEngine, RiskAssessment } from './riskEngine';

export type PriorityTier = 'P1' | 'P2' | 'P3';

export interface PriorityAssessment {
  projectId: string;
  projectName: string;
  code: string;
  sector: string;
  state: string;
  implementingAgency: string;
  priorityScore: number;
  priorityTier: PriorityTier;
  riskScore: number;
  riskTier: RiskTier;
  evidenceConfidence: number; // 0.25 to 1.00
  urgency: number; // 0 to 100
  recentDeterioration: number; // 0 to 100
  primaryRiskDriver: string;
  topRiskDrivers: string[];
  priorityReason: string;
  recommendedAction: string;
  evidence: {
    physicalProgressPercent: number;
    cumulativeExpenditureCr: number;
    revisedCostCr: number;
    originalCostCr: number;
    costOverrunPercent: number;
    expenditurePctOfRevisedCost: number;
    timeOverrunMonths: number;
    targetCompletionDate: string;
    originalCompletionDate: string;
    consecutiveStagnantMonths: number;
    recentProgressDelta: number | null;
    observationCount: number;
  };
  assessedAt: string;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function parseCompletionDateToFractionalYear(str?: string): number | null {
  if (!str) return null;
  const parts = str.trim().split('/');
  if (parts.length !== 2) return null;
  const m = parseInt(parts[0], 10);
  const y = parseInt(parts[1], 10);
  if (isNaN(m) || isNaN(y)) return null;
  return y + (m - 1) / 12;
}

function reportMonthToFractionalYear(s: string): number {
  const parts = s.split('-');
  if (parts.length !== 2) return 0;
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  return y + (m - 1) / 12;
}

/**
 * Calculates Schedule Urgency (0-100).
 *
 * Operational urgency measures deadline proximity and overdue status:
 *  - Past deadline (remainingYears <= 0): 85-100 (inversely proportional to progress)
 *  - Imminent (0 < remainingYears <= 0.5, within 6 months): 70-95
 *  - Approaching (0.5 < remainingYears <= 1.0, 6-12 months): 50-70
 *  - Medium term (1.0 < remainingYears <= 2.0, 1-2 years): 30-50
 *  - Long horizon (remainingYears > 2.0): 5-30
 *  - If project is physically 100% complete: 0
 *  - If no completion date recorded: 40 (moderate default)
 */
export function calcScheduleUrgency(latest: PaimanaObservation): number {
  const physPct = latest.physical_progress_pct ?? 0;
  if (physPct >= 100) return 0;

  const targetDateStr = latest.revised_target_completion_mm_yyyy || latest.original_target_completion_mm_yyyy;
  const targetYear = parseCompletionDateToFractionalYear(targetDateStr);
  if (targetYear == null) {
    return 40; // Neutral baseline if no target completion date is provided
  }

  const reportYear = reportMonthToFractionalYear(latest.report_month || '2026-07');
  const remainingYears = targetYear - reportYear;

  let urgency: number;
  if (remainingYears <= 0) {
    // Already overdue
    urgency = 85 + (100 - physPct) * 0.15;
  } else if (remainingYears <= 0.5) {
    // Within 6 months
    const timeFactor = (1 - remainingYears / 0.5) * 15;
    const progressFactor = ((100 - physPct) / 100) * 10;
    urgency = 70 + timeFactor + progressFactor;
  } else if (remainingYears <= 1.0) {
    // 6 to 12 months
    urgency = 50 + ((1.0 - remainingYears) / 0.5) * 20;
  } else if (remainingYears <= 2.0) {
    // 1 to 2 years
    urgency = 30 + ((2.0 - remainingYears) / 1.0) * 20;
  } else {
    // > 2 years
    urgency = 30 - (remainingYears - 2.0) * 5;
  }

  return clamp(Math.round(urgency), 0, 100);
}

/**
 * Calculates Recent Progress Deterioration (0-100) and consecutive stagnant months.
 *
 * Evaluates whether project progress is stalling, retrogressing, or sharply decelerating.
 *  - Retrogression (delta < 0): 100
 *  - Stagnant (delta == 0):
 *      >= 3 consecutive stagnant intervals: 95
 *      2 consecutive stagnant intervals: 80
 *      1 stagnant interval: 65
 *  - Sluggish (0 < delta < 0.5 pp/mo): 40-55
 *  - Moderate (0.5 <= delta < 1.0 pp/mo): 25
 *  - Adequate (1.0 <= delta < 2.0 pp/mo): 10
 *  - Healthy (delta >= 2.0 pp/mo): 0
 *  - Sudden deceleration bonus: +15 if historical early velocity was high but recent velocity dropped
 */
export function calcRecentDeterioration(obs: PaimanaObservation[]): { score: number; consecutiveStagnantMonths: number; recentDelta: number | null } {
  if (!obs || obs.length < 2) {
    return { score: 30, consecutiveStagnantMonths: 0, recentDelta: null };
  }

  const deltas: number[] = [];
  for (let i = 1; i < obs.length; i++) {
    deltas.push((obs[i].physical_progress_pct ?? 0) - (obs[i - 1].physical_progress_pct ?? 0));
  }

  const recentDelta = deltas[deltas.length - 1];

  // Count consecutive stagnant intervals from the end
  let consecutiveStagnantMonths = 0;
  for (let i = deltas.length - 1; i >= 0; i--) {
    if (deltas[i] <= 0.1) {
      consecutiveStagnantMonths++;
    } else {
      break;
    }
  }

  let score: number;
  if (recentDelta < 0) {
    score = 100;
  } else if (recentDelta <= 0.1) {
    if (consecutiveStagnantMonths >= 3) score = 95;
    else if (consecutiveStagnantMonths === 2) score = 80;
    else score = 65;
  } else if (recentDelta < 0.5) {
    score = consecutiveStagnantMonths > 0 ? 55 : 40;
  } else if (recentDelta < 1.0) {
    score = 25;
  } else if (recentDelta < 2.0) {
    score = 10;
  } else {
    score = 0;
  }

  // Trend deceleration penalty
  if (obs.length >= 3) {
    const earlyDeltas = deltas.slice(0, Math.floor(deltas.length / 2));
    const earlyAvg = earlyDeltas.reduce((s, d) => s + d, 0) / (earlyDeltas.length || 1);
    const decel = earlyAvg - recentDelta;
    if (decel > 2.0) {
      score += 15;
    }
  }

  return {
    score: clamp(Math.round(score), 0, 100),
    consecutiveStagnantMonths,
    recentDelta: parseFloat(recentDelta.toFixed(2))
  };
}

/**
 * Assigns Priority Tier from Priority Score:
 *   P1 = Immediate intervention    (Score >= 70)
 *   P2 = High-priority monitoring   (50 <= Score < 70)
 *   P3 = Routine monitoring         (Score < 50)
 */
export function priorityTierFromScore(score: number): PriorityTier {
  if (score >= 70) return 'P1';
  if (score >= 50) return 'P2';
  return 'P3';
}

/**
 * Deterministically generates recommended actions based on actual indicator evidence.
 * No ML model claims.
 */
export function buildRecommendedAction(
  assessment: RiskAssessment,
  urgency: number,
  recentDeterioration: number,
  consecutiveStagnantMonths: number,
  costOverrunPercent: number,
  spendProgressGap: number
): string {
  const actions: string[] = [];

  // Indicator lookup
  const getIndicatorScore = (id: string) => assessment.indicators.find(i => i.id === id)?.normalisedScore ?? 0;

  const stagnationScore = getIndicatorScore('stagnation');
  const costScore = getIndicatorScore('cost');
  const scheduleScore = getIndicatorScore('schedule');
  const divergenceScore = getIndicatorScore('divergence');
  const velocityScore = getIndicatorScore('velocity');

  // Rule 1: Prolonged Stagnation
  if (consecutiveStagnantMonths >= 2 || stagnationScore >= 60) {
    actions.push('Escalate physical-progress review');
  }

  // Rule 2: High Schedule Pressure
  if (urgency >= 75 || scheduleScore >= 60) {
    actions.push('Review completion recovery plan');
  }

  // Rule 3: Expenditure substantially ahead of physical progress (Divergence)
  if (divergenceScore >= 60 || spendProgressGap >= 15) {
    actions.push('Review expenditure–physical progress divergence');
  }

  // Rule 4: Severe Cost Escalation
  if (costScore >= 60 || costOverrunPercent >= 20) {
    actions.push('Initiate cost/revision review');
  }

  // Rule 5: Severe Velocity Deceleration / Contractor Sluggishness
  if (recentDeterioration >= 70 || velocityScore >= 70) {
    if (!actions.includes('Escalate physical-progress review')) {
      actions.push('Conduct contractor mobilization & site execution audit');
    }
  }

  if (actions.length === 0) {
    return 'Maintain routine milestone & expenditure monitoring';
  }

  return actions.join('; ');
}

/**
 * Builds deterministic human-readable reason for priority assignment.
 */
export function buildPriorityReason(
  tier: PriorityTier,
  priorityScore: number,
  riskScore: number,
  urgency: number,
  deterioration: number,
  confidence: number,
  consecutiveStagnantMonths: number,
  topDrivers: string[]
): string {
  const confidencePercent = Math.round(confidence * 100);

  if (tier === 'P1') {
    const reasons: string[] = [];
    if (urgency >= 75) reasons.push(`high schedule urgency (${urgency}/100)`);
    if (consecutiveStagnantMonths >= 2) reasons.push(`${consecutiveStagnantMonths} consecutive months of stagnant progress`);
    else if (deterioration >= 60) reasons.push(`acute recent progress deterioration (${deterioration}/100)`);
    if (reasons.length === 0 && topDrivers.length > 0) reasons.push(`critical ${topDrivers[0].toLowerCase()}`);

    const driverDetail = reasons.length > 0 ? reasons.join(' and ') : 'compounded operational risk indicators';
    return `P1 Immediate Intervention: High PRISM Risk Index (${riskScore}) confirmed with ${confidencePercent}% evidence confidence, compounded by ${driverDetail}.`;
  }

  if (tier === 'P2') {
    return `P2 High-Priority Monitoring: Elevated composite score (${priorityScore}) with operational urgency (${urgency}/100); key indicators (${topDrivers.slice(0, 2).join(', ') || 'execution'}) warrant focused oversight.`;
  }

  return `P3 Routine Monitoring: Project maintains manageable priority index (${priorityScore}) with risk index ${riskScore} and low immediate schedule pressure.`;
}

export class PRISMPriorityEngine {
  /**
   * Weights configuration:
   *   PRISM Risk Index:              40%
   *   Schedule Urgency:              25%
   *   Recent Progress Deterioration: 20%
   *   Evidence Confidence:           15%
   */
  public static readonly WEIGHTS = {
    risk: 0.40,
    urgency: 0.25,
    deterioration: 0.20,
    confidence: 0.15
  } as const;

  /**
   * Calculates the deterministic Priority Assessment for a project.
   *
   * @param observations  Sorted PAIMANA monthly snapshots for the project.
   * @param existingAssessment Optional precomputed RiskAssessment from PRISMRiskEngine.
   */
  public static assess(
    observations: PaimanaObservation[],
    existingAssessment?: RiskAssessment
  ): PriorityAssessment {
    if (!observations || observations.length === 0) {
      throw new Error('PRISMPriorityEngine.assess() requires at least one observation');
    }

    const obs = [...observations].sort((a, b) => a.report_month.localeCompare(b.report_month));
    const latest = obs[obs.length - 1];

    // 1. PRISM Risk Index & Assessment
    const riskAssessment = existingAssessment || PRISMRiskEngine.assess(obs);
    const riskScore = riskAssessment.riskScore;
    const riskTier = riskAssessment.riskTier;
    const evidenceConfidence = riskAssessment.evidenceConfidence; // 0.25 to 1.00

    // 2. Schedule Urgency (0 to 100)
    const urgency = calcScheduleUrgency(latest);

    // 3. Recent Progress Deterioration (0 to 100)
    const { score: recentDeterioration, consecutiveStagnantMonths, recentDelta } = calcRecentDeterioration(obs);

    // 4. Evidence Confidence normalized (0 to 100)
    const confidenceScore = clamp(evidenceConfidence * 100, 0, 100);

    // Deterministic Priority Formula:
    // PriorityScore = 0.40 * riskScore + 0.25 * urgency + 0.20 * deterioration + 0.15 * confidenceScore
    const rawPriorityScore = (
      riskScore * PRISMPriorityEngine.WEIGHTS.risk +
      urgency * PRISMPriorityEngine.WEIGHTS.urgency +
      recentDeterioration * PRISMPriorityEngine.WEIGHTS.deterioration +
      confidenceScore * PRISMPriorityEngine.WEIGHTS.confidence
    );

    const priorityScore = clamp(Math.round(rawPriorityScore), 0, 100);
    const priorityTier = priorityTierFromScore(priorityScore);

    // Drivers
    const sortedIndicators = [...riskAssessment.indicators].sort(
      (a, b) => b.weightedContribution - a.weightedContribution
    );
    const primaryRiskDriver = sortedIndicators[0]?.label || 'General Execution';
    const topRiskDrivers = sortedIndicators
      .filter(ind => ind.normalisedScore >= 25)
      .slice(0, 3)
      .map(ind => ind.label);

    if (topRiskDrivers.length === 0) {
      topRiskDrivers.push(primaryRiskDriver);
    }

    // Cost Overrun and Gap Calculation
    const originalCost = latest.original_cost_cr || 0;
    const revisedCost = latest.revised_cost_cr || originalCost;
    const costOverrunPercent = originalCost > 0
      ? Math.max(0, parseFloat((((revisedCost - originalCost) / originalCost) * 100).toFixed(1)))
      : 0;

    const expPct = latest.expenditure_pct_of_revised_cost ?? (
      revisedCost > 0 ? parseFloat(((latest.cumulative_expenditure_cr / revisedCost) * 100).toFixed(2)) : 0
    );
    const physPct = latest.physical_progress_pct ?? 0;
    const spendProgressGap = parseFloat((expPct - physPct).toFixed(2));

    const recommendedAction = buildRecommendedAction(
      riskAssessment,
      urgency,
      recentDeterioration,
      consecutiveStagnantMonths,
      costOverrunPercent,
      spendProgressGap
    );

    const priorityReason = buildPriorityReason(
      priorityTier,
      priorityScore,
      riskScore,
      urgency,
      recentDeterioration,
      evidenceConfidence,
      consecutiveStagnantMonths,
      topRiskDrivers
    );

    return {
      projectId: latest.project_id,
      projectName: latest.project_name,
      code: latest.legacy_ocms_code || (latest.pmgid ? `PMG-${latest.pmgid}` : `PAIMANA-${latest.project_id}`),
      sector: '', // Filled in by repository if derived sector available
      state: latest.state,
      implementingAgency: latest.agency,
      priorityScore,
      priorityTier,
      riskScore,
      riskTier,
      evidenceConfidence,
      urgency,
      recentDeterioration,
      primaryRiskDriver,
      topRiskDrivers,
      priorityReason,
      recommendedAction,
      evidence: {
        physicalProgressPercent: physPct,
        cumulativeExpenditureCr: latest.cumulative_expenditure_cr ?? 0,
        revisedCostCr: revisedCost,
        originalCostCr: originalCost,
        costOverrunPercent,
        expenditurePctOfRevisedCost: expPct,
        timeOverrunMonths: 0, // Filled in by repository
        targetCompletionDate: latest.revised_target_completion_mm_yyyy || latest.original_target_completion_mm_yyyy || 'Not specified',
        originalCompletionDate: latest.original_target_completion_mm_yyyy || 'Not specified',
        consecutiveStagnantMonths,
        recentProgressDelta: recentDelta,
        observationCount: obs.length
      },
      assessedAt: new Date().toISOString()
    };
  }
}
