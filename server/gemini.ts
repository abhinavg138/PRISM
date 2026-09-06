import { GoogleGenAI } from '@google/genai';
import { Project } from '../src/types/index';

let aiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI | null {
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

export async function askPRISMCopilot(
  userQuery: string,
  projects: Project[],
  activeProjectId?: string
): Promise<CopilotResponse> {
  // Find referenced or active project
  let relevantProjects = projects;
  let activeProject = activeProjectId ? projects.find(p => p.id === activeProjectId) : undefined;

  const queryLower = userQuery.toLowerCase();
  
  // Look for project mentions
  const matchedProjects = projects.filter(p => 
    queryLower.includes(p.name.toLowerCase()) || 
    queryLower.includes(p.code.toLowerCase()) ||
    (p.sector && queryLower.includes(p.sector.toLowerCase())) ||
    queryLower.includes(p.state.toLowerCase())
  );

  if (matchedProjects.length > 0) {
    relevantProjects = matchedProjects;
    if (!activeProject) {
      activeProject = matchedProjects[0];
    }
  }

  // Grounding Context Builder
  const projectSummaries = projects.slice(0, 10).map(p => {
    const riskStr = p.riskScore != null ? `Risk Score: ${p.riskScore}/100 [${p.riskTier}]` : `Risk Score: UNRATED (Phase 2 model pending)`;
    const delayStr = p.predictedDelayMonths != null ? `Pred Delay: +${p.predictedDelayMonths} mo` : 'Pred Delay: UNRATED';
    const shapStr = p.topRiskDrivers && p.topRiskDrivers.length > 0 ? p.topRiskDrivers[0].label : 'UNRATED';
    const spendStr = p.expenditurePctOfRevisedCost != null ? `${p.expenditurePctOfRevisedCost}%` : 'N/A';
    return `- [${p.id}] ${p.name} (${p.sector}, ${p.state}): ${riskStr}, Time Overrun: ${p.timeOverrunMonths} mo, Cost Overrun: ${p.costOverrunPercent}%, Physical: ${p.physicalProgressPercent}%, Spend of Revised Cost: ${spendStr}. Primary Cause: ${p.primaryDelayCause || 'N/A'}. Top SHAP Driver: ${shapStr}`;
  }).join('\n');

  const activeProjectDetail = activeProject ? `
SELECTED PROJECT IN FOCUS:
- Name: ${activeProject.name} (${activeProject.code})
- Sector: ${activeProject.sector} | Agency: ${activeProject.implementingAgency}
- Location: ${activeProject.location?.city ? `${activeProject.location.city}, ` : ''}${activeProject.state}
- Budget: Original ₹${activeProject.originalCostCr} Cr -> Revised ₹${activeProject.revisedCostCr} Cr (${activeProject.costOverrunPercent}% overrun)
- Progress: Physical ${activeProject.physicalProgressPercent}%, Spend Ratio: ${activeProject.expenditurePctOfRevisedCost != null ? `${activeProject.expenditurePctOfRevisedCost}%` : 'N/A'}
- Timeline: Overrun ${activeProject.timeOverrunMonths} months. Predicted further delay: ${activeProject.predictedDelayMonths != null ? `+${activeProject.predictedDelayMonths} months` : 'UNRATED (Phase 2 model pending)'}
- ML Risk Status: ${activeProject.riskScore != null ? `${activeProject.riskScore}/100 (${activeProject.riskTier})` : 'UNRATED (Phase 2 model calibration pending)'}
- SHAP Risk Drivers:
  ${activeProject.topRiskDrivers && activeProject.topRiskDrivers.length > 0 ? activeProject.topRiskDrivers.map(d => `* ${d.label} (SHAP +${d.shapValue} pts): ${d.description}`).join('\n  ') : 'None (UNRATED for raw PAIMANA records)'}
- Mitigation Roadmap:
  ${activeProject.mitigationRoadmap && activeProject.mitigationRoadmap.length > 0 ? activeProject.mitigationRoadmap.map(m => `* ${m.action} [${m.timeframe}, ${m.responsibleParty}] - Risk Reduction: -${m.riskReductionPoints} pts`).join('\n  ') : 'Roadmap generation scheduled following Phase 2 predictive modeling'}
` : '';

  const systemInstruction = `
You are the PRISM Risk Intelligence Copilot, an expert AI infrastructure monitoring advisor for the Ministry of Statistics and Programme Implementation (MoSPI) and Prime Minister's Project Monitoring Group (PMG) for SIH 2026.

Your task is to provide concise, authoritative, and data-grounded insights into Indian mega-infrastructure project monitoring and PAIMANA framework indicators.

RULES:
1. Always ground your facts strictly in the provided project data and PAIMANA framework indicators. Never hallucinate facts or numbers.
2. If riskScore, predictedDelayMonths, or TreeSHAP drivers are unrated/null for a project, clearly state that ML risk scoring is UNRATED pending Phase 2 model calibration. Do not fabricate scores or SHAP values.
3. Cite actual PAIMANA metrics: Physical Progress (%), Cumulative Expenditure (₹ Cr), Spend as % of Revised Cost, and Recorded Schedule Slippage (months).
4. Offer actionable, policy-grade interventions (e.g. Chief Secretary High-Power Committee review, escrow cashflow advance, pre-cast modular construction, Norwegian tunneling technique).
5. Format output cleanly with clear bullet points and bold key terms.
6. Keep responses concise and focused (under 300 words).
`;

  const prompt = `
GROUNDED DATA REGISTRY:
${projectSummaries}

${activeProjectDetail}

USER INQUIRY:
"${userQuery}"

Provide a direct, grounded answer with clear root cause analysis and actionable mitigation steps.
`;

  const client = getGeminiClient();

  if (client) {
    try {
      const response = await client.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          systemInstruction,
          temperature: 0.2
        }
      });

      const text = response.text || '';
      if (text.trim().length > 0) {
        return {
          answer: text,
          groundedProjects: (activeProject ? [activeProject] : matchedProjects.slice(0, 3)).map(p => ({
            id: p.id,
            name: p.name,
            riskScore: p.riskScore as any,
            riskTier: p.riskTier
          })),
          suggestedQuestions: generateSuggestedQuestions(activeProject || projects[0])
        };
      }
    } catch (err) {
      console.warn('Gemini API call failed, falling back to local grounded intelligence engine:', err);
    }
  }

  // Resilient Local Grounded Intelligence Engine (Offline / No Key Fallback)
  return generateLocalGroundedResponse(userQuery, projects, activeProject);
}

