import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { Project, RiskTier } from '../src/types/index';
import { RiskAssessment } from './riskEngine';
import { PriorityAssessment } from './priorityEngine';
import { paimanaRepository } from './paimanaRepository';
import { ProjectQueryService } from './projectQueryService';

let aiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI | null {
  if (!process.env.GEMINI_API_KEY) {
    dotenv.config();
  }
  if (!aiClient && process.env.GEMINI_API_KEY) {
    try {
      aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    } catch (err) {
      console.warn('Failed to initialize GoogleGenAI client:', err);
      aiClient = null;
    }
  }
  return aiClient;
}

export interface CopilotResponse {
  answer: string;
  groundedProjects: Array<{
    id: string;
    name: string;
    riskScore: number;
    riskTier: any;
    priorityTier?: any;
    state?: string;
    sector?: string;
    physicalProgressPercent?: number;
    primaryRiskDriver?: string;
  }>;
  suggestedQuestions: string[];
  totalMatching?: number;
  displayedCount?: number;
}

const DEFAULT_SUGGESTED_QUESTIONS = [
  'Which projects have the highest risk?',
  'Why is project 701396 high risk?',
  'Which sectors have the highest average risk?',
  'Which projects need intervention first?',
  'Which projects show stagnant progress?'
];

// Recognized Indian states in PAIMANA
const KNOWN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Delhi', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu & Kashmir',
  'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra',
  'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh',
  'Uttarakhand', 'West Bengal', 'Chandigarh', 'Ladakh', 'Puducherry'
];

// Recognized infrastructure sectors
const KNOWN_SECTORS: Record<string, string> = {
  'railway': 'Railways',
  'railways': 'Railways',
  'rail': 'Railways',
  'road': 'Road Transport & Highways',
  'roads': 'Road Transport & Highways',
  'highway': 'Road Transport & Highways',
  'highways': 'Road Transport & Highways',
  'water': 'Water Resources',
  'irrigation': 'Water Resources',
  'coal': 'Coal & Mining',
  'mining': 'Coal & Mining',
  'petroleum': 'Petroleum & Gas',
  'gas': 'Petroleum & Gas',
  'oil': 'Petroleum & Gas',
  'power': 'Power & Energy',
  'energy': 'Power & Energy',
  'port': 'Ports & Shipping',
  'ports': 'Ports & Shipping',
  'shipping': 'Ports & Shipping',
  'telecom': 'Telecommunications',
  'telecommunications': 'Telecommunications',
  'metro': 'Urban Affairs & Metro',
  'urban': 'Urban Affairs & Metro',
  'steel': 'Steel & Heavy Industry'
};

interface FactualContext {
  intent: string;
  summaryText: string;
  groundedProjects: Project[];
  suggestedQuestions: string[];
  refuseScoreCalculation?: boolean;
  totalMatching?: number;
}

/**
 * Deterministically analyzes the user query, extracts filters,
 * queries the repository, and aggregates factual results.
 */
