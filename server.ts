import 'dotenv/config';
import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { SEEDED_PROJECTS, computePortfolioKPIs } from './data/projectsData';
import { paimanaRepository } from './server/paimanaRepository';
import { MLRiskEngine } from './server/mlEngine';
import { askPRISMCopilot } from './server/gemini';
import { Project } from './src/types/index';

dotenv.config();

// Active data source indicator: PAIMANA is PRIMARY runtime data source, DEMO is fallback
let currentDataSource: 'PAIMANA' | 'DEMO' = 'PAIMANA';
let currentDemoProjects: Project[] = JSON.parse(JSON.stringify(SEEDED_PROJECTS));

// Initialize PAIMANA Repository
try {
  paimanaRepository.load();
} catch (err) {
  console.error('[Server] Failed to initialize PAIMANA dataset on startup:', err);
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Enable CORS for local development across multiple dev ports (e.g. 5173, 3000)
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // --- API ROUTES ---

  // Health & Data Source Status Check
  app.get('/api/health', (req, res) => {
    if (!process.env.GEMINI_API_KEY) {
      dotenv.config();
    }
    const stats = paimanaRepository.getStats();
    res.json({
      status: 'operational',
      platform: 'PRISM - Predictive Risk Intelligence & Smart Monitoring',
      version: '2.1.0-sih2026',
      dataSource: currentDataSource,
      totalProjectsMonitored: currentDataSource === 'PAIMANA' ? stats.uniqueProjects : currentDemoProjects.length,
      totalObservationsLoaded: stats.totalObservations,
      projectsWith4Months: stats.projectsWith4Months,
      projectsMissingCoordinates: stats.projectsMissingCoordinates,
      projectsUnrated: stats.projectsUnrated,
      reportMonths: stats.reportMonths,
      hasGeminiKey: !!process.env.GEMINI_API_KEY,
      demoMode: currentDataSource === 'DEMO',
      timestamp: new Date().toISOString()
    });
  });

  // Dynamic Metadata: States, Agencies, Sectors, and Diagnostics
  app.get('/api/metadata', (req, res) => {
    const stats = paimanaRepository.getStats();
    if (currentDataSource === 'PAIMANA') {
      res.json({
        dataSource: 'PAIMANA',
        states: paimanaRepository.getStates(),
        agencies: paimanaRepository.getAgencies(),
        sectors: paimanaRepository.getSectors(),
        stats
      });
    } else {
      res.json({
        dataSource: 'DEMO',
        states: Array.from(new Set(SEEDED_PROJECTS.map(p => p.state))).sort(),
        agencies: Array.from(new Set(SEEDED_PROJECTS.map(p => p.implementingAgency))).sort(),
        sectors: Array.from(new Set(SEEDED_PROJECTS.map(p => p.sector))).sort(),
        stats
      });
    }
  });

  // Get Projects (with search, state, agency, sector, riskTier, sort)
  app.get('/api/projects', (req, res) => {
    const {
      sector,
      state,
      agency,
      riskTier,
      search,
      sortBy = 'id',
      sortDirection = 'asc',
      limit,
      offset
    } = req.query;

    if (currentDataSource === 'PAIMANA') {
      const { projects: filtered, totalCount } = paimanaRepository.listProjects({
        search: search as string,
        state: state as string,
        agency: agency as string,
        sector: sector as string,
        riskTier: riskTier as string,
        sortBy: sortBy as string,
        sortDirection: (sortDirection as 'asc' | 'desc') || 'asc',
        limit: limit ? parseInt(limit as string, 10) : undefined,
        offset: offset ? parseInt(offset as string, 10) : undefined
      });

      const kpis = paimanaRepository.computeKPIs(filtered);

      return res.json({
        dataSource: 'PAIMANA',
        projects: filtered,
        kpis,
        totalCount
      });
    }

    // Fallback DEMO Mode
    let filtered = [...currentDemoProjects];
    if (sector && sector !== 'ALL') {
      filtered = filtered.filter(p => p.sector === sector);
    }
    if (state && state !== 'ALL') {
      filtered = filtered.filter(p => p.state === state);
    }
    if (agency && agency !== 'ALL') {
      filtered = filtered.filter(p => p.implementingAgency.toLowerCase() === (agency as string).toLowerCase());
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

    filtered.sort((a: any, b: any) => {
      let valA = a[sortBy as string];
      let valB = b[sortBy as string];
      if (valA == null) return 1;
      if (valB == null) return -1;
      if (typeof valA === 'string') {
        return sortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortDirection === 'asc' ? (valA - valB) : (valB - valA);
    });

    const kpis = computePortfolioKPIs(filtered);

    res.json({
      dataSource: 'DEMO',
      projects: filtered,
      kpis,
      totalCount: filtered.length
    });
  });

  // Get Monthly Snapshot Observations for a Project (April, May, June, July 2026)
  app.get('/api/projects/:id/history', (req, res) => {
    const observations = paimanaRepository.getProjectObservations(req.params.id);
    if (observations.length === 0) {
      // Check if it's a demo project
      const demo = currentDemoProjects.find(p => p.id === req.params.id);
      if (demo) {
        return res.json({
          projectId: demo.id,
          dataSource: 'DEMO',
          monthlyTrend: demo.monthlyTrend,
          total: demo.monthlyTrend.length
        });
      }
      return res.status(404).json({ error: 'No observations found for project' });
    }

    res.json({
      projectId: req.params.id,
      dataSource: 'PAIMANA',
      observations,
      total: observations.length
    });
  });

  // PRISM Risk Assessment endpoint: full breakdown of all 6 evidence-based indicators
  app.get('/api/projects/:id/risk', (req, res) => {
    const assessment = paimanaRepository.getProjectRiskAssessment(req.params.id);
    if (!assessment) {
      // Check DEMO projects too
      const demo = currentDemoProjects.find(p => p.id === req.params.id);
      if (demo) {
        return res.json({
          projectId: demo.id,
          dataSource: 'DEMO',
          riskScore: demo.riskScore,
          riskTier: demo.riskTier,
          indicators: [],
          primaryConcerns: ['DEMO mode — PRISM Risk Index not applicable. Use the DEMO What-If simulator.'],
          evidenceConfidence: null,
          observationCount: 0,
          note: 'DEMO projects use the legacy heuristic engine. PRISM Risk Index applies to PAIMANA projects only.'
        });
      }
      return res.status(404).json({ error: 'Risk assessment not found for project' });
    }
    res.json({
      projectId: req.params.id,
      dataSource: 'PAIMANA',
      ...assessment
    });
  });

  // PRISM Intervention Priority Queue endpoint (Phase 3A)
  app.get('/api/priorities', (req, res) => {
    const { limit, state, agency, sector, priorityTier } = req.query;
    const parsedLimit = limit ? parseInt(limit as string, 10) : 50;

    const result = paimanaRepository.listPriorities({
      limit: isNaN(parsedLimit) ? 50 : parsedLimit,
      state: state as string,
      agency: agency as string,
      sector: sector as string,
      priorityTier: priorityTier as string
    });

    res.json({
      dataSource: 'PAIMANA',
      ...result
    });
  });

  // PRISM Single Project Priority Assessment & Evidence endpoint (Phase 3A)
  app.get('/api/projects/:id/priority', (req, res) => {
    const priority = paimanaRepository.getProjectPriorityAssessment(req.params.id);
    if (!priority) {
      return res.status(404).json({ error: 'Priority assessment not found for project' });
    }

    res.json({
      dataSource: 'PAIMANA',
      ...priority
    });
  });

  // PRISM Early Warning Alerts endpoint
  app.get('/api/alerts', (req, res) => {
    const { severity, alertType, sector, state, search, limit, offset } = req.query;
    const parsedLimit = limit ? parseInt(limit as string, 10) : undefined;
    const parsedOffset = offset ? parseInt(offset as string, 10) : undefined;

    const result = paimanaRepository.getEarlyWarningAlerts({
      severity: severity as string,
      alertType: alertType as string,
      sector: sector as string,
      state: state as string,
      search: search as string,
      limit: parsedLimit,
      offset: parsedOffset
    });

    res.json({
      dataSource: currentDataSource,
      ...result
    });
  });

  // Single Project Active Early Warning Alert
  app.get('/api/projects/:id/alert', (req, res) => {
    const alert = paimanaRepository.getProjectAlert(req.params.id);
    if (!alert) {
      return res.status(404).json({ message: 'No active early warning alert for this project' });
    }
    res.json({
      dataSource: currentDataSource,
      alert
    });
  });

  // Infrastructure Sectors Intelligence endpoint
  app.get('/api/sectors', (req, res) => {
    if (currentDataSource === 'PAIMANA') {
      const sectors = paimanaRepository.getSectorStats();
      return res.json({
        dataSource: 'PAIMANA',
        sectors,
        totalProjects: sectors.reduce((acc, s) => acc + s.totalProjects, 0),
        note: 'Sector classifications are derived from implementing agencies.'
      });
    }

    // DEMO mode fallback
    const sectors = paimanaRepository.getSectorStats(currentDemoProjects);
    res.json({
      dataSource: 'DEMO',
      sectors,
      totalProjects: currentDemoProjects.length,
      note: 'Sector classifications are derived from implementing agencies.'
    });
  });

  // Portfolio Multi-Dimensional Analytics endpoint
  app.get('/api/analytics', (req, res) => {
    if (currentDataSource === 'PAIMANA') {
      const analytics = paimanaRepository.getFullAnalytics();
      return res.json({
        dataSource: 'PAIMANA',
        ...analytics
      });
    }

    const analytics = paimanaRepository.getFullAnalytics(currentDemoProjects);
    res.json({
      dataSource: 'DEMO',
      ...analytics
    });
  });



  // Alias for observations history
  app.get('/api/projects/:id/observations', (req, res) => {
    const observations = paimanaRepository.getProjectObservations(req.params.id);
    res.json({
      projectId: req.params.id,
      dataSource: 'PAIMANA',
      observations,
      total: observations.length
    });
  });

  // Get Single Project Detail
  app.get('/api/projects/:id', (req, res) => {
    if (currentDataSource === 'PAIMANA') {
      const project = paimanaRepository.getProjectById(req.params.id);
      if (project) {
        return res.json(project);
      }
      // Check demo fallback if requested for demo showcase projects
      const demo = currentDemoProjects.find(p => p.id === req.params.id);
      if (demo) {
        return res.json(demo);
      }
      return res.status(404).json({ error: 'Project not found in PAIMANA repository' });
    }

    const demo = currentDemoProjects.find(p => p.id === req.params.id);
    if (!demo) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.json(demo);
  });

  // Rule-based What-If Scenario Simulation Endpoint
  // Performs exploratory sensitivity simulation on top of PRISM risk indicators
  app.post('/api/simulate', (req, res) => {
    const { projectId, params } = req.body;
    if (!projectId) {
      return res.status(400).json({ error: 'Missing projectId' });
    }

    let project: Project | undefined;

    if (currentDataSource === 'PAIMANA') {
      project = paimanaRepository.getProjectById(projectId);
    }
    if (!project) {
      project = currentDemoProjects.find(p => p.id === projectId);
    }
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Safety guard: PAIMANA projects with null riskScore are unrated; return null / UNRATED
    // Note: PAIMANA projects receive a computed riskScore from PRISMRiskEngine
    if (project.riskScore == null) {
      return res.json({
        projectId: project.id,
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
          'Risk score unavailable for this project. What-If simulation requires a computed PRISM Risk Index.'
        ]
      });
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

  // Grounded AI Copilot Chat Endpoint
  app.post('/api/copilot/chat', async (req, res) => {
    try {
      const { message, activeProjectId } = req.body || {};
      if (!message) {
        return res.status(400).json({ error: 'Message is required' });
      }

      const activeList = currentDataSource === 'PAIMANA'
        ? paimanaRepository.listProjects().projects
        : currentDemoProjects;

      const response = await askPRISMCopilot(message, activeList, activeProjectId);
      res.json(response);
    } catch (err: any) {
      console.error('Copilot Chat Error:', err);
      res.status(500).json({
        answer: 'PRISM AI engine encountered an internal processing event. Please re-try.',
        error: err?.message || 'Internal processing error',
        groundedProjects: [],
        suggestedQuestions: ['Show top critical projects', 'Explain land acquisition bottlenecks']
      });
    }
  });


  // Data Source Toggle & Demo Reset
  app.post('/api/demo/reset', (req, res) => {
    const { preset } = req.body;

    if (preset === 'demo') {
      currentDataSource = 'DEMO';
      currentDemoProjects = JSON.parse(JSON.stringify(SEEDED_PROJECTS));
      return res.json({
        success: true,
        dataSource: 'DEMO',
        message: 'Switched to DEMO showcase dataset (20 curated projects)',
        count: currentDemoProjects.length
      });
    }

    if (preset === 'paimana') {
      currentDataSource = 'PAIMANA';
      return res.json({
        success: true,
        dataSource: 'PAIMANA',
        message: 'Switched to primary PAIMANA runtime dataset',
        count: paimanaRepository.getStats().uniqueProjects
      });
    }

    if (preset === 'railway_escalation') {
      currentDataSource = 'DEMO';
      currentDemoProjects = JSON.parse(JSON.stringify(SEEDED_PROJECTS));
      const usbrl = currentDemoProjects.find(p => p.id === 'PRJ-IN-001');
      if (usbrl) {
        usbrl.riskScore = 94;
        usbrl.predictedDelayMonths = 11.2;
      }
      return res.json({
        success: true,
        dataSource: 'DEMO',
        message: 'DEMO preset with USBRL escalation enabled',
        count: currentDemoProjects.length
      });
    }

    // Default reset: keep currentDataSource, reset demo projects if demo
    if (currentDataSource === 'DEMO') {
      currentDemoProjects = JSON.parse(JSON.stringify(SEEDED_PROJECTS));
    }

    res.json({
      success: true,
      dataSource: currentDataSource,
      message: `Data state reset. Active source: ${currentDataSource}`,
      count: currentDataSource === 'PAIMANA' ? paimanaRepository.getStats().uniqueProjects : currentDemoProjects.length
    });
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
    console.log(`[PRISM] Server running on http://0.0.0.0:${PORT} [DataSource: ${currentDataSource}]`);
  });
}

startServer();