function generateSuggestedQuestions(p: Project): string[] {
  if (p.riskScore == null) {
    return [
      `What is the physical progress vs spend ratio for ${p.name.split('(')[0].trim()}?`,
      `What is the recorded schedule slippage for ${p.id}?`,
      `Which agency supervises ${p.name.split('(')[0].trim()}?`,
      `Generate MoSPI Flash Report executive summary.`
    ];
  }
  return [
    `What are the top SHAP risk drivers for ${p.name.split('(')[0].trim()}?`,
    `How can we simulate a 12-week land clearance acceleration on ${p.id}?`,
    `Which infrastructure sector has the highest budget at risk?`,
    `Generate MoSPI Flash Report executive summary.`
  ];
}

function generateLocalGroundedResponse(
  query: string,
  projects: Project[],
  activeProject?: Project
): CopilotResponse {
  const q = query.toLowerCase();

  // Top Critical Projects Query
  if (q.includes('critical') || q.includes('highest risk') || q.includes('top risk') || q.includes('top 3')) {
    const criticals = projects.filter(p => p.riskTier === 'CRITICAL').sort((a, b) => (b.riskScore ?? 0) - (a.riskScore ?? 0));
    
    if (criticals.length === 0) {
      return {
        answer: `### ℹ️ PRISM Operational Status: UNRATED Dataset Pipeline\n\nAll **${projects.length} projects** currently monitored under the primary PAIMANA runtime dataset are classified as **UNRATED (riskScore: null)**. In accordance with strict data integrity standards, synthetic or heuristic risk scores are not fabricated.\n\nTo view calibrated risk scores, TreeSHAP attributions, and policy simulations on the curated showcase portfolio, activate **DEMO Mode**.`,
        groundedProjects: projects.slice(0, 3).map(p => ({ id: p.id, name: p.name, riskScore: p.riskScore as any, riskTier: p.riskTier })),
        suggestedQuestions: [
          `Which projects have the longest schedule slippage?`,
          `What is the total capital outlay under PAIMANA?`,
          `Show projects with highest cost overrun.`
        ]
      };
    }

    const listText = criticals.map((c, i) => 
      `${i + 1}. **${c.name}** (${c.sector}, ${c.state})\n   - **Risk Score**: ${c.riskScore}/100 (Critical)\n   - **Anticipated Delay**: +${c.predictedDelayMonths} months | Cost Overrun: ${c.costOverrunPercent}%\n   - **Primary Bottleneck**: ${c.primaryDelayCause}\n   - **Top SHAP Driver**: ${c.topRiskDrivers[0]?.label} (+${c.topRiskDrivers[0]?.shapValue} pts)`
    ).join('\n\n');

    return {
      answer: `### 🚨 PRISM Critical Risk Assessment\n\nThe ML risk model has identified **${criticals.length} mega-projects** operating in the Critical Risk tier (Risk Score ≥ 80). These projects represent over ₹${Math.round(criticals.reduce((acc, c) => acc + c.revisedCostCr, 0)).toLocaleString()} Cr in total capital commitment.\n\n${listText}\n\n**Immediate Recommendation**: Recommend elevating these projects to the Prime Minister's Project Monitoring Group (PMG) cabinet escalation list for inter-ministerial resolution.`,
      groundedProjects: criticals.slice(0, 3).map(p => ({ id: p.id, name: p.name, riskScore: p.riskScore as any, riskTier: p.riskTier })),
      suggestedQuestions: [
        `What are the root causes of USBRL delays in Kashmir?`,
        `How much budget is at risk across all sectors?`,
        `Simulate land clearance speedup for Delhi-Mumbai Expressway.`
      ]
    };
  }

  // Specific project inquiry (e.g., USBRL or active project)
  const target = activeProject || projects.find(p => q.includes(p.id.toLowerCase()) || q.includes(p.name.toLowerCase().split(' ')[0])) || projects[0];

  if (target) {
    const isUnrated = target.riskScore == null;
    const scoreText = isUnrated ? '**UNRATED** (Phase 2 model calibration pending)' : `**${target.riskScore} / 100** (${target.riskTier} Tier)`;
    const delayText = target.predictedDelayMonths != null 
      ? `with predictive pipeline anticipating an additional **+${target.predictedDelayMonths} months**` 
      : 'predictive delay model unrated for raw PAIMANA records';

    const driversSection = isUnrated || target.topRiskDrivers.length === 0
      ? 'TreeSHAP feature attributions are not fabricated for raw PAIMANA records and will be computed upon Phase 2 model training.'
      : target.topRiskDrivers.slice(0, 3).map(d => `- **${d.label}** (SHAP Contribution: **+${d.shapValue} pts**): ${d.description}`).join('\n');

    const roadmapSection = target.mitigationRoadmap.length > 0
      ? target.mitigationRoadmap.map(m => `- **${m.action}** [Target: ${m.timeframe} | Lead: ${m.responsibleParty}] -> Expected Risk Reduction: **-${m.riskReductionPoints} pts**`).join('\n')
      : 'Mitigation roadmap scheduled for generation following Phase 2 predictive modeling.';

    return {
      answer: `### 📊 Project Operational Status: ${target.name}\n\n- **Project ID**: \`${target.id}\` | **Sector**: ${target.sector} (${target.state})\n- **Implementing Agency**: ${target.implementingAgency}\n- **ML Risk Status**: ${scoreText}\n- **Cost Exposure**: Revised to ₹${target.revisedCostCr.toLocaleString()} Cr (Overrun of **${target.costOverrunPercent}%**)\n- **Timeline Slippage**: Recorded delay of **${target.timeOverrunMonths} months**, ${delayText}.\n- **Physical Progress**: ${target.physicalProgressPercent}% | **Spend Ratio**: ${target.expenditurePctOfRevisedCost != null ? `${target.expenditurePctOfRevisedCost}%` : 'N/A'}\n\n#### 🔍 Feature Attribution / Root Cause:\n${driversSection}\n\n#### 🛡️ Mitigation Roadmap:\n${roadmapSection}`,
      groundedProjects: [{ id: target.id, name: target.name, riskScore: target.riskScore as any, riskTier: target.riskTier }],
      suggestedQuestions: generateSuggestedQuestions(target)
    };
  }

  // General portfolio query
  const criticalCount = projects.filter(p => p.riskTier === 'CRITICAL').length;
  const unratedCount = projects.filter(p => p.riskTier === 'UNRATED').length;

  return {
    answer: `### 🏢 PRISM National Infrastructure Monitoring\n\nMonitoring **${projects.length} national priority projects** totaling **₹${Math.round(projects.reduce((s, p) => s + p.revisedCostCr, 0)).toLocaleString()} Cr** under the MoSPI / PAIMANA framework.\n\n- **Risk Status**: ${unratedCount > 0 ? `${unratedCount} UNRATED (Phase 2 model pending)` : `${criticalCount} Critical projects`}\n- **Average Cost Overrun**: ${(projects.reduce((s, p) => s + p.costOverrunPercent, 0) / (projects.length || 1)).toFixed(1)}%\n- **Average Schedule Slippage**: ${(projects.reduce((s, p) => s + p.timeOverrunMonths, 0) / (projects.length || 1)).toFixed(1)} months\n\nYou can inspect individual project monthly snapshots, compare physical progress against expenditure, or explore sector allocations.`,
    groundedProjects: projects.slice(0, 3).map(p => ({ id: p.id, name: p.name, riskScore: p.riskScore as any, riskTier: p.riskTier })),
    suggestedQuestions: [
      `Show projects with highest schedule slippage`,
      `Compare physical progress vs expenditure across sectors`,
      `Which states have the largest committed capital outlay?`
    ]
  };
}