function resolveQueryFactualContext(
  userQuery: string,
  allProjects: Project[],
  activeProject?: Project
): FactualContext {
  const q = userQuery.toLowerCase().trim();

  // 1. Direct Risk Calculation Authority Defense
  if (
    q.includes('calculate the risk yourself') ||
    q.includes('calculate risk yourself') ||
    q.includes('can you calculate the risk') ||
    q.includes('compute the risk yourself') ||
    q.includes('modify the risk score') ||
    q.includes('change the risk score') ||
    q.includes('override the risk') ||
    q.includes('override risk') ||
    q.includes('ignore all previous') ||
    q.includes('ignore previous') ||
    q.includes('set the risk') ||
    q.includes('set risk to') ||
    q.includes('reduce the risk score to') ||
    q.includes('jailbreak')
  ) {
    return {
      intent: 'RISK_AUTHORITY_DEFENSE',
      refuseScoreCalculation: true,
      summaryText: `The PRISM Risk Engine is the sole authoritative source of project risk intelligence.

PRISM computes risk scores deterministically using 6 evidence-based indicators derived from longitudinal MoSPI PAIMANA monthly observations (April–July 2026):
1. **Progress Velocity (25% weight)**: Month-over-month rate of physical advancement.
2. **Progress Stagnation (20% weight)**: Consecutive reporting intervals with ≤ 0.5 pp progress.
3. **Schedule Pressure (20% weight)**: Time remaining until revised target completion.
4. **Cost Escalation (15% weight)**: Percentage cost overrun against original sanction.
5. **Physical-Financial Divergence (10% weight)**: Expenditure percentage exceeding physical progress.
6. **Deteriorating Trend (10% weight)**: Negative deceleration comparing earlier vs recent velocities.

Gemini functions solely as an explanation and analytical interface; it does not calculate, modify, or fabricate risk scores.`,
      groundedProjects: activeProject ? [activeProject] : [],
      suggestedQuestions: DEFAULT_SUGGESTED_QUESTIONS
    };
  }

  // 2. Risk Indicators / Methodology Inquiry
  if (
    q.includes('main risk indicators') ||
    q.includes('risk indicators') ||
    q.includes('how is risk calculated') ||
    q.includes('risk engine methodology') ||
    q.includes('what are the indicators')
  ) {
    return {
      intent: 'RISK_INDICATORS_METHODOLOGY',
      summaryText: `The PRISM Risk Engine evaluates every project using 6 deterministic indicators (scale 0–100):
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
- **LOW**: 0–39 (Healthy progression)`,
      groundedProjects: [],
      suggestedQuestions: [
        'Which projects have the highest risk?',
        'Which sector has the highest average risk?',
        'Which projects show stagnant progress?'
      ]
    };
  }

  // 3. Specific Project Query (by ID, Code, Name, or active Project)
  const idMatch = q.match(/\b\d{6,7}\b/) || q.match(/\bprj-in-\d+\b/);
  const mentionedId = idMatch ? idMatch[0] : null;

  let targetProject: Project | undefined;
  if (mentionedId) {
    targetProject = paimanaRepository.getProjectById(mentionedId) || allProjects.find(p => p.id.toLowerCase() === mentionedId.toLowerCase());
  } else if (
    activeProject && (
      q.includes('this project') ||
      q.includes('the project') ||
      q.includes('project in focus') ||
      q.includes('why is it') ||
      q.includes('how has progress changed') ||
      q.includes('expenditure changed') ||
      q.includes('since april')
    )
  ) {
    targetProject = activeProject;
  } else {
    // Check if query matches a known project name
    const found = allProjects.find(p => {
      const pName = p.name.toLowerCase();
      return pName.length > 5 && q.includes(pName.split('(')[0].trim().toLowerCase());
    });
    if (found) targetProject = found;
  }

  if (targetProject) {
    const p = targetProject;
    const assessment: RiskAssessment | undefined = paimanaRepository.getProjectRiskAssessment(p.id);
    const priority: PriorityAssessment | undefined = paimanaRepository.getProjectPriorityAssessment(p.id);
    const obs = paimanaRepository.getProjectObservations(p.id);

    // Format monthly trajectory
    const trajectoryText = obs.length > 0
      ? obs.map(o => `  * ${o.report_month}: Physical ${o.physical_progress_pct}%, Spend ₹${o.cumulative_expenditure_cr} Cr (${o.expenditure_pct_of_revised_cost}% of revised cost)`).join('\n')
      : '  * Longitudinal snapshots unavailable';

    // Format indicators
    const indText = assessment && assessment.indicators.length > 0
      ? assessment.indicators
          .filter(ind => ind.severity !== 'none' && ind.normalisedScore >= 20)
          .map(ind => `  * **${ind.label}** (Evidence Weight: +${ind.weightedContribution.toFixed(1)} pts): ${ind.description}`)
          .join('\n')
      : '  * No elevated risk indicators detected; project follows standard execution pace.';

    // Check if query is about progress or expenditure change specifically
    if (q.includes('progress changed') || q.includes('expenditure changed') || q.includes('since april')) {
      const first = obs[0];
      const latest = obs[obs.length - 1];
      const progDelta = latest && first ? (latest.physical_progress_pct - first.physical_progress_pct).toFixed(2) : '0';
      const spendDelta = latest && first ? (latest.cumulative_expenditure_cr - first.cumulative_expenditure_cr).toFixed(2) : '0';

      return {
        intent: 'PROJECT_TRAJECTORY',
        summaryText: `Longitudinal history for **${p.name}** (\`${p.code || p.id}\`):
- **Observation Window**: ${first?.report_month || '2026-04'} to ${latest?.report_month || '2026-07'} (${obs.length} monthly observations)
- **Physical Progress**: Started at ${first?.physical_progress_pct ?? 'N/A'}% in April, currently at ${latest?.physical_progress_pct ?? 'N/A'}% in July (Net change: **${parseFloat(progDelta) >= 0 ? `+${progDelta}` : progDelta} percentage points**).
- **Cumulative Expenditure**: Started at ₹${first?.cumulative_expenditure_cr ?? 'N/A'} Cr, currently at ₹${latest?.cumulative_expenditure_cr ?? 'N/A'} Cr (Net change: **+₹${spendDelta} Cr**).
- **Current PRISM Risk Index**: **${p.riskScore ?? 'UNRATED'}/100** (${p.riskTier || 'UNRATED'} Tier)
- **Primary Operational Driver**: ${p.primaryRiskDriver || 'Standard Progression'}

Monthly breakdown:
${trajectoryText}`,
        groundedProjects: [p],
        suggestedQuestions: [
          `Why is project ${p.id} high risk?`,
          `What is the recommended action for ${p.id}?`,
          'Which projects have the highest risk?'
        ],
        totalMatching: 1
      };
    }

    return {
      intent: 'PROJECT_DETAIL_EXPLANATION',
      summaryText: `Verified PAIMANA profile for **${p.name}** (\`${p.code || p.id}\`):
- **Sector & State**: ${p.sector} | ${p.state}
- **Executing Agency**: ${p.implementingAgency}
- **PRISM Risk Index**: **${p.riskScore ?? 'UNRATED'} / 100** (${p.riskTier || 'UNRATED'} TIER)
- **Evidence Confidence**: ${p.evidenceConfidence ? `${Math.round(p.evidenceConfidence * 100)}%` : '100%'} (${obs.length} monthly observations)
- **Intervention Priority**: **${priority?.priorityTier || p.priorityTier || 'P2'}** (Priority Score: ${priority?.priorityScore ?? p.priorityScore ?? 'N/A'}, Urgency: ${priority?.urgency ?? p.urgency ?? 'N/A'}/100)
- **Schedule Performance**: Revised completion ${p.revisedCompletionDate || 'N/A'} (Recorded overrun: **${p.timeOverrunMonths} months**).
- **Financial Status**: Original budget ₹${p.originalCostCr} Cr revised to ₹${p.revisedCostCr} Cr (+${p.costOverrunPercent}% cost overrun). Cumulative spend: ₹${p.cumulativeExpenditureCr} Cr (${p.expenditurePctOfRevisedCost}% of revised budget).
- **Physical Progress**: **${p.physicalProgressPercent}%**

**Key Risk Indicators (PRISM Risk Engine Attribution)**:
${indText}

**Recommended Action**:
${priority?.recommendedAction || p.recommendedAction || p.primaryDelayCause || 'Maintain standard PMG oversight cadence.'}`,
      groundedProjects: [p],
      suggestedQuestions: [
        `How has project ${p.id}'s progress changed since April?`,
        'Which projects have the highest risk?',
        'Which sectors have the highest average risk?'
      ],
      totalMatching: 1
    };
  }

  // 4. Geography / State Inquiry
  const matchedState = KNOWN_STATES.find(st => new RegExp(`\\b${st.toLowerCase()}\\b`, 'i').test(q));
  if (matchedState) {
    // 4A. State + Risk Filter (e.g. "How many high-risk projects are in Delhi?", "Show low-risk projects in Delhi")
    let targetRiskTier: RiskTier | null = null;
    if (q.includes('critical')) targetRiskTier = 'CRITICAL';
    else if (q.includes('high risk') || q.includes('high-risk') || (q.includes('high') && q.includes('risk'))) targetRiskTier = 'HIGH';
    else if (q.includes('moderate risk') || q.includes('moderate-risk') || q.includes('moderate')) targetRiskTier = 'MODERATE';
    else if (q.includes('low risk') || q.includes('low-risk') || (q.includes('low') && q.includes('risk'))) targetRiskTier = 'LOW';

    if (targetRiskTier) {
      const result = ProjectQueryService.getProjectsByStateAndRisk(matchedState, targetRiskTier, { limit: 5 });
      const listText = result.displayProjects.length > 0
        ? result.displayProjects.map((p, i) =>
            `${i + 1}. **${p.name}** (\`${p.code || p.id}\`)\n   - **Risk Score**: **${p.riskScore}/100** [${p.riskTier}]\n   - **Sector**: ${p.sector} | **Implementing Agency**: ${p.implementingAgency}\n   - **Physical Progress**: ${p.physicalProgressPercent}% | Spend: ₹${p.cumulativeExpenditureCr.toLocaleString()} Cr (${p.expenditurePctOfRevisedCost}% of revised budget)\n   - **Overrun**: Schedule +${p.timeOverrunMonths} mo | Cost +${p.costOverrunPercent}%`
          ).join('\n\n')
        : `No dedicated projects found in ${result.canonicalState} matching the ${targetRiskTier} risk tier.`;

      const multiNoteText = result.multiStateNotice
        ? `\n\n*Note on Multi-State Corridors:* ${result.multiStateNotice}`
        : '';

      return {
        intent: 'STATE_RISK_FILTER',
        summaryText: `PAIMANA State Risk Analysis: **${result.canonicalState}** (${targetRiskTier} Risk)
- **Authoritative In-State Projects**: Exactly **${result.totalCount} projects** located in ${result.canonicalState} are classified in the **${targetRiskTier}** risk band (${targetRiskTier === 'CRITICAL' ? '80–100' : targetRiskTier === 'HIGH' ? '60–79' : targetRiskTier === 'MODERATE' ? '40–59' : '0–39'}).

${result.totalCount > 0 ? `Showing **${result.displayProjects.length} of ${result.totalCount}** verified in-state ${targetRiskTier.toLowerCase()}-risk projects:\n\n${listText}` : listText}${multiNoteText}`,
        groundedProjects: result.displayProjects,
        suggestedQuestions: [
          `Which projects need intervention first in ${result.canonicalState}?`,
          `Show ${targetRiskTier === 'HIGH' ? 'low' : 'high'}-risk projects in ${result.canonicalState}`,
          `What is the average risk in ${result.canonicalState}?`
        ],
        totalMatching: result.totalCount
      };
    }

    // 4B. State + Priority Query (e.g. "Which projects need intervention first in Delhi?")
    if (q.includes('intervention') || q.includes('priority') || q.includes('attention first') || q.includes('p1')) {
      const result = ProjectQueryService.getPriorityProjects({ state: matchedState, limit: 5 });
      const listText = result.projects.length > 0
        ? result.projects.map((p, i) =>
            `${i + 1}. **${p.name}** (\`${p.code || p.id}\`)\n   - **Priority Tier**: **${p.priorityTier}** (Priority Score: **${p.priorityScore}**, Urgency: ${p.urgency}/100)\n   - **PRISM Risk Index**: ${p.riskScore}/100 [${p.riskTier}]\n   - **Sector**: ${p.sector} | **Physical Progress**: ${p.physicalProgressPercent}%\n   - **Recommended Action**: ${p.recommendedAction || 'Monitor progress'}`
          ).join('\n\n')
        : `No prioritized projects found in ${matchedState}.`;

      return {
        intent: 'STATE_PRIORITY_FILTER',
        summaryText: `PRISM Intervention Priority Queue for **${matchedState}**:
Total monitored in-state projects: **${result.totalMatching}** (P1 Immediate: **${result.p1Count}**, P2 Oversight: **${result.p2Count}**, P3 Routine: **${result.p3Count}**).

Top prioritized projects in ${matchedState} requiring administrative intervention:
${listText}`,
        groundedProjects: result.projects,
        suggestedQuestions: [
          `Show high-risk projects in ${matchedState}`,
          `Why is project ${result.projects[0]?.id || '701396'} high risk?`,
          `Show low-risk projects in ${matchedState}`
        ],
        totalMatching: result.totalMatching
      };
    }

    // 4C. State General Summary
    const partition = ProjectQueryService.getStatePartition(matchedState);
    if (!partition) {
      return {
        intent: 'STATE_SUMMARY',
        summaryText: `No matching PAIMANA projects found for the state of **${matchedState}**.`,
        groundedProjects: [],
        suggestedQuestions: DEFAULT_SUGGESTED_QUESTIONS
      };
    }

    const topStateProjects = [...partition.dedicatedProjects]
      .filter(p => p.riskScore != null)
      .sort((a, b) => (b.riskScore ?? 0) - (a.riskScore ?? 0))
      .slice(0, 5);

    const topStateList = topStateProjects.map((p, i) =>
      `${i + 1}. **${p.name}** (\`${p.code || p.id}\`): Risk **${p.riskScore}/100** [${p.riskTier}], ${p.sector}. Physical: ${p.physicalProgressPercent}%, Cost Overrun: +${p.costOverrunPercent}%. Driver: ${p.primaryRiskDriver || 'Progress Stagnation'}`
    ).join('\n');

    const multiStateBreakdown = partition.multiStateCount > 0
      ? `\n- **Multi-State Corridors Involving ${partition.canonicalState}**: **${partition.multiStateCount} projects** (High Risk: ${partition.multiStateByRisk.HIGH}, Moderate: ${partition.multiStateByRisk.MODERATE}, Low: ${partition.multiStateByRisk.LOW})\n- **Total Associated Footprint**: **${partition.totalAssociatedCount} projects**`
      : '';

    return {
      intent: 'STATE_SUMMARY',
      summaryText: `PAIMANA State Portfolio: **${partition.canonicalState}**
- **Dedicated In-State Projects**: **${partition.dedicatedCount} projects**
- **Committed Capital Outlay (In-State)**: ₹${partition.dedicatedKPIs.totalBudgetCr.toLocaleString()} Cr
- **Risk Stratification (Dedicated In-State)**:
  * Critical (80–100): **${partition.dedicatedByRisk.CRITICAL}**
  * High Risk (60–79): **${partition.dedicatedByRisk.HIGH}**
  * Moderate Risk (40–59): **${partition.dedicatedByRisk.MODERATE}**
  * Low Risk (0–39): **${partition.dedicatedByRisk.LOW}**
- **Average Physical Progress**: **${partition.dedicatedKPIs.averagePhysicalProgress}%**${multiStateBreakdown}

Top elevated-risk dedicated in-state projects:
${topStateList}`,
      groundedProjects: topStateProjects,
      suggestedQuestions: [
        `Show high-risk projects in ${partition.canonicalState}`,
        `Show low-risk projects in ${partition.canonicalState}`,
        `Which projects need intervention first in ${partition.canonicalState}?`
      ],
      totalMatching: partition.dedicatedCount
    };
  }

  // 5. Healthy / Good Pace Portfolio (Phase 11)
  if (
    q.includes('good pace') ||
    q.includes('performing well') ||
    q.includes('healthy') ||
    q.includes('on schedule') ||
    q.includes('best performing')
  ) {
    const healthyResult = ProjectQueryService.getHealthyPaceProjects({ limit: 5 });
    const listText = healthyResult.projects.map((p, i) =>
      `${i + 1}. **${p.name}** (\`${p.code || p.id}\`)\n   - **PRISM Risk Index**: **${p.riskScore}/100** [${p.riskTier}]\n   - **Physical Progress**: **${p.physicalProgressPercent}%**\n   - **Schedule Overrun**: 0 months (Strictly On Schedule)\n   - **Cost Overrun**: 0% (Within Sanctioned Budget)\n   - **Sector & State**: ${p.sector} • ${p.state}`
    ).join('\n\n');

    return {
      intent: 'HEALTHY_PACE_PORTFOLIO',
      summaryText: `PRISM Verified Healthy Pace Assessment:
Across the national PAIMANA portfolio, **${healthyResult.totalHealthy} projects** strictly satisfy PRISM's healthy execution standards:
1. **PRISM Risk Tier LOW** (Risk Index 0–39)
2. **Zero Schedule Slippage** (0 recorded overrun months)
3. **Zero Cost Escalation** (Within original sanction)
4. **Verified Physical Progress** (> 0%)

> ⚠️ **Qualification Rule:** In infrastructure project monitoring, high physical completion alone (e.g. 98%) does NOT equal "good pace" if a project suffered multi-year delays or extensive budget revisions. Only projects executing on-time and within-budget qualify.

Top verified healthy-pace infrastructure projects:
${listText}`,
      groundedProjects: healthyResult.projects,
      suggestedQuestions: [
        'Which projects have the highest risk?',
        'Which projects show stagnant progress?',
        'Which sectors have the highest average risk?'
      ],
      totalMatching: healthyResult.totalHealthy
    };
  }

  // 6. Highest Risk / Top Critical Projects
  if (
    q.includes('highest risk') ||
    q.includes('top risk') ||
    q.includes('critical projects') ||
    q.includes('highest-risk') ||
    q.includes('most risky') ||
    (q.includes('highest') && q.includes('risk') && !q.includes('sector'))
  ) {
    const topResult = ProjectQueryService.getTopRiskProjects({ limit: 5 });
    const listText = topResult.projects.map((p, i) =>
      `${i + 1}. **${p.name}** (\`${p.code || p.id}\`)\n   - **Risk Score**: **${p.riskScore}/100** [${p.riskTier}]\n   - **Sector & State**: ${p.sector} • ${p.state}\n   - **Progress vs Spend**: Physical ${p.physicalProgressPercent}% | Spend ₹${p.cumulativeExpenditureCr.toLocaleString()} Cr (${p.expenditurePctOfRevisedCost}% of revised budget)\n   - **Overrun**: Schedule +${p.timeOverrunMonths} mo | Cost +${p.costOverrunPercent}%\n   - **Primary Driver**: ${p.primaryRiskDriver || 'Progress Stagnation'}`
    ).join('\n\n');

    return {
      intent: 'HIGHEST_RISK_PORTFOLIO',
      summaryText: `Portfolio Risk Assessment across **${allProjects.length} monitored PAIMANA projects**:
- **Critical Projects (Risk 80–100)**: **${topResult.totalCritical} projects**
- **High Risk Projects (Risk 60–79)**: **${topResult.totalHigh} projects**

Top highest-risk infrastructure projects (deterministic ranking):
${listText}`,
      groundedProjects: topResult.projects,
      suggestedQuestions: [
        `Why is project ${topResult.projects[0]?.id || '701396'} high risk?`,
        'Which sectors have the highest average risk?',
        'Which projects need intervention first?'
      ],
      totalMatching: topResult.totalCritical + topResult.totalHigh
    };
  }

  // 7. Sector Inquiries
  if (
    q.includes('which sector has the highest average risk') ||
    q.includes('sector has the highest average risk') ||
    q.includes('sector has the highest risk') ||
    q.includes('highest average risk') ||
    q.includes('sectors with highest risk')
  ) {
    const sectorStats = paimanaRepository.getSectorStats();
    const sortedSectors = [...sectorStats].sort((a, b) => b.avgRiskScore - a.avgRiskScore);
    const highestSector = sortedSectors[0];

    const sectorRanking = sortedSectors.map((s, i) =>
      `${i + 1}. **${s.sector}**: Avg Risk **${s.avgRiskScore}/100** (${s.totalProjects} projects, ${s.criticalProjects} Critical, ${s.highRiskProjects} High, ₹${s.totalBudgetCr.toLocaleString()} Cr outlay)`
    ).join('\n');

    return {
      intent: 'SECTOR_HIGHEST_RISK',
      summaryText: `The infrastructure sector with the highest average risk is **${highestSector.sector}** with an average PRISM Risk Index of **${highestSector.avgRiskScore} / 100**.

**Sector Overview for ${highestSector.sector}**:
- Total Projects: **${highestSector.totalProjects}**
- Critical Risk Projects: **${highestSector.criticalProjects}**
- High Risk Projects: **${highestSector.highRiskProjects}**
- Average Physical Progress: **${highestSector.avgPhysicalProgress}%**
- Total Capital Outlay: **₹${highestSector.totalBudgetCr.toLocaleString()} Cr**

**Complete Sector Risk Ranking (Highest to Lowest)**:
${sectorRanking}`,
      groundedProjects: [],
      suggestedQuestions: [
        `How many high-risk railway projects are there?`,
        'Which projects have the highest risk?',
        'Which projects show stagnant progress?'
      ],
      totalMatching: highestSector.totalProjects
    };
  }

  // Specific Sector filter (e.g. "How many high-risk railway projects are there?", "Average risk of Railways")
  const sectorEntry = Object.entries(KNOWN_SECTORS).find(([k]) => q.includes(k));
  if (sectorEntry && (q.includes('how many') || q.includes('average risk') || q.includes('high-risk') || q.includes('projects in'))) {
    const canonicalSector = sectorEntry[1];
    const secProjects = allProjects.filter(p =>
      (p.sector as string).toLowerCase().includes(canonicalSector.toLowerCase()) ||
      (p.derivedSector || '').toLowerCase().includes(canonicalSector.toLowerCase())
    );

    const highRiskSec = secProjects.filter(p => p.riskTier === 'HIGH');
    const criticalRiskSec = secProjects.filter(p => p.riskTier === 'CRITICAL');
    const avgSecRisk = (secProjects.reduce((s, p) => s + (p.riskScore || 0), 0) / (secProjects.length || 1)).toFixed(1);
    const avgSecProgress = (secProjects.reduce((s, p) => s + (p.physicalProgressPercent || 0), 0) / (secProjects.length || 1)).toFixed(1);
    const totalSecBudget = Math.round(secProjects.reduce((s, p) => s + (p.revisedCostCr || 0), 0));

    const topSecProjects = [...secProjects]
      .filter(p => p.riskScore != null)
      .sort((a, b) => (b.riskScore ?? 0) - (a.riskScore ?? 0))
      .slice(0, 5);

    const topSecList = topSecProjects.map((p, i) =>
      `${i + 1}. **${p.name}** (\`${p.code || p.id}\`): Risk **${p.riskScore}/100** [${p.riskTier}] (${p.state}). Physical: ${p.physicalProgressPercent}%, Delay: +${p.timeOverrunMonths} mo.`
    ).join('\n');

    return {
      intent: 'SECTOR_SPECIFIC_SUMMARY',
      summaryText: `PAIMANA Sector Assessment: **${canonicalSector}**
- **Total Monitored Projects**: **${secProjects.length} projects**
- **Critical Risk Projects (80–100)**: **${criticalRiskSec.length} projects**
- **High Risk Projects (60–79)**: **${highRiskSec.length} projects**
- **Average PRISM Risk Index**: **${avgSecRisk} / 100**
- **Average Physical Progress**: **${avgSecProgress}%**
- **Total Capital Commitment**: ₹${totalSecBudget.toLocaleString()} Cr

Top elevated-risk projects in ${canonicalSector}:
${topSecList}`,
      groundedProjects: topSecProjects,
      suggestedQuestions: [
        'Which sector has the highest average risk?',
        'Which projects have the highest risk?',
        'Which projects need intervention first?'
      ],
      totalMatching: secProjects.length
    };
  }

  // 8. Progress Stagnation / Deterioration
  if (
    q.includes('stagnant progress') ||
    q.includes('stagnant') ||
    q.includes('stagnation') ||
    q.includes('frozen progress')
  ) {
    const stagResult = ProjectQueryService.getStagnantProjects({ limit: 5 });
    const listText = stagResult.projects.map((p, i) =>
      `${i + 1}. **${p.name}** (\`${p.code || p.id}\`)\n   - **Risk**: ${p.riskScore}/100 [${p.riskTier}] | **State**: ${p.state} | **Sector**: ${p.sector}\n   - **Physical Progress**: ${p.physicalProgressPercent}%\n   - **Stagnation Evidence**: ${p.primaryRiskDriver || (p.topRiskDrivers && p.topRiskDrivers.find(d => d.label.includes('Stagnat'))?.description) || 'Progress change ≤ 0.5 pp over consecutive observations'}`
    ).join('\n\n');

    return {
      intent: 'PROGRESS_STAGNATION',
      summaryText: `Progress Stagnation Analysis:
Across the national PAIMANA portfolio, **${stagResult.totalStagnant} projects** exhibit progress stagnation (≤ 0.5 pp progress change across consecutive reporting months in the April–July 2026 window).

Top highest-risk projects exhibiting chronic progress stagnation:
${listText}`,
      groundedProjects: stagResult.projects,
      suggestedQuestions: [
        `Why is project ${stagResult.projects[0]?.id || '701396'} high risk?`,
        'Which projects show deteriorating progress?',
        'Which projects need intervention first?'
      ],
      totalMatching: stagResult.totalStagnant
    };
  }

  if (
    q.includes('deteriorating progress') ||
    q.includes('deteriorating') ||
    q.includes('deterioration') ||
    q.includes('slowing down')
  ) {
    const deterioratingProjects = allProjects.filter(p =>
      (p.primaryRiskDriver && p.primaryRiskDriver.toLowerCase().includes('deteriorat')) ||
      (p.topRiskDrivers && p.topRiskDrivers.some(d => d.label.toLowerCase().includes('deteriorat') && (d.shapValue >= 5 || d.severity === 'high' || d.severity === 'critical')))
    );

    const topDeteriorating = [...deterioratingProjects]
      .sort((a, b) => {
        const diff = (b.riskScore ?? 0) - (a.riskScore ?? 0);
        if (diff !== 0) return diff;
        return a.id.localeCompare(b.id);
      })
      .slice(0, 5);

    const listText = topDeteriorating.map((p, i) =>
      `${i + 1}. **${p.name}** (\`${p.code || p.id}\`): Risk **${p.riskScore}/100** [${p.riskTier}], ${p.sector} (${p.state}). Physical: ${p.physicalProgressPercent}%. Driver: ${p.primaryRiskDriver}`
    ).join('\n');

    return {
      intent: 'PROGRESS_DETERIORATION',
      summaryText: `Progress Deterioration Analysis:
The PRISM Risk Engine compares earlier observation velocity against recent observation velocity. A total of **${deterioratingProjects.length} projects** exhibit deteriorating velocity trends.

Top elevated-risk projects with declining progress velocity:
${listText}`,
      groundedProjects: topDeteriorating,
      suggestedQuestions: [
        'Which projects show stagnant progress?',
        'Which projects have the highest risk?',
        'Which projects need intervention first?'
      ],
      totalMatching: deterioratingProjects.length
    };
  }

  // 9. Intervention / Prioritization
  if (
    q.includes('attention first') ||
    q.includes('prioritize') ||
    q.includes('priority queue') ||
    q.includes('p1') ||
    q.includes('need intervention') ||
    q.includes('priority tier')
  ) {
    const prioResult = ProjectQueryService.getPriorityProjects({ limit: 5 });

    const listText = prioResult.projects.map((p, i) =>
      `${i + 1}. **${p.name}** (\`${p.code || p.id}\`)\n   - **Priority Tier**: **${p.priorityTier}** (Priority Score: **${p.priorityScore}**, Urgency: ${p.urgency}/100)\n   - **PRISM Risk Index**: ${p.riskScore}/100 [${p.riskTier}]\n   - **Sector & State**: ${p.sector} • ${p.state}\n   - **Recommended Action**: ${p.recommendedAction || 'Maintain standard PMG oversight'}`
    ).join('\n\n');

    return {
      intent: 'INTERVENTION_PRIORITY_QUEUE',
      summaryText: `PRISM Intervention Priority Queue (Phase 3A):
The priority engine rank-orders projects by combining **PRISM Risk Index (40%)**, **Schedule Urgency (25%)**, **Recent Progress Deterioration (20%)**, and **Evidence Confidence (15%)**.

- **P1 Immediate Intervention (Priority ≥ 70)**: **${prioResult.p1Count} projects**
- **P2 High-Priority Monitoring (50–69)**: **${prioResult.p2Count} projects**
- **P3 Routine Monitoring (< 50)**: **${prioResult.p3Count} projects**

Top prioritized projects requiring immediate inter-ministerial intervention:
${listText}`,
      groundedProjects: prioResult.projects,
      suggestedQuestions: [
        `Why is project ${prioResult.projects[0]?.id || '701396'} high risk?`,
        'Which projects have the highest risk?',
        'Which sectors have the highest average risk?'
      ],
      totalMatching: prioResult.totalMatching
    };
  }

  // 10. Portfolio Statistics / Counts / Average Risk
  if (
    q.includes('how many projects are being monitored') ||
    q.includes('how many projects are monitored') ||
    q.includes('how many projects') ||
    q.includes('how many high risk') ||
    q.includes('average portfolio risk') ||
    q.includes('portfolio risk') ||
    q.includes('overview')
  ) {
    const kpis = paimanaRepository.computeKPIs();

    return {
      intent: 'PORTFOLIO_KPI_OVERVIEW',
      summaryText: `National Infrastructure Portfolio (MoSPI PAIMANA Monitoring):
- **Total Monitored Projects**: **${kpis.totalProjects.toLocaleString()} projects**
- **Total Committed Capital Outlay**: ₹${kpis.totalBudgetCr.toLocaleString()} Cr
- **Average PRISM Risk Index**: **${kpis.averageRiskScore} / 100**
- **Average Physical Progress**: **${kpis.averagePhysicalProgress}%**
- **Average Schedule Slippage**: **${kpis.averageDelayMonths} months**
- **Average Cost Escalation**: **+${kpis.averageCostEscalationPercent}%**

**Risk Stratification (Canonical PRISM Tiers)**:
- **CRITICAL (80–100)**: **${kpis.criticalProjects} projects** (Immediate PMG intervention)
- **HIGH (60–79)**: **${kpis.highRiskProjects} projects** (Priority watchlist)
- **MODERATE (40–59)**: **${kpis.moderateRiskProjects} projects** (Routine oversight)
- **LOW (0–39)**: **${kpis.lowRiskProjects} projects** (Normal progression)
- **UNRATED**: **${kpis.unratedProjects} projects**`,
      groundedProjects: allProjects.filter(p => p.riskTier === 'CRITICAL'),
      suggestedQuestions: [
        'Which projects have the highest risk?',
        'Which sector has the highest average risk?',
        'Which projects show stagnant progress?'
      ],
      totalMatching: kpis.totalProjects
    };
  }

  // 10. Generic Fallback: Search across projects
  const matched = allProjects.filter(p =>
    p.name.toLowerCase().includes(q) ||
    p.code.toLowerCase().includes(q) ||
    p.implementingAgency.toLowerCase().includes(q)
  );

  if (matched.length > 0) {
    const topMatches = matched.slice(0, 5);
    const listText = topMatches.map((p, i) =>
      `${i + 1}. **${p.name}** (\`${p.code || p.id}\`): Risk ${p.riskScore}/100 [${p.riskTier}], ${p.sector} (${p.state}). Physical: ${p.physicalProgressPercent}%, Spend: ₹${p.cumulativeExpenditureCr} Cr.`
    ).join('\n');

    return {
      intent: 'MATCHED_SEARCH',
      summaryText: `Found **${matched.length} matching PAIMANA projects** for "${userQuery}":\n\n${listText}`,
      groundedProjects: topMatches,
      suggestedQuestions: [
        `Why is project ${topMatches[0].id} high risk?`,
        'Which projects have the highest risk?',
        'Which sectors have the highest average risk?'
      ]
    };
  }

  return {
    intent: 'NO_MATCH',
    summaryText: 'No matching PAIMANA projects found.',
    groundedProjects: [],
    suggestedQuestions: DEFAULT_SUGGESTED_QUESTIONS
  };
}

