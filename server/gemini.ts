import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { Project } from '../src/types/index';
import { RiskAssessment } from './riskEngine';
import { PriorityAssessment } from './priorityEngine';
import { paimanaRepository } from './paimanaRepository';

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
  groundedProjects: Array<{ id: string; name: string; riskScore: number; riskTier: any }>;
  suggestedQuestions: string[];
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
    q.includes('change the risk score')
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
        ]
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
      ]
    };
  }

  // 4. Highest Risk / Top Critical Projects
  if (
    q.includes('highest risk') ||
    q.includes('top risk') ||
    q.includes('critical projects') ||
    q.includes('highest-risk') ||
    q.includes('most risky') ||
    (q.includes('highest') && q.includes('risk') && !q.includes('sector'))
  ) {
    const sorted = [...allProjects]
      .filter(p => p.riskScore != null)
      .sort((a, b) => (b.riskScore ?? 0) - (a.riskScore ?? 0));

    const criticalCount = allProjects.filter(p => p.riskTier === 'CRITICAL').length;
    const highCount = allProjects.filter(p => p.riskTier === 'HIGH').length;
    const topProjects = sorted.slice(0, 5);

    const listText = topProjects.map((p, i) =>
      `${i + 1}. **${p.name}** (\`${p.code || p.id}\`)\n   - **Risk Score**: **${p.riskScore}/100** [${p.riskTier}]\n   - **Sector & State**: ${p.sector} • ${p.state}\n   - **Progress vs Spend**: Physical ${p.physicalProgressPercent}% | Spend ₹${p.cumulativeExpenditureCr} Cr (${p.expenditurePctOfRevisedCost}% of revised cost)\n   - **Overrun**: Schedule +${p.timeOverrunMonths} mo | Cost +${p.costOverrunPercent}%\n   - **Primary Driver**: ${p.primaryRiskDriver || (p.topRiskDrivers && p.topRiskDrivers[0]?.label) || 'Progress Stagnation'}`
    ).join('\n\n');

    return {
      intent: 'HIGHEST_RISK_PORTFOLIO',
      summaryText: `Portfolio Risk Assessment across **${allProjects.length} monitored PAIMANA projects**:
- **Critical Projects (Risk 80–100)**: **${criticalCount} projects**
- **High Risk Projects (Risk 60–79)**: **${highCount} projects**

Top highest-risk infrastructure projects:
${listText}`,
      groundedProjects: topProjects,
      suggestedQuestions: [
        `Why is project ${topProjects[0]?.id || '701396'} high risk?`,
        'Which sectors have the highest average risk?',
        'Which projects need intervention first?'
      ]
    };
  }

  // 5. Geography / State Inquiry
  const matchedState = KNOWN_STATES.find(st => q.includes(st.toLowerCase()));
  if (matchedState) {
    const inStateProjects = allProjects.filter(p =>
      p.state.trim().toLowerCase() === matchedState.toLowerCase()
    );
    const multiStateProjects = allProjects.filter(p =>
      p.state.trim().toLowerCase() !== matchedState.toLowerCase() &&
      p.state.toLowerCase().includes(matchedState.toLowerCase())
    );
    const stateProjects = [...inStateProjects, ...multiStateProjects];

    if (stateProjects.length === 0) {
      return {
        intent: 'STATE_SUMMARY',
        summaryText: `No matching PAIMANA projects found for the state of **${matchedState}**.`,
        groundedProjects: [],
        suggestedQuestions: DEFAULT_SUGGESTED_QUESTIONS
      };
    }

    const totalStateBudget = stateProjects.reduce((s, p) => s + (p.revisedCostCr || 0), 0);
    const criticalInState = stateProjects.filter(p => p.riskTier === 'CRITICAL');
    const highInState = stateProjects.filter(p => p.riskTier === 'HIGH');
    const moderateInState = stateProjects.filter(p => p.riskTier === 'MODERATE');
    const lowInState = stateProjects.filter(p => p.riskTier === 'LOW');
    const avgProgress = (stateProjects.reduce((s, p) => s + (p.physicalProgressPercent || 0), 0) / stateProjects.length).toFixed(1);

    const topStateProjects = [...stateProjects]
      .filter(p => p.riskScore != null)
      .sort((a, b) => (b.riskScore ?? 0) - (a.riskScore ?? 0))
      .slice(0, 5);

    const topStateList = topStateProjects.map((p, i) =>
      `${i + 1}. **${p.name}** (\`${p.code || p.id}\`): Risk **${p.riskScore}/100** [${p.riskTier}], ${p.sector}. Physical: ${p.physicalProgressPercent}%, Cost Overrun: +${p.costOverrunPercent}%. Primary Driver: ${p.primaryRiskDriver || 'Progress Stagnation'}`
    ).join('\n');

    const countDescription = multiStateProjects.length > 0
      ? `**${inStateProjects.length} dedicated in-state projects** (plus ${multiStateProjects.length} multi-state corridors passing through ${matchedState}, totaling **${stateProjects.length} monitored projects**)`
      : `**${inStateProjects.length} projects**`;

    return {
      intent: 'STATE_SUMMARY',
      summaryText: `PAIMANA State Portfolio: **${matchedState}**
- **Total Monitored Projects**: ${countDescription}
- **Committed Capital Outlay**: ₹${Math.round(totalStateBudget).toLocaleString()} Cr
- **Risk Stratification**:
  * Critical (80–100): **${criticalInState.length}**
  * High Risk (60–79): **${highInState.length}**
  * Moderate Risk (40–59): **${moderateInState.length}**
  * Low Risk (0–39): **${lowInState.length}**
- **Average Physical Progress**: **${avgProgress}%**

Top elevated-risk projects in ${matchedState}:
${topStateList}`,
      groundedProjects: topStateProjects,
      suggestedQuestions: [
        `Show high-risk projects in ${matchedState}`,
        `Which sector has the highest average risk in ${matchedState}?`,
        'Which projects have the highest risk?'
      ]
    };
  }

  // 6. Sector Inquiries
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
      ]
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

    const highRiskSec = secProjects.filter(p => p.riskTier === 'HIGH' || p.riskTier === 'CRITICAL');
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
- **High-Risk Projects (Risk ≥ 60)**: **${highRiskSec.length} projects** (${highRiskSec.filter(p => p.riskTier === 'CRITICAL').length} Critical, ${highRiskSec.filter(p => p.riskTier === 'HIGH').length} High)
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
      ]
    };
  }

  // 7. Progress Stagnation / Deterioration
  if (
    q.includes('stagnant progress') ||
    q.includes('stagnant') ||
    q.includes('stagnation') ||
    q.includes('frozen progress')
  ) {
    const stagnantProjects = allProjects.filter(p =>
      (p.primaryRiskDriver && p.primaryRiskDriver.toLowerCase().includes('stagnat')) ||
      (p.topRiskDrivers && p.topRiskDrivers.some(d => d.label.toLowerCase().includes('stagnat') && d.shapValue >= 15))
    );

    const topStagnant = [...stagnantProjects]
      .sort((a, b) => (b.riskScore ?? 0) - (a.riskScore ?? 0))
      .slice(0, 5);

    const listText = topStagnant.map((p, i) =>
      `${i + 1}. **${p.name}** (\`${p.code || p.id}\`)\n   - **Risk**: ${p.riskScore}/100 [${p.riskTier}] | **State**: ${p.state} | **Sector**: ${p.sector}\n   - **Physical Progress**: ${p.physicalProgressPercent}%\n   - **Stagnation Evidence**: ${p.topRiskDrivers?.find(d => d.label.includes('Stagnation'))?.description || p.primaryRiskDriver || 'Progress change ≤ 0.5 pp over consecutive observations'}`
    ).join('\n\n');

    return {
      intent: 'PROGRESS_STAGNATION',
      summaryText: `Progress Stagnation Analysis:
Across the 2,054 monitored projects, **${stagnantProjects.length} projects** exhibit progress stagnation (≤ 0.5 pp progress change across consecutive reporting months in the April–July 2026 window).

Top highest-risk projects exhibiting chronic progress stagnation:
${listText}`,
      groundedProjects: topStagnant,
      suggestedQuestions: [
        `Why is project ${topStagnant[0]?.id || '701396'} high risk?`,
        'Which projects show deteriorating progress?',
        'Which projects need intervention first?'
      ]
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
      (p.topRiskDrivers && p.topRiskDrivers.some(d => d.label.toLowerCase().includes('deteriorat') && d.shapValue >= 5))
    );

    const topDeteriorating = [...deterioratingProjects]
      .sort((a, b) => (b.riskScore ?? 0) - (a.riskScore ?? 0))
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
      ]
    };
  }

  // 8. Intervention / Prioritization
  if (
    q.includes('attention first') ||
    q.includes('prioritize') ||
    q.includes('priority queue') ||
    q.includes('p1') ||
    q.includes('need intervention') ||
    q.includes('priority tier')
  ) {
    const priorities = paimanaRepository.listPriorities({ limit: 5 });

    const listText = priorities.priorities.map((p, i) =>
      `${i + 1}. **${p.projectName}** (\`${p.projectId}\`)\n   - **Priority Score**: **${p.priorityScore}** [${p.priorityTier}]\n   - **PRISM Risk Index**: ${p.riskScore}/100 | **Urgency**: ${p.urgency}/100\n   - **Sector & State**: ${p.sector} • ${p.state}\n   - **Recommended Action**: ${p.recommendedAction}`
    ).join('\n\n');

    const topGrounded = priorities.priorities
      .map(pr => allProjects.find(p => p.id === pr.projectId))
      .filter((p): p is Project => Boolean(p));

    return {
      intent: 'INTERVENTION_PRIORITY_QUEUE',
      summaryText: `PRISM Intervention Priority Queue (Phase 3A):
The priority engine rank-orders projects by combining **PRISM Risk Index (40%)**, **Schedule Urgency (25%)**, **Recent Progress Deterioration (20%)**, and **Evidence Confidence (15%)**.

- **P1 Immediate Intervention (Priority ≥ 70)**: **${priorities.p1Count} projects**
- **P2 High-Priority Monitoring (50–69)**: **${priorities.p2Count} projects**
- **P3 Routine Monitoring (< 50)**: **${priorities.p3Count} projects**

Top prioritized projects requiring immediate inter-ministerial intervention:
${listText}`,
      groundedProjects: topGrounded,
      suggestedQuestions: [
        `Why is project ${priorities.priorities[0]?.projectId || '705610'} high risk?`,
        'Which projects have the highest risk?',
        'Which sectors have the highest average risk?'
      ]
    };
  }

  // 9. Portfolio Statistics / Counts / Average Risk
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
      ]
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
5. Use official PRISM terminology:
   - "PRISM Risk Index"
   - "PRISM Risk Engine"
   - "PRISM Risk Indicators"
   - "Evidence Weight"
   - "Scenario Simulation"
   DO NOT use terms like SHAP, TreeSHAP, XGBoost, ML Risk Model, or Phase 2 calibration.
6. Present your answer with clear markdown headings, bullet points, and bold key metrics.
7. Keep responses concise, professional, and policy-grade (under 250 words).
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
      if (text.trim().length > 0) {
        return {
          answer: text.trim(),
          groundedProjects: factualContext.groundedProjects.map(p => ({
            id: p.id,
            name: p.name,
            riskScore: (p.riskScore ?? 0) as number,
            riskTier: p.riskTier
          })),
          suggestedQuestions: factualContext.suggestedQuestions
        };
      }
    } catch (err) {
      console.warn('Gemini API call failed; providing verified deterministic repository response:', err);
    }
  }

  // Resilient Local Grounded Intelligence Engine (Fallback / Offline / Key-less)
  return {
    answer: factualContext.summaryText,
    groundedProjects: factualContext.groundedProjects.map(p => ({
      id: p.id,
      name: p.name,
      riskScore: (p.riskScore ?? 0) as number,
      riskTier: p.riskTier
    })),
    suggestedQuestions: factualContext.suggestedQuestions
  };
}
