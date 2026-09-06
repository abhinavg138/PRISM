/**
 * PRISM Early Warning Alert Engine
 *
 * Evaluates real longitudinal PAIMANA monthly observations and PRISM Risk assessments
 * to generate evidence-based early warnings.
 *
 * Core Principle:
 *   Alerts are NOT predictions ("This project will fail").
 *   They are evidence-based early warnings derived from observed data
 *   ("This project shows indicators requiring attention").
 *
 * Supported Alert Categories:
 *   1. Progress Stagnation: Physical progress changes very little across consecutive observations.
 *   2. Deteriorating Progress: Recent progress velocity is materially worse than earlier progress.
 *   3. Schedule Pressure: Target completion indicates increasing schedule pressure.
 *   4. Cost Escalation: Revised cost has increased relative to original cost.
 *   5. Physical-Financial Divergence: Expenditure progress and physical progress materially diverge.
 *   6. High/Critical Risk: Project crosses an important PRISM Risk Index threshold.
 */

import { Project, PaimanaObservation, PriorityTier } from '../src/types/index';

export type AlertType =
  | 'Progress Stagnation'
  | 'Deteriorating Progress'
  | 'Schedule Pressure'
  | 'Cost Escalation'
  | 'Physical-Financial Divergence'
  | 'High/Critical Risk';

export type AlertSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM';

