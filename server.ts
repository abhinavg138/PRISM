import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { SEEDED_PROJECTS, computePortfolioKPIs } from './data/projectsData';
import { MLRiskEngine } from './server/mlEngine';
import { askPRISMCopilot } from './server/gemini';
import { Project } from './src/types/index';

dotenv.config();

let currentProjects: Project[] = JSON.parse(JSON.stringify(SEEDED_PROJECTS));

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // --- API ROUTES FIRST ---

  // Health Check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'operational',
      platform: 'PRISM - Predictive Risk Intelligence & Smart Monitoring',
      version: '2.1.0-sih2026',
      totalProjectsMonitored: currentProjects.length,
      hasGeminiKey: !!process.env.GEMINI_API_KEY,
      demoMode: true,
      timestamp: new Date().toISOString()
    });
  });

  // Get Projects (with search, filter, sort)
  app.get('/api/projects', (req, res) => {
    const { sector, state, riskTier, search, sortBy = 'riskScore', sortDirection = 'desc' } = req.query;

    let filtered = [...currentProjects];

    if (sector && sector !== 'ALL') {
      filtered = filtered.filter(p => p.sector === sector);
    }
    if (state && state !== 'ALL') {
      filtered = filtered.filter(p => p.state === state);
    }
    if (riskTier && riskTier !== 'ALL') {
      filtered = filtered.filter(p => p.riskTier === riskTier);
    }
    if (search && typeof search === 'string') {
      const s = search.toLowerCase();
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(s) ||
        p.code.toLowerCase().includes(s) ||
        p.implementingAgency.toLowerCase().includes(s) ||
        p.location.city.toLowerCase().includes(s)
      );
    }

    // Sort
    filtered.sort((a: any, b: any) => {
      let valA = a[sortBy as string];
      let valB = b[sortBy as string];

      if (typeof valA === 'string') {
        return sortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortDirection === 'asc' ? (valA - valB) : (valB - valA);
    });

    const kpis = computePortfolioKPIs(filtered);

    res.json({
      projects: filtered,
      kpis,
      totalCount: filtered.length
    });
  });

  // Get Single Project Detail
  app.get('/api/projects/:id', (req, res) => {
    const project = currentProjects.find(p => p.id === req.params.id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.json(project);
  });

  // What-If Simulation Endpoint
  app.post('/api/simulate', (req, res) => {
    const { projectId, params } = req.body;
    const project = currentProjects.find(p => p.id === projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const simResult = MLRiskEngine.simulate(project, {
      projectId,
      landClearanceAccelerationWeeks: Number(params?.landClearanceAccelerationWeeks || 0),
      contractorLiquidityInjectionPercent: Number(params?.contractorLiquidityInjectionPercent || 0),
      weatherGeologicalMitigationLevel: Number(params?.weatherGeologicalMitigationLevel || 0),
      fastTrackHighPowerCommittee: Boolean(params?.fastTrackHighPowerCommittee)
    });

    res.json(simResult);
  });

  // ML Risk Scoring Prediction
  app.post('/api/predict', (req, res) => {
    const { projectData, simParams } = req.body;
    if (!projectData) {
      return res.status(400).json({ error: 'Missing projectData' });
    }

    const scored = MLRiskEngine.calculateProjectRisk(projectData, simParams);
    res.json(scored);
  });

  // Grounded AI Copilot Chat Endpoint
  app.post('/api/copilot/chat', async (req, res) => {
    const { message, activeProjectId } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    try {
      const response = await askPRISMCopilot(message, currentProjects, activeProjectId);
      res.json(response);
    } catch (err: any) {
      console.error('Copilot Chat Error:', err);
      res.status(500).json({
        answer: 'PRISM AI engine encountered an internal processing event. Please re-try.',
        groundedProjects: [],
        suggestedQuestions: ['Show top critical projects', 'Explain land acquisition bottlenecks']
      });
    }
  });

  // Portfolio Analytics Aggregation
  app.get('/api/analytics', (req, res) => {
    const kpis = computePortfolioKPIs(currentProjects);

    // Sector breakdown
    const sectorMap: Record<string, { count: number; totalCost: number; criticalCount: number; avgDelay: number }> = {};
    for (const p of currentProjects) {
      if (!sectorMap[p.sector]) {
        sectorMap[p.sector] = { count: 0, totalCost: 0, criticalCount: 0, avgDelay: 0 };
      }
      sectorMap[p.sector].count += 1;
      sectorMap[p.sector].totalCost += p.revisedCostCr;
      if (p.riskTier === 'CRITICAL') sectorMap[p.sector].criticalCount += 1;
      sectorMap[p.sector].avgDelay += p.timeOverrunMonths;
    }

    const sectorBreakdown = Object.entries(sectorMap).map(([sector, stats]) => ({
      sector,
      count: stats.count,
      totalCostCr: Math.round(stats.totalCost),
      criticalCount: stats.criticalCount,
      avgDelayMonths: Math.round(stats.avgDelay / stats.count)
    }));

    // Risk Tier Distribution
    const riskDistribution = [
      { name: 'Critical (≥80)', count: kpis.criticalProjects, color: '#ef4444' },
      { name: 'High (65-74)', count: kpis.highRiskProjects, color: '#f97316' },
      { name: 'Medium (45-64)', count: kpis.mediumRiskProjects, color: '#eab308' },
      { name: 'Low (<45)', count: kpis.lowRiskProjects, color: '#10b981' }
    ];

    res.json({
      kpis,
      sectorBreakdown,
      riskDistribution,
      topCritical: currentProjects.filter(p => p.riskTier === 'CRITICAL').sort((a, b) => b.riskScore - a.riskScore)
    });
  });

  // Reset / Demo Presets
  app.post('/api/demo/reset', (req, res) => {
    const { preset } = req.body;
    currentProjects = JSON.parse(JSON.stringify(SEEDED_PROJECTS));

    if (preset === 'railway_escalation') {
      const usbrl = currentProjects.find(p => p.id === 'PRJ-IN-001');
      if (usbrl) {
        usbrl.riskScore = 94;
        usbrl.predictedDelayMonths = 11.2;
      }
    }

    res.json({ success: true, message: 'Demo data state restored', count: currentProjects.length });
  });

  // --- Vite Middleware for Development / Static in Production ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`PRISM Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
