/**
 * PRISM Evidence-Based Risk Engine (Phase 2)
 *
 * Calculates a deterministic PRISM Risk Index (0-100) for PAIMANA projects
 * using longitudinal monthly observations (Apr-Jul 2026).
 *
 * Design principles:
 *  - No ML model, no synthetic training data, no black-box inference.
 *  - All indicators derived exclusively from fields present in PaimanaObservation.
 *  - Every indicator is documented with its formula and weight.
 *  - The output is fully auditable: each indicator raw value, normalised score,
 *    and weighted contribution is returned alongside the composite index.
 *  - "SHAP" terminology is intentionally absent; contributors are called
 *    "risk indicators" or "evidence factors".
 *
 * Indicator weights (sum = 100):
 *   Progress Velocity              : 25
 *   Progress Stagnation            : 20
 *   Schedule Pressure              : 20
 *   Cost Escalation                : 15
 *   Phys-Financial Divergence      : 10
 *   Deteriorating Trend            : 10
 *
 * Evidence Confidence (0-1) is returned as metadata only; it does NOT inflate
 * the risk score.
 */

import { PaimanaObservation, RiskTier } from '../src/types/index';

export interface RiskIndicator {
  id: string;
  label: string;
  description: string;
  rawValue: number | null;
  normalisedScore: number;
  weight: number;
  weightedContribution: number;
  category: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'none';
}