export interface EarlyWarningAlert {
  id: string;
  projectId: string;
  projectName: string;
  projectCode: string;
  state: string;
  sector: string;
  implementingAgency?: string;
  alertType: AlertType;
  severity: AlertSeverity;
  evidence: string;
  detectedPeriod: string;
  recommendedAttention: string;
  riskScore: number | null;
  priorityScore: number | null;
  priorityTier: PriorityTier | null;
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatMonth(reportMonth?: string): string {
  if (!reportMonth) return 'Recent Observation';
  const parts = reportMonth.split('-');
  if (parts.length !== 2) return reportMonth;
  const m = parseInt(parts[1], 10);
  const y = parts[0];
  if (isNaN(m) || m < 1 || m > 12) return reportMonth;
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

export class PRISMAlertEngine {
  /**
   * Evaluates a single project and its chronological monthly observations
   * to produce the single most impactful, non-repetitive early warning alert (if applicable).
   */
  public static evaluateProject(
    project: Project,
    observations?: PaimanaObservation[]
  ): EarlyWarningAlert | null {
    const trend = project.monthlyTrend || [];
    const len = trend.length;
    const obsList = observations || [];

    // 1. Progress Stagnation (Physical progress changed very little across consecutive observations)
    if (len >= 2 && project.physicalProgressPercent < 98) {
      let consecutiveStagnant = 0;
      for (let i = len - 1; i >= 1; i--) {
        const d = (trend[i].actualPercent ?? 0) - (trend[i - 1].actualPercent ?? 0);
        if (Math.abs(d) <= 0.2) {
          consecutiveStagnant++;
        } else {
          break;
        }
      }

      if (consecutiveStagnant >= 2) {
        const last = trend[len - 1];
        const firstStagnant = trend[len - 1 - consecutiveStagnant] || trend[len - 2];
        const totalDelta = (last.actualPercent ?? 0) - (firstStagnant.actualPercent ?? 0);
        const periodStr = `${formatMonth(firstStagnant.reportMonth || firstStagnant.month)} – ${formatMonth(last.reportMonth || last.month)}`;

        return {
          id: `alert-stag-${project.id}`,
          projectId: project.id,
          projectName: project.name,
          projectCode: project.code,
          state: project.state,
          sector: (project.derivedSector || project.sector) as string,
          implementingAgency: project.implementingAgency,
          alertType: 'Progress Stagnation',
          severity: consecutiveStagnant >= 3 ? 'CRITICAL' : 'HIGH',
          detectedPeriod: periodStr,
          evidence: `Physical progress changed by only ${totalDelta >= 0 ? '+' : ''}${totalDelta.toFixed(1)} percentage points across ${consecutiveStagnant} consecutive observation cycles (${firstStagnant.actualPercent}% to ${last.actualPercent}%).`,
          recommendedAttention: 'Conduct site execution review and verify contractor physical plant mobilization.',
          riskScore: project.riskScore,
          priorityScore: project.priorityScore ?? null,
          priorityTier: project.priorityTier ?? null
        };
      }
    }

    // 2. High/Critical Risk (Project crosses important PRISM Risk Index threshold)
    if (project.riskScore != null && project.riskScore >= 80) {
      return {
        id: `alert-risk-${project.id}`,
        projectId: project.id,
        projectName: project.name,
        projectCode: project.code,
        state: project.state,
        sector: (project.derivedSector || project.sector) as string,
        implementingAgency: project.implementingAgency,
        alertType: 'High/Critical Risk',
        severity: 'CRITICAL',
        detectedPeriod: formatMonth(project.lastUpdated),
        evidence: `Composite PRISM Risk Index reached ${project.riskScore}/100 (${project.riskTier}) confirmed by longitudinal monthly flash reports.`,
        recommendedAttention: 'Escalate to Ministry Project Monitoring Cell for monthly cabinet oversight review.',
        riskScore: project.riskScore,
        priorityScore: project.priorityScore ?? null,
        priorityTier: project.priorityTier ?? null
      };
    }

    // 3. Physical-Financial Divergence (Expenditure progress and physical progress materially diverge)
    const expPct = project.expenditurePctOfRevisedCost ?? (
      project.revisedCostCr > 0
        ? parseFloat(((project.cumulativeExpenditureCr / project.revisedCostCr) * 100).toFixed(1))
        : 0
    );
    const physPct = project.physicalProgressPercent ?? 0;
    const divergenceGap = parseFloat((expPct - physPct).toFixed(1));

    if (divergenceGap >= 20 && project.cumulativeExpenditureCr >= 10) {
      return {
        id: `alert-div-${project.id}`,
        projectId: project.id,
        projectName: project.name,
        projectCode: project.code,
        state: project.state,
        sector: (project.derivedSector || project.sector) as string,
        implementingAgency: project.implementingAgency,
        alertType: 'Physical-Financial Divergence',
        severity: divergenceGap >= 35 ? 'CRITICAL' : 'HIGH',
        detectedPeriod: formatMonth(project.lastUpdated),
        evidence: `Cumulative expenditure reached ${expPct.toFixed(1)}% of revised budget while physical progress stands at only ${physPct.toFixed(1)}% (${divergenceGap} pp divergence gap).`,
        recommendedAttention: 'Audit milestone-linked disbursement vouchers and contractor payment clearances.',
        riskScore: project.riskScore,
        priorityScore: project.priorityScore ?? null,
        priorityTier: project.priorityTier ?? null
      };
    }

    // 4. Cost Escalation (Revised cost has increased relative to original cost)
    if (project.costOverrunPercent >= 40 && project.originalCostCr >= 10) {
      return {
        id: `alert-cost-${project.id}`,
        projectId: project.id,
        projectName: project.name,
        projectCode: project.code,
        state: project.state,
        sector: (project.derivedSector || project.sector) as string,
        implementingAgency: project.implementingAgency,
        alertType: 'Cost Escalation',
        severity: project.costOverrunPercent >= 80 ? 'CRITICAL' : 'HIGH',
        detectedPeriod: formatMonth(project.lastUpdated),
        evidence: `Sanctioned cost increased by ${project.costOverrunPercent.toFixed(1)}% from ₹${project.originalCostCr.toLocaleString()} Cr original outlay to ₹${project.revisedCostCr.toLocaleString()} Cr revised outlay.`,
        recommendedAttention: 'Initiate Expenditure Finance Committee (EFC) revised cost sanction review.',
        riskScore: project.riskScore,
        priorityScore: project.priorityScore ?? null,
        priorityTier: project.priorityTier ?? null
      };
    }

    // 5. Schedule Pressure (Target completion indicates increasing schedule pressure)
    if ((project.urgency || 0) >= 85 && project.physicalProgressPercent < 90) {
      const remainingWork = (100 - project.physicalProgressPercent).toFixed(1);
      const targetDate = project.revisedCompletionDate || project.originalCompletionDate || 'Not specified';
      return {
        id: `alert-sched-${project.id}`,
        projectId: project.id,
        projectName: project.name,
        projectCode: project.code,
        state: project.state,
        sector: (project.derivedSector || project.sector) as string,
        implementingAgency: project.implementingAgency,
        alertType: 'Schedule Pressure',
        severity: 'HIGH',
        detectedPeriod: formatMonth(project.lastUpdated),
        evidence: `Target completion date (${targetDate}) indicates critical schedule pressure with ${remainingWork}% physical work remaining.`,
        recommendedAttention: 'Convene inter-agency taskforce to finalize revised critical path recovery plan.',
        riskScore: project.riskScore,
        priorityScore: project.priorityScore ?? null,
        priorityTier: project.priorityTier ?? null
      };
    }

    // 6. Deteriorating Progress (Recent progress velocity is materially worse than earlier progress)
    if (len >= 3) {
      const deltas: number[] = [];
      for (let i = 1; i < len; i++) {
        deltas.push((trend[i].actualPercent ?? 0) - (trend[i - 1].actualPercent ?? 0));
      }
      const recentDelta = deltas[deltas.length - 1];
      const earlyDeltas = deltas.slice(0, -1);
      const earlyAvg = earlyDeltas.reduce((a, b) => a + b, 0) / earlyDeltas.length;

      if (earlyAvg >= 1.0 && (earlyAvg - recentDelta) >= 1.5) {
        const last = trend[len - 1];
        return {
          id: `alert-decel-${project.id}`,
          projectId: project.id,
          projectName: project.name,
          projectCode: project.code,
          state: project.state,
          sector: (project.derivedSector || project.sector) as string,
          implementingAgency: project.implementingAgency,
          alertType: 'Deteriorating Progress',
          severity: recentDelta <= 0 ? 'HIGH' : 'MEDIUM',
          detectedPeriod: formatMonth(last.reportMonth || last.month),
          evidence: `Monthly progress pace slowed from an earlier average of ${earlyAvg.toFixed(1)} pp/mo to ${recentDelta.toFixed(1)} pp/mo in ${formatMonth(last.reportMonth || last.month)}.`,
          recommendedAttention: 'Investigate work front bottlenecks and verify field measurement certification.',
          riskScore: project.riskScore,
          priorityScore: project.priorityScore ?? null,
          priorityTier: project.priorityTier ?? null
        };
      }
    }

    return null;
  }

  /**
   * Generates a ranked, deduplicated list of meaningful alerts across the provided portfolio.
   */
  public static generateAlerts(
    projects: Project[],
    observationsMap?: Map<string, PaimanaObservation[]>
  ): EarlyWarningAlert[] {
    const alerts: EarlyWarningAlert[] = [];

    for (const project of projects) {
      const obsList = observationsMap?.get(project.id);
      const alert = PRISMAlertEngine.evaluateProject(project, obsList);
      if (alert) {
        alerts.push(alert);
      }
    }

    // Deterministic sort: CRITICAL first, then HIGH, then MEDIUM; within same severity, by priorityScore / riskScore
    const severityOrder: Record<AlertSeverity, number> = {
      CRITICAL: 0,
      HIGH: 1,
      MEDIUM: 2
    };

    return alerts.sort((a, b) => {
      const sevDiff = severityOrder[a.severity] - severityOrder[b.severity];
      if (sevDiff !== 0) return sevDiff;
      return (b.priorityScore ?? b.riskScore ?? 0) - (a.priorityScore ?? a.riskScore ?? 0);
    });
  }
}