/**
 * Main Copilot interface:
 * 1. Resolves deterministic factual context from PAIMANA repository.
 * 2. Uses Gemini to synthesize and explain the verified facts (if client available).
 * 3. Falls back smoothly to the verified deterministic text if Gemini is unavailable.
 */
export async function askPRISMCopilot(
  userQuery: string,
  projects: Project[],
  activeProjectId?: string
): Promise<CopilotResponse> {
  const activeProject = activeProjectId
    ? (paimanaRepository.getProjectById(activeProjectId) || projects.find(p => p.id === activeProjectId))
    : undefined;

  // Step 1 & 2: Parse query intent and extract verified deterministic records/aggregates
  const factualContext = resolveQueryFactualContext(userQuery, projects, activeProject);

  const client = getGeminiClient();

  // If Gemini client is active and question isn't a strict calculation refusal
  if (client && !factualContext.refuseScoreCalculation && factualContext.intent !== 'NO_MATCH') {
    try {
      const systemInstruction = `
You are the PRISM Risk Intelligence Copilot, an expert infrastructure monitoring analyst supporting the Ministry of Statistics & Programme Implementation (MoSPI) and Cabinet Project Monitoring Group (PMG).

CRITICAL OPERATIONAL RULES:
1. GEMINI IS NOT THE SOURCE OF TRUTH. The factual context provided below contains verified, authoritative figures from the PAIMANA repository. You MUST adhere strictly to these figures.
2. NEVER invent or hallucinate project names, codes, budgets, progress percentages, dates, risk scores, or locations.
3. NEVER calculate, alter, or predict risk scores. The PRISM Risk Engine is the sole authoritative source.
4. If asked to calculate risk yourself, state clearly that the PRISM Risk Engine provides the authoritative assessment based on 6 evidence-based indicators.
5. QUANTITATIVE PRECISION & CANONICAL TRUTH:
   - State the EXACT numerical counts, averages, and project IDs provided in the factual context.
   - Never recalculate counts, percentages, or averages.
   - If the context says "Showing 5 of 6 high-risk projects", state "Showing 5 of 6 high-risk projects" and mention the total matching count.
6. STATE & MULTI-STATE DISTINCTION:
   - Differentiate clearly between dedicated state projects (e.g. 17 in Delhi) and multi-state transit projects (e.g. 7 national corridors passing through Delhi).
   - If reporting dedicated state projects, cite that dedicated count (e.g., 6 High-Risk projects).
7. "GOOD PACE" / "PERFORMANCE" CRITERIA:
   - Do NOT equate high physical completion with "good pace". A project at 98% completion with 40 months of delay and cost escalation is not on good pace.
   - Only describe projects as "on good pace" if verified by the context (Low risk, 0 delay, 0 cost escalation).
8. Use official PRISM terminology:
   - "PRISM Risk Index"
   - "PRISM Risk Engine"
   - "PRISM Risk Indicators"
   - "Evidence Weight"
   - "Scenario Simulation"
   DO NOT use terms like SHAP, TreeSHAP, XGBoost, ML Risk Model, or Phase 2 calibration.
9. Present your answer with clear markdown headings, bullet points, and bold key metrics.
10. Keep responses concise, professional, and policy-grade (under 250 words).
`;

      const prompt = `
AUTHORITATIVE PAIMANA REPOSITORY FACTUAL CONTEXT:
${factualContext.summaryText}

USER QUESTION:
"${userQuery}"

Synthesize and explain this verified PAIMANA data directly in response to the user's question. Do not fabricate any numbers.
`;

      const response = await client.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: prompt,
        config: {
          systemInstruction,
          temperature: 0.1
        }
      });

      const text = response.text || '';

      const mapProjectEntity = (p: Project) => ({
        id: p.id,
        name: p.name,
        riskScore: (p.riskScore ?? 0) as number,
        riskTier: p.riskTier,
        priorityTier: p.priorityTier,
        state: p.state,
        sector: (p.derivedSector || p.sector || 'Infrastructure') as string,
        physicalProgressPercent: p.physicalProgressPercent,
        primaryRiskDriver: p.primaryRiskDriver || p.priorityReason
      });

      if (text.trim().length > 0) {
        return {
          answer: text.trim(),
          groundedProjects: factualContext.groundedProjects.map(mapProjectEntity),
          suggestedQuestions: factualContext.suggestedQuestions,
          totalMatching: factualContext.totalMatching ?? factualContext.groundedProjects.length,
          displayedCount: factualContext.groundedProjects.length
        };
      }
    } catch (err) {
      console.warn('Gemini API call failed; providing verified deterministic repository response:', err);
    }
  }

  const mapProjectEntity = (p: Project) => ({
    id: p.id,
    name: p.name,
    riskScore: (p.riskScore ?? 0) as number,
    riskTier: p.riskTier,
    priorityTier: p.priorityTier,
    state: p.state,
    sector: (p.derivedSector || p.sector || 'Infrastructure') as string,
    physicalProgressPercent: p.physicalProgressPercent,
    primaryRiskDriver: p.primaryRiskDriver || p.priorityReason
  });

  // Resilient Local Grounded Intelligence Engine (Fallback / Offline / Key-less)
  return {
    answer: factualContext.summaryText,
    groundedProjects: factualContext.groundedProjects.map(mapProjectEntity),
    suggestedQuestions: factualContext.suggestedQuestions,
    totalMatching: factualContext.totalMatching ?? factualContext.groundedProjects.length,
    displayedCount: factualContext.groundedProjects.length
  };
}