export interface RiskAssessment {
  riskScore: number;
  riskTier: RiskTier;
  evidenceConfidence: number;
  observationCount: number;
  indicators: RiskIndicator[];
  primaryConcerns: string[];
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

function linearNorm(value: number, lo: number, hi: number): number {
  if (hi <= lo) return 0;
  return clamp(((value - lo) / (hi - lo)) * 100, 0, 100);
}

function severityFromScore(score: number): 'critical' | 'high' | 'medium' | 'low' | 'none' {
  if (score >= 80) return 'critical';
  if (score >= 60) return 'high';
  if (score >= 35) return 'medium';
  if (score > 0) return 'low';
  return 'none';
}

// Indicator 1: Progress Velocity (weight 25)
function calcProgressVelocity(obs: PaimanaObservation[]): RiskIndicator {
  const id = 'velocity';
  if (obs.length < 2) {
    return { id, label: 'Progress Velocity', description: 'Average month-over-month change in physical completion percentage.', rawValue: null, normalisedScore: 50, weight: 25, weightedContribution: 12.5, category: 'Progress', severity: 'medium' };
  }
  const deltas: number[] = [];
  for (let i = 1; i < obs.length; i++) deltas.push(obs[i].physical_progress_pct - obs[i - 1].physical_progress_pct);
  const avgDelta = deltas.reduce((s, d) => s + d, 0) / deltas.length;
  let normScore: number;
  if (avgDelta >= 5) normScore = 0;
  else if (avgDelta >= 0) normScore = 75 - linearNorm(avgDelta, 0, 5) * 75 / 100;
  else normScore = 75 + linearNorm(Math.abs(avgDelta), 0, 2) * 25 / 100;
  normScore = clamp(normScore, 0, 100);
  const weight = 25;
  const contribution = (normScore * weight) / 100;
  return { id, label: 'Progress Velocity', description: `Average MoM physical progress: ${avgDelta >= 0 ? '+' : ''}${avgDelta.toFixed(2)} pp/month across ${obs.length - 1} interval(s).`, rawValue: parseFloat(avgDelta.toFixed(3)), normalisedScore: Math.round(normScore), weight, weightedContribution: parseFloat(contribution.toFixed(2)), category: 'Progress', severity: severityFromScore(normScore) };
}

// Indicator 2: Progress Stagnation (weight 20)
function calcProgressStagnation(obs: PaimanaObservation[]): RiskIndicator {
  const id = 'stagnation';
  if (obs.length < 2) {
    return { id, label: 'Progress Stagnation', description: 'Detection of consecutive months with negligible physical progress change.', rawValue: null, normalisedScore: 40, weight: 20, weightedContribution: 8, category: 'Progress', severity: 'medium' };
  }
  const THRESHOLD = 0.5;
  let maxStreak = 0, currentStreak = 0, stagnantCount = 0;
  for (let i = 1; i < obs.length; i++) {
    const delta = Math.abs(obs[i].physical_progress_pct - obs[i - 1].physical_progress_pct);
    if (delta <= THRESHOLD) { currentStreak++; stagnantCount++; if (currentStreak > maxStreak) maxStreak = currentStreak; }
    else currentStreak = 0;
  }
  const totalIntervals = obs.length - 1;
  const normScore = clamp(linearNorm(maxStreak, 0, totalIntervals) * 0.6 + (stagnantCount / totalIntervals) * 100 * 0.4, 0, 100);
  const weight = 20;
  const contribution = (normScore * weight) / 100;
  return { id, label: 'Progress Stagnation', description: `${stagnantCount} of ${totalIntervals} intervals show <= 0.5 pp change. Longest consecutive stagnant streak: ${maxStreak} month(s).`, rawValue: maxStreak, normalisedScore: Math.round(normScore), weight, weightedContribution: parseFloat(contribution.toFixed(2)), category: 'Progress', severity: severityFromScore(normScore) };
}

// Indicator 3: Schedule Pressure (weight 20)
function calcSchedulePressure(obs: PaimanaObservation[]): RiskIndicator {
  const id = 'schedule_pressure';
  const latest = obs[obs.length - 1];
  const revTarget = parseCompletionDateToFractionalYear(latest.revised_target_completion_mm_yyyy);
  const latestDate = reportMonthToFractionalYear(latest.report_month);
  if (revTarget == null) {
    const origTarget = parseCompletionDateToFractionalYear(latest.original_target_completion_mm_yyyy);
    const normScore = origTarget != null && latestDate > origTarget ? 70 : 30;
    const weight = 20;
    return { id, label: 'Schedule Pressure', description: 'No revised completion target available; using original target date.', rawValue: null, normalisedScore: normScore, weight, weightedContribution: parseFloat(((normScore * weight) / 100).toFixed(2)), category: 'Schedule', severity: severityFromScore(normScore) };
  }
  const monthsRemaining = (revTarget - latestDate) * 12;
  const progressGap = 100 - latest.physical_progress_pct;
  let baseScore: number;
  if (monthsRemaining > 24) baseScore = 0;
  else if (monthsRemaining >= 0) baseScore = linearNorm(24 - monthsRemaining, 0, 24) * 70 / 100;
  else baseScore = clamp(70 + linearNorm(Math.abs(monthsRemaining), 0, 12) * 30 / 100, 70, 100);
  let pressureBoost = 0;
  if (monthsRemaining > 0 && progressGap > 0) {
    const req = progressGap / monthsRemaining;
    if (req > 10) pressureBoost = 20; else if (req > 5) pressureBoost = 10; else if (req > 2) pressureBoost = 5;
  }
  const normScore = clamp(baseScore + pressureBoost, 0, 100);
  const weight = 20;
  const contribution = (normScore * weight) / 100;
  return { id, label: 'Schedule Pressure', description: monthsRemaining >= 0 ? `${monthsRemaining.toFixed(1)} months until revised deadline (${latest.revised_target_completion_mm_yyyy}); ${progressGap.toFixed(1)} pp of work remains.` : `Revised target (${latest.revised_target_completion_mm_yyyy}) exceeded by ${Math.abs(monthsRemaining).toFixed(1)} months; ${latest.physical_progress_pct}% complete.`, rawValue: parseFloat(monthsRemaining.toFixed(1)), normalisedScore: Math.round(normScore), weight, weightedContribution: parseFloat(contribution.toFixed(2)), category: 'Schedule', severity: severityFromScore(normScore) };
}

// Indicator 4: Cost Escalation (weight 15)
function calcCostEscalation(obs: PaimanaObservation[]): RiskIndicator {
  const id = 'cost_escalation';
  const latest = obs[obs.length - 1];
  const overrunPct = latest.original_cost_cr > 0 ? ((latest.revised_cost_cr - latest.original_cost_cr) / latest.original_cost_cr) * 100 : 0;
  let momPenalty = 0;
  if (obs.length >= 2) {
    const revisions = obs.slice(1).map((o, i) => Math.abs(o.revised_cost_cr - obs[i].revised_cost_cr)).filter(d => d > 0);
    if (revisions.length > 0) {
      const avg = revisions.reduce((s, d) => s + d, 0) / revisions.length;
      if (avg > latest.original_cost_cr * 0.05) momPenalty = 15; else if (avg > latest.original_cost_cr * 0.01) momPenalty = 8;
    }
  }
  const normScore = clamp(linearNorm(overrunPct, 0, 200) + momPenalty, 0, 100);
  const weight = 15;
  const contribution = (normScore * weight) / 100;
  return { id, label: 'Cost Escalation', description: overrunPct > 0 ? `Revised cost Rs. ${latest.revised_cost_cr.toLocaleString()} Cr is ${overrunPct.toFixed(1)}% above original estimate of Rs. ${latest.original_cost_cr.toLocaleString()} Cr.` : `Cost is within original estimate (orig: Rs. ${latest.original_cost_cr.toLocaleString()} Cr, revised: Rs. ${latest.revised_cost_cr.toLocaleString()} Cr).`, rawValue: parseFloat(overrunPct.toFixed(1)), normalisedScore: Math.round(normScore), weight, weightedContribution: parseFloat(contribution.toFixed(2)), category: 'Cost', severity: severityFromScore(normScore) };
}

// Indicator 5: Physical-Financial Divergence (weight 10)
function calcPhysicalFinancialDivergence(obs: PaimanaObservation[]): RiskIndicator {
  const id = 'phys_fin_divergence';
  const latest = obs[obs.length - 1];
  const expPct = latest.expenditure_pct_of_revised_cost ?? 0;
  const physPct = latest.physical_progress_pct ?? 0;
  const divergence = expPct - physPct;
  let trendPenalty = 0;
  if (obs.length >= 2) {
    const divs = obs.map(o => (o.expenditure_pct_of_revised_cost ?? 0) - (o.physical_progress_pct ?? 0));
    const worsening = divs[divs.length - 1] - divs[0];
    if (worsening > 15) trendPenalty = 15; else if (worsening > 5) trendPenalty = 8;
  }
  const normScore = clamp(linearNorm(divergence, -20, 60) * 80 / 100 + (divergence > 0 ? 10 : 0) + trendPenalty, 0, 100);
  const weight = 10;
  const contribution = (normScore * weight) / 100;
  return { id, label: 'Physical-Financial Divergence', description: divergence > 0 ? `Expenditure (${expPct.toFixed(1)}% of revised cost) exceeds physical progress (${physPct.toFixed(1)}%) by ${divergence.toFixed(1)} pp.` : `Physical progress (${physPct.toFixed(1)}%) is ahead of expenditure (${expPct.toFixed(1)}% of revised cost); gap: ${Math.abs(divergence).toFixed(1)} pp.`, rawValue: parseFloat(divergence.toFixed(1)), normalisedScore: Math.round(normScore), weight, weightedContribution: parseFloat(contribution.toFixed(2)), category: 'Execution', severity: severityFromScore(normScore) };
}

// Indicator 6: Deteriorating Trend (weight 10)
function calcDeterioratingTrend(obs: PaimanaObservation[]): RiskIndicator {
  const id = 'deteriorating_trend';
  if (obs.length < 3) {
    return { id, label: 'Deteriorating Trend', description: 'Insufficient monthly observations to assess progress trend direction.', rawValue: null, normalisedScore: 30, weight: 10, weightedContribution: 3, category: 'Trend', severity: 'low' };
  }
  const deltas: number[] = [];
  for (let i = 1; i < obs.length; i++) deltas.push(obs[i].physical_progress_pct - obs[i - 1].physical_progress_pct);
  const mid = Math.floor(deltas.length / 2);
  const earlyAvg = deltas.slice(0, mid).reduce((s, d) => s + d, 0) / mid;
  const recentAvg = deltas.slice(mid).reduce((s, d) => s + d, 0) / (deltas.length - mid);
  const decel = earlyAvg - recentAvg;
  let normScore: number;
  if (decel <= -5) normScore = 0;
  else if (decel <= 0) normScore = linearNorm(decel + 5, 0, 5) * 30 / 100;
  else if (decel <= 10) normScore = 30 + linearNorm(decel, 0, 10) * 70 / 100;
  else normScore = 100;
  normScore = clamp(normScore, 0, 100);
  const weight = 10;
  const contribution = (normScore * weight) / 100;
  return { id, label: 'Deteriorating Trend', description: decel > 2 ? `Progress decelerated: early ${earlyAvg.toFixed(2)} pp/month vs recent ${recentAvg.toFixed(2)} pp/month (slowdown: ${decel.toFixed(2)} pp/month).` : decel < -2 ? `Progress is accelerating: recent ${recentAvg.toFixed(2)} pp/month vs early ${earlyAvg.toFixed(2)} pp/month.` : `Progress rate stable (early: ${earlyAvg.toFixed(2)} pp/month, recent: ${recentAvg.toFixed(2)} pp/month).`, rawValue: parseFloat(decel.toFixed(3)), normalisedScore: Math.round(normScore), weight, weightedContribution: parseFloat(contribution.toFixed(2)), category: 'Trend', severity: severityFromScore(normScore) };
}

function calcEvidenceConfidence(obsCount: number): number {
  if (obsCount >= 4) return 1.0;
  if (obsCount === 3) return 0.75;
  if (obsCount === 2) return 0.5;
  return 0.25;
}

/**
 * PRISM Risk Tier Bands (canonical specification):
 *   80–100 → CRITICAL
 *   60–79  → HIGH
 *   40–59  → MODERATE
 *   0–39   → LOW
 */
function tierFromScore(score: number): RiskTier {
  if (score >= 80) return 'CRITICAL';
  if (score >= 60) return 'HIGH';
  if (score >= 40) return 'MODERATE';
  return 'LOW';
}

function buildPrimaryConcerns(indicators: RiskIndicator[], obs: PaimanaObservation[]): string[] {
  const concerns: string[] = [];
  const sorted = [...indicators].sort((a, b) => b.weightedContribution - a.weightedContribution);
  for (const ind of sorted.slice(0, 3)) {
    if (ind.severity === 'none' || ind.normalisedScore < 25) continue;
    concerns.push(`[${ind.label}] ${ind.description}`);
  }
  if (concerns.length === 0) {
    const latest = obs[obs.length - 1];
    concerns.push(`Physical progress stands at ${latest.physical_progress_pct}% with no critical risk signals in the Apr-Jul 2026 observation window.`);
  }
  return concerns;
}

export class PRISMRiskEngine {
  /**
   * Calculates the PRISM Risk Index for a project from its monthly observations.
   * Fully deterministic and transparent - no ML model involved.
   *
   * @param observations  Chronologically-ordered PAIMANA monthly snapshots for one project.
   * @returns             Full risk assessment with composite score, tier, indicators, and narrative.
   */
  static assess(observations: PaimanaObservation[]): RiskAssessment {
    if (!observations || observations.length === 0) {
      throw new Error('PRISMRiskEngine.assess() requires at least one observation');
    }
    const obs = [...observations].sort((a, b) => a.report_month.localeCompare(b.report_month));
    const indicators: RiskIndicator[] = [
      calcProgressVelocity(obs),
      calcProgressStagnation(obs),
      calcSchedulePressure(obs),
      calcCostEscalation(obs),
      calcPhysicalFinancialDivergence(obs),
      calcDeterioratingTrend(obs)
    ];
    const totalWeight = indicators.reduce((s, i) => s + i.weight, 0);
    if (totalWeight !== 100) console.warn(`[PRISMRiskEngine] Weights sum to ${totalWeight}, expected 100.`);
    const compositeScore = indicators.reduce((s, i) => s + i.weightedContribution, 0);
    const riskScore = Math.round(clamp(compositeScore, 0, 100));
    const riskTier = tierFromScore(riskScore);
    const evidenceConfidence = calcEvidenceConfidence(obs.length);
    const primaryConcerns = buildPrimaryConcerns(indicators, obs);
    return { riskScore, riskTier, evidenceConfidence, observationCount: obs.length, indicators, primaryConcerns, assessedAt: new Date().toISOString() };
  }
}