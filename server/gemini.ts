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
  const projectSummaries = projects.slice(0, 10).map(p => 
    `- [${p.id}] ${p.name} (${p.sector}, ${p.state}): Risk Score ${p.riskScore}/100 [${p.riskTier}], Delay Overrun: ${p.timeOverrunMonths} mo, Cost Overrun: ${p.costOverrunPercent}%, Physical: ${p.physicalProgressPercent}%, Financial: ${p.financialProgressPercent}%. Primary Cause: ${p.primaryDelayCause}. Top SHAP Driver: ${p.topRiskDrivers[0]?.label || 'N/A'}`
  ).join('\n');

  const activeProjectDetail = activeProject ? `
SELECTED PROJECT IN FOCUS:
- Name: ${activeProject.name} (${activeProject.code})
- Sector: ${activeProject.sector} | Ministry: ${activeProject.ministry}
- Location: ${activeProject.location.city}, ${activeProject.state}
- Implementing Agency: ${activeProject.implementingAgency}
- Budget: Original ₹${activeProject.originalCostCr} Cr -> Revised ₹${activeProject.revisedCostCr} Cr (${activeProject.costOverrunPercent}% overrun)
- Progress: Physical ${activeProject.physicalProgressPercent}%, Financial ${activeProject.financialProgressPercent}%
- Timeline: Overrun ${activeProject.timeOverrunMonths} months. Predicted further delay: ${activeProject.predictedDelayMonths} months
- ML Risk Score: ${activeProject.riskScore}/100 (${activeProject.riskTier})
- Top SHAP Risk Drivers:
  ${activeProject.topRiskDrivers.map(d => `* ${d.label} (SHAP +${d.shapValue} pts): ${d.description}`).join('\n  ')}
- Recommended Mitigation Roadmap:
  ${activeProject.mitigationRoadmap.map(m => `* ${m.action} [${m.timeframe}, ${m.responsibleParty}] - Risk Reduction: -${m.riskReductionPoints} pts`).join('\n  ')}
` : '';

  const systemInstruction = `
You are the PRISM Risk Intelligence Copilot, an expert AI infrastructure monitoring advisor for the Ministry of Statistics and Programme Implementation (MoSPI) and Prime Minister's Project Monitoring Group (PMG) for SIH 2026.

Your task is to provide concise, authoritative, and data-grounded insights into Indian mega-infrastructure project risks, delays, cost escalation, and TreeSHAP explainability.

RULES:
1. Always ground your facts strictly in the provided project data and PAIMANA framework indicators. Never hallucinate facts or numbers.
2. Cite specific metrics: Risk Scores, Time Overruns (months), Cost Overruns (₹ Cr), and SHAP Driver contributions.
3. Offer actionable, policy-grade interventions (e.g. Chief Secretary High-Power Committee review, escrow cashflow advance, pre-cast modular construction, Norwegian tunneling technique).
4. Format output cleanly with clear bullet points and bold key terms.
5. Keep responses concise and focused (under 300 words).
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
            riskScore: p.riskScore,
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
    const criticals = projects.filter(p => p.riskTier === 'CRITICAL').sort((a, b) => b.riskScore - a.riskScore);
    const listText = criticals.map((c, i) => 
      `${i + 1}. **${c.name}** (${c.sector}, ${c.state})\n   - **Risk Score**: ${c.riskScore}/100 (Critical)\n   - **Anticipated Delay**: +${c.predictedDelayMonths} months | Cost Overrun: ${c.costOverrunPercent}%\n   - **Primary Bottleneck**: ${c.primaryDelayCause}\n   - **Top SHAP Driver**: ${c.topRiskDrivers[0]?.label} (+${c.topRiskDrivers[0]?.shapValue} pts)`
    ).join('\n\n');

    return {
      answer: `### 🚨 PRISM Critical Risk Assessment\n\nThe ML risk model has identified **${criticals.length} mega-projects** operating in the Critical Risk tier (Risk Score ≥ 80). These projects represent over ₹${Math.round(criticals.reduce((acc, c) => acc + c.revisedCostCr, 0)).toLocaleString()} Cr in total capital commitment.\n\n${listText}\n\n**Immediate Recommendation**: Recommend elevating these projects to the Prime Minister's Project Monitoring Group (PMG) cabinet escalation list for inter-ministerial resolution.`,
      groundedProjects: criticals.slice(0, 3).map(p => ({ id: p.id, name: p.name, riskScore: p.riskScore, riskTier: p.riskTier })),
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
    const topDrivers = target.topRiskDrivers.slice(0, 3).map(d => 
      `- **${d.label}** (SHAP Contribution: **+${d.shapValue} pts**): ${d.description}`
    ).join('\n');

    const roadmap = target.mitigationRoadmap.map(m => 
      `- **${m.action}** [Target: ${m.timeframe} | Lead: ${m.responsibleParty}] -> Expected Risk Reduction: **-${m.riskReductionPoints} pts**`
    ).join('\n');

    return {
      answer: `### 📊 Risk Intelligence Analysis: ${target.name}\n\n- **Project ID**: \`${target.id}\` | **Sector**: ${target.sector} (${target.state})\n- **Current ML Risk Score**: **${target.riskScore} / 100** (${target.riskTier} Tier)\n- **Cost Exposure**: Revised to ₹${target.revisedCostCr.toLocaleString()} Cr (Overrun of **${target.costOverrunPercent}%**)\n- **Timeline Slippage**: Recorded delay of **${target.timeOverrunMonths} months**, with predictive pipeline anticipating an additional **+${target.predictedDelayMonths} months**.\n\n#### 🔍 TreeSHAP Feature Attribution (Why this project is at risk):\n${topDrivers}\n\n#### 🛡️ Calibrated Mitigation Roadmap:\n${roadmap}`,
      groundedProjects: [{ id: target.id, name: target.name, riskScore: target.riskScore, riskTier: target.riskTier }],
      suggestedQuestions: [
        `Run What-If simulation with expedited approvals on ${target.id}`,
        `Show monthly S-Curve progress trend for ${target.id}`,
        `Compare ${target.sector} risks with national average`
      ]
    };
  }

  // General portfolio query
  return {
    answer: `### 🏢 PRISM National Infrastructure Risk Intelligence\n\nMonitoring **${projects.length} national priority projects** totaling **₹${Math.round(projects.reduce((s, p) => s + p.revisedCostCr, 0)).toLocaleString()} Cr** under the MoSPI / PAIMANA framework.\n\n- **Critical Risk Projects**: ${projects.filter(p => p.riskTier === 'CRITICAL').length}\n- **Average Cost Overrun**: ${(projects.reduce((s, p) => s + p.costOverrunPercent, 0) / projects.length).toFixed(1)}%\n- **Average Schedule Slippage**: ${(projects.reduce((s, p) => s + p.timeOverrunMonths, 0) / projects.length).toFixed(1)} months\n\nYou can click any project from the dashboard or map to inspect its TreeSHAP feature attributions, run What-If simulations, or ask specific questions about land acquisition bottlenecks and contractor liquidity.`,
    groundedProjects: projects.slice(0, 3).map(p => ({ id: p.id, name: p.name, riskScore: p.riskScore, riskTier: p.riskTier })),
    suggestedQuestions: [
      `Show top 3 projects requiring immediate cabinet intervention`,
      `Why is Udhampur-Srinagar-Baramulla rail link marked Critical?`,
      `How does contractor cashflow affect project delivery?`
    ]
  };
}