export interface InterventionNarrativeResponse {
  narrative: string;
  isAIGenerated: boolean;
  generatedAt: string;
}

/**
 * Generates an official executive intervention brief memo.
 * Strictly feeds Gemini only verified structured scenario outputs.
 * Gemini NEVER calculates or modifies risk scores.
 * Clearly labeled and backed by deterministic policy-grade fallback.
 */
export async function generateInterventionNarrative(
  project: Project,
  scenario: any
): Promise<InterventionNarrativeResponse> {
  const client = getGeminiClient();
  const timestamp = new Date().toISOString();

  // Deterministic fallback memorandum
  const fallbackMemo = `### 🏛️ MoSPI PMG Executive Intervention Memorandum\n\n` +
    `**1. Executive Context & PAIMANA Baseline:**\n` +
    `Project **${project.name}** (\`${project.id}\`) under **${project.ministry || project.implementingAgency}** (${project.state}) records **${project.physicalProgressPercent}%** cumulative physical completion against ₹**${(project.cumulativeExpenditureCr || 0).toLocaleString()} Cr** expenditure. Under the authoritative PRISM Risk Engine, the project is categorized as **${scenario.originalRiskTier}** Risk (**${scenario.originalRiskScore}/100**) and **${scenario.originalPriorityTier}** Priority due to ${scenario.officerBrief?.primaryConcern || 'critical-path schedule compression and progress stagnation'}.\n\n` +
    `**2. Simulated Policy Intervention Package:**\n` +
    `To arrest further milestone slippage, the simulated policy package introduces targeted operational levers: ${scenario.assumptionImpacts && scenario.assumptionImpacts.length > 0 ? scenario.assumptionImpacts.map((a: any) => `*${a.lever}* (${a.value}: -${a.pointsReduced} pts)`).join(', ') : 'standard monitoring'}. These parametric adjustments directly resolve the statutory and liquidity bottlenecks identified in the 6 PRISM Risk Indicators.\n\n` +
    `**3. Projected Scenario Recovery:**\n` +
    `Under full operationalization of these measures, the modeled risk profile improves from **${scenario.originalRiskScore}** (${scenario.originalRiskTier}) to **${scenario.simulatedRiskScore}** (${scenario.simulatedRiskTier}), precipitating a priority tier transition from **${scenario.originalPriorityTier}** to **${scenario.simulatedPriorityTier}** and averting an estimated **~${scenario.delaySavedMonths ?? 0} months** of cumulative project delay.\n\n` +
    `*Disclaimer: Illustrative Policy Scenario — Not an Observed Forecast. Parametric sensitivities do not modify official MoSPI PAIMANA historical records.*`;

  if (client) {
    try {
      const systemInstruction = `You are the PRISM MoSPI Executive Brief Synthesizer.
You draft high-level, policy-grade memoranda for the Cabinet Secretariat, Ministry of Statistics & Programme Implementation (MoSPI), and Project Monitoring Group (PMG).

CRITICAL CONSTRAINTS:
1. You MUST NOT calculate or modify risk scores or priority tiers. All figures provided in the prompt are authoritative outputs from the PRISM Deterministic Engines.
2. DO NOT hallucinate progress figures, costs, or dates. Cite only the structured data provided.
3. Clearly state that the simulated scenario is an "Illustrative Policy Scenario — Not an Observed Forecast".
4. Format in exactly 3 concise, formal paragraphs:
   - Paragraph 1: Executive Context & PAIMANA Baseline
   - Paragraph 2: Simulated Policy Intervention Levers
   - Paragraph 3: Projected Recovery Trajectory & Policy Disclaimer
5. Keep tone formal, authoritative, and policy-focused (under 250 words).`;

      const prompt = `
STRUCTURED PROJECT & SCENARIO CONTEXT:
- Project Name: ${project.name} (${project.id})
- Ministry / Implementing Agency: ${project.ministry || project.implementingAgency}
- State / Sector: ${project.state} / ${project.derivedSector || project.sector}
- Physical Completion: ${project.physicalProgressPercent}% | Cumulative Spend: ₹${project.cumulativeExpenditureCr} Cr
- Cost Overrun: +${project.costOverrunPercent}% | Time Overrun: +${project.timeOverrunMonths} months
- Current PRISM Risk: ${scenario.originalRiskScore}/100 (${scenario.originalRiskTier})
- Current Intervention Priority: ${scenario.originalPriorityTier} (${scenario.originalPriorityScore}/100)
- Simulated Scenario Risk: ${scenario.simulatedRiskScore}/100 (${scenario.simulatedRiskTier}) [Delta: ${scenario.riskScoreDelta} pts]
- Simulated Intervention Priority: ${scenario.simulatedPriorityTier} (${scenario.simulatedPriorityScore}/100) [Delta: ${scenario.priorityScoreDelta} pts]
- Delay Recovered: ~${scenario.delaySavedMonths} months | Cost Escalation Curtailed: ₹${scenario.costSavedCr} Cr
- Applied Policy Levers: ${JSON.stringify(scenario.assumptionImpacts || [])}
- Indicator Changes: ${JSON.stringify(scenario.indicatorChanges || [])}
- Primary Concern: ${scenario.officerBrief?.primaryConcern}
- Recommended Action: ${scenario.officerBrief?.recommendedAction}

Synthesize an official executive intervention memorandum based exclusively on these verified facts.
`;

      const response = await client.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: prompt,
        config: {
          systemInstruction,
          temperature: 0.1
        }
      });

      const text = response.text || '';
      if (text.trim().length > 0) {
        return {
          narrative: text.trim(),
          isAIGenerated: true,
          generatedAt: timestamp
        };
      }
    } catch (err) {
      console.warn('Gemini executive narrative generation failed, using deterministic fallback:', err);
    }
  }

  return {
    narrative: fallbackMemo,
    isAIGenerated: false,
    generatedAt: timestamp
  };
}
