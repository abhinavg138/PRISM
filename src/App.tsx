import React, { useState, useEffect, useMemo } from 'react';
import { Navbar } from './components/Navbar';
import { KPISummary } from './components/KPISummary';
import { FilterBar } from './components/FilterBar';
import { ProjectTable } from './components/ProjectTable';
import { GISMap } from './components/GISMap';
import { SectorAnalytics } from './components/SectorAnalytics';
import { SectorCards } from './components/SectorCards';
import { PriorityProjectsOverview } from './components/PriorityProjectsOverview';
import { EarlyWarningAlertsWidget } from './components/EarlyWarningAlertsWidget';
import { EarlyWarningAlertsModal } from './components/EarlyWarningAlertsModal';
import { PortfolioRiskInsight } from './components/PortfolioRiskInsight';
import { ProjectDetailModal } from './components/ProjectDetailModal';
import { AICopilotDrawer } from './components/AICopilotDrawer';
import { ExecutiveFlashReportModal } from './components/ExecutiveFlashReportModal';
import { DEMO_USER_ROLES, SEEDED_PROJECTS, computePortfolioKPIs } from '../data/projectsData';
import { Project, FilterState, UserRole, PortfolioKPIs, SectorStat, EarlyWarningAlert } from './types/index';
import { Sparkles, ShieldAlert, ArrowRight, Zap, PlayCircle, Info, FileText, RefreshCw, AlertTriangle, Database, TrendingUp } from 'lucide-react';

export default function App() {
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isCopilotOpen, setIsCopilotOpen] = useState<boolean>(false);
  const [isReportOpen, setIsReportOpen] = useState<boolean>(false);
  const [alerts, setAlerts] = useState<EarlyWarningAlert[]>([]);
  const [isAlertsModalOpen, setIsAlertsModalOpen] = useState<boolean>(false);
  const [currentRole, setCurrentRole] = useState<UserRole>(DEMO_USER_ROLES[0]); // Default to MoSPI National Oversight
  const [activeView, setActiveView] = useState<'dashboard' | 'projects' | 'gis' | 'analytics'>('dashboard');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [availableSectors, setAvailableSectors] = useState<string[]>([]);
  const [availableStates, setAvailableStates] = useState<string[]>([]);
  const [dataSource, setDataSource] = useState<'PAIMANA' | 'DEMO'>('PAIMANA');
  const [sectorStats, setSectorStats] = useState<SectorStat[]>([]);
  const [isSectorsLoading, setIsSectorsLoading] = useState<boolean>(false);
  const [projectQueueMode, setProjectQueueMode] = useState<'all' | 'priority' | 'p1'>('all');

  const [filters, setFilters] = useState<FilterState>({
    search: '',
    sector: 'ALL',
    state: 'ALL',
    riskTier: 'ALL',
    minCost: 0,
    maxCost: 200000,
    sortBy: 'id' as any,
    sortDirection: 'asc'
  });

  // Fetch metadata on mount to populate state and sector filters
  useEffect(() => {
    fetch('/api/metadata')
      .then(res => res.json())
      .then(data => {
        if (data.states && data.states.length > 0) setAvailableStates(data.states);
        if (data.sectors && data.sectors.length > 0) setAvailableSectors(data.sectors);
        if (data.dataSource) setDataSource(data.dataSource);
      })
      .catch(err => console.warn('Could not load metadata:', err));
  }, []);

  // Fetch complete unfiltered portfolio for Dashboard KPIs, sector intelligence, analytics, priority queue
  const fetchAllProjects = async () => {
    try {
      const res = await fetch('/api/projects');
      if (res.ok) {
        const data = await res.json();
        setAllProjects(data.projects || []);
        if (data.dataSource) setDataSource(data.dataSource);
      }
    } catch (err) {
      console.warn('Backend fetch all projects failed:', err);
    }
  };

  // Fetch filtered projects from backend API (for Projects page table)
  const fetchProjects = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.sector !== 'ALL') params.append('sector', filters.sector);
      if (filters.state !== 'ALL') params.append('state', filters.state);
      if (filters.riskTier !== 'ALL') params.append('riskTier', filters.riskTier);
      if (filters.search) params.append('search', filters.search);
      params.append('sortBy', filters.sortBy);
      params.append('sortDirection', filters.sortDirection);

      const res = await fetch(`/api/projects?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setProjects(data.projects || []);
        if (data.dataSource) setDataSource(data.dataSource);
      }
    } catch (err) {
      console.warn('Backend fetch failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch sector intelligence stats from backend API
  const fetchSectors = async () => {
    setIsSectorsLoading(true);
    try {
      const res = await fetch('/api/sectors');
      if (res.ok) {
        const data = await res.json();
        setSectorStats(data.sectors || []);
      }
    } catch (err) {
      console.warn('Failed to load sector statistics:', err);
    } finally {
      setIsSectorsLoading(false);
    }
  };

  // Fetch Early Warning Alerts
  const fetchAlerts = async () => {
    try {
      const res = await fetch('/api/alerts');
      if (res.ok) {
        const data = await res.json();
        setAlerts(data.alerts || []);
      }
    } catch (err) {
      console.warn('Failed to load early warning alerts:', err);
    }
  };

  // Initial load
  useEffect(() => {
    fetchAllProjects();
    fetchProjects();
    fetchSectors();
    fetchAlerts();
  }, []);

  // Re-fetch filtered projects when filters change
  useEffect(() => {
    fetchProjects();
  }, [filters]);

  // Re-fetch all data when dataSource changes
  useEffect(() => {
    fetchAllProjects();
    fetchProjects();
    fetchSectors();
    fetchAlerts();
  }, [dataSource]);

  // Decoupled portfolio-wide KPIs computed across ALL projects (all 2,054 projects in PAIMANA mode)
  const portfolioKPIs: PortfolioKPIs = useMemo(() => {
    const fullList = allProjects.length > 0 ? allProjects : projects;
    return computePortfolioKPIs(fullList);
  }, [allProjects, projects]);

  // Critical projects list for report (across entire portfolio)
  const criticalProjects = useMemo(() => {
    const fullList = allProjects.length > 0 ? allProjects : projects;
    return fullList.filter(p => p.riskTier === 'CRITICAL').sort((a, b) => (b.riskScore || 0) - (a.riskScore || 0));
  }, [allProjects, projects]);

  const handleFilterUpdate = (updates: Partial<FilterState>) => {
    setFilters(prev => ({ ...prev, ...updates }));
  };

  const handleResetDemo = async () => {
    try {
      await fetch('/api/demo/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preset: 'paimana' })
      });
      setDataSource('PAIMANA');
      setCurrentRole(DEMO_USER_ROLES[0]);
      setFilters({
        search: '',
        sector: 'ALL',
        state: 'ALL',
        riskTier: 'ALL',
        minCost: 0,
        maxCost: 200000,
        sortBy: 'id' as any,
        sortDirection: 'asc'
      });
      await fetchAllProjects();
      await fetchProjects();
      await fetchSectors();
    } catch (e) {
      console.error(e);
    }
  };

  // Quick Judge Flow Demonstration Trigger (switches explicitly to DEMO mode for evaluator walkthrough)
  const triggerJudgeFlow = async () => {
    try {
      await fetch('/api/demo/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preset: 'demo' })
      });
      setDataSource('DEMO');
      setCurrentRole(DEMO_USER_ROLES[3]);
      await fetchAllProjects();
      await fetchProjects();
      await fetchSectors();
      const res = await fetch('/api/projects/PRJ-IN-001');
      if (res.ok) {
        const usbrl = await res.json();
        setSelectedProject(usbrl);
      }
    } catch (err) {
      console.error('Judge flow error:', err);
    }
  };

  const handleSelectRole = (role: UserRole) => {
    setCurrentRole(role);
    if (role.id === 'role-judge') {
      triggerJudgeFlow();
    } else if (dataSource === 'DEMO') {
      handleResetDemo();
    }
  };

  const handleChangeView = (view: 'dashboard' | 'projects' | 'gis' | 'analytics') => {
    setActiveView(view);
    if (view === 'projects') {
      setTimeout(() => {
        const el = document.getElementById('projects-section');
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 50);
    } else if (view === 'dashboard') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-blue-600 selection:text-white">

      {/* Navigation Header */}
      <Navbar
        currentRole={currentRole}
        onSelectRole={handleSelectRole}
        onOpenCopilot={() => setIsCopilotOpen(true)}
        onOpenReport={() => setIsReportOpen(true)}
        onResetDemo={handleResetDemo}
        isCopilotOpen={isCopilotOpen}
        activeView={activeView}
        onChangeView={handleChangeView}
        dataSource={dataSource}
      />

      {/* Main Content Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

        {/* ========================================================================= */}
        {/* 1. DASHBOARD: MINIMAL EXECUTIVE OVERVIEW                                 */}
        {/* ========================================================================= */}
        {activeView === 'dashboard' && (
          <div className="space-y-6">

            {/* 1. Executive Header */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                    National Infrastructure Risk Overview
                  </h1>
                  {dataSource === 'PAIMANA' ? (
                    <>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono">
                        PAIMANA: LIVE
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-mono">
                        PRISM RISK ENGINE: ACTIVE
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 font-mono">
                        DEMO SHOWCASE (15 PROJECTS)
                      </span>
                      <button
                        onClick={handleResetDemo}
                        className="text-[10px] font-bold px-2.5 py-0.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-mono transition-colors shadow-xs"
                      >
                        ← Return to PAIMANA Live
                      </button>
                    </>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {dataSource === 'PAIMANA'
                    ? `Real PAIMANA observations across ${(allProjects.length || 2054).toLocaleString()} monitored infrastructure projects.`
                    : 'Curated showcase portfolio demonstrating USBRL mega-project escalation.'}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setIsAlertsModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 transition-all shadow-xs"
                  title="View PRISM Early Warning Alerts"
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  <span>Early Warnings ({alerts.length})</span>
                </button>
                <button
                  onClick={() => setIsReportOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 transition-all shadow-xs"
                  title="Generate MoSPI Executive Flash Report"
                >
                  <FileText className="w-3.5 h-3.5 text-blue-600" />
                  <span>Flash Report</span>
                </button>
                {dataSource === 'PAIMANA' ? (
                  <button
                    onClick={triggerJudgeFlow}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white transition-all shadow-xs"
                    title="Switch to Demo Showcase preset with USBRL deep-dive"
                  >
                    <PlayCircle className="w-3.5 h-3.5" />
                    <span>Judge Demo Mode</span>
                  </button>
                ) : (
                  <button
                    onClick={handleResetDemo}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-xs"
                    title="Return to live PAIMANA database with 2,054 projects"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Live PAIMANA (2,054)</span>
                  </button>
                )}
              </div>
            </div>

            {/* 2. National KPI Summary (5 High-Value KPIs across all 2,054 projects) */}
            <KPISummary
              kpis={portfolioKPIs}
              onFilterRisk={(tier) => {
                handleFilterUpdate({ riskTier: tier });
                setActiveView('projects');
                setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 50);
              }}
              selectedTier={filters.riskTier}
            />

            {/* 3. Infrastructure Sector Cards (Main exploration mechanism across all projects) */}
            <SectorCards
              sectors={sectorStats}
              selectedSector={filters.sector}
              onSelectSector={(sec) => {
                handleFilterUpdate({ sector: sec });
                setActiveView('projects');
                setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 50);
              }}
              isLoading={isSectorsLoading}
            />

            {/* 4. Early Warning Alerts (Operational signals derived from longitudinal data) */}
            <EarlyWarningAlertsWidget
              alerts={alerts}
              onOpenAlertsModal={() => setIsAlertsModalOpen(true)}
              onSelectProject={(p) => setSelectedProject(p)}
              allProjects={allProjects.length > 0 ? allProjects : projects}
              limit={4}
            />

            {/* 5. Priority Projects (Max 5-10 High-Urgency Interventions) */}
            <PriorityProjectsOverview
              projects={allProjects.length > 0 ? allProjects : projects}
              onSelectProject={(p) => setSelectedProject(p)}
              onViewAllPriority={() => {
                setProjectQueueMode('priority');
                handleFilterUpdate({ riskTier: 'ALL', sector: 'ALL', search: '', state: 'ALL' });
                setActiveView('projects');
                setTimeout(() => {
                  const el = document.getElementById('projects-section');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                  else window.scrollTo({ top: 0, behavior: 'smooth' });
                }, 50);
              }}
              limit={8}
            />

            {/* 5. One Small Portfolio Insight (Risk Distribution across all 2,054 projects) */}
            <PortfolioRiskInsight
              kpis={portfolioKPIs}
              onViewAnalytics={() => {
                setActiveView('analytics');
                setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 50);
              }}
            />

            {/* 6. PAIMANA Data Trust Banner */}
            <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-900 border border-emerald-700 flex items-center justify-center text-emerald-400 shrink-0">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-white uppercase tracking-widest">PAIMANA</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-900 text-emerald-300 border border-emerald-700 font-mono">LIVE DATASET</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    MoSPI PAIMANA Monthly Flash Reports · Ministry of Statistics &amp; Programme Implementation
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4 sm:gap-6">
                <div className="text-center">
                  <span className="text-xl font-black text-white block">{(allProjects.length || 2054).toLocaleString()}</span>
                  <span className="text-[10px] text-slate-400 font-medium block">Projects</span>
                </div>
                <div className="w-px h-8 bg-slate-700" />
                <div className="text-center">
                  <span className="text-xl font-black text-emerald-400 block">7,499</span>
                  <span className="text-[10px] text-slate-400 font-medium block">Observations</span>
                </div>
                <div className="w-px h-8 bg-slate-700" />
                <div className="text-center">
                  <span className="text-xl font-black text-blue-400 block">APR–JUL</span>
                  <span className="text-[10px] text-slate-400 font-medium block">2026 Reports</span>
                </div>
                <div className="w-px h-8 bg-slate-700" />
                <div className="text-center">
                  <span className="text-xl font-black text-amber-400 block">6</span>
                  <span className="text-[10px] text-slate-400 font-medium block">Risk Indicators</span>
                </div>
              </div>
            </div>

            {/* 7. Data Source Footer */}
            <div className="text-center py-1 text-[11px] text-slate-500 border-t border-slate-100">
              Source: MoSPI PAIMANA Monthly Flash Reports, Apr–Jul 2026 · Sector classifications are derived from implementing agencies · PRISM Risk Engine is fully deterministic
            </div>

          </div>
        )}

        {/* ========================================================================= */}
        {/* 2. PROJECTS: COMPLETE 2,054-PROJECT PORTFOLIO DATABASE                   */}
        {/* ========================================================================= */}
        {activeView === 'projects' && (
          <div id="projects-section" className="space-y-4">

            {/* Projects Header */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
                  National Project Portfolio Database
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Browse, search, and filter all 2,054 monitored infrastructure projects across sectors and states.
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                <span className="px-2.5 py-1 rounded-md bg-slate-100 border border-slate-200">
                  Total Monitored: <strong className="text-slate-900">{allProjects.length || projects.length}</strong> Projects
                  {projects.length !== (allProjects.length || projects.length) && (
                    <span className="text-blue-600 font-medium ml-1">({projects.length} matching filters)</span>
                  )}
                </span>
              </div>
            </div>

            {/* Filter and Search Bar */}
            <FilterBar
              filters={filters}
              onFilterChange={handleFilterUpdate}
              availableSectors={availableSectors}
              availableStates={availableStates}
              totalResults={projects.length}
            />

            {/* Primary Interactive Project Table */}
            <ProjectTable
              projects={projects}
              onSelectProject={(p) => setSelectedProject(p)}
              queueMode={projectQueueMode}
              onQueueModeChange={setProjectQueueMode}
            />
          </div>
        )}

        {/* ========================================================================= */}
        {/* 3. RISK MAP: GEOGRAPHIC SPATIAL VISUALIZATION                            */}
        {/* ========================================================================= */}
        {activeView === 'gis' && (
          <div className="space-y-4">
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
              <h2 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
                National Infrastructure GIS Risk Map
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Geographic spatial visualization of monitored projects. Projects with field geo-coordinates are mapped; non-geocoded PAIMANA records are cataloged in the spatial registry.
              </p>
            </div>
            <GISMap
              projects={allProjects.length > 0 ? allProjects : projects}
              onSelectProject={(p) => setSelectedProject(p)}
              selectedProjectId={selectedProject?.id}
            />
          </div>
        )}

        {/* ========================================================================= */}
        {/* 4. ANALYTICS: DEEP PORTFOLIO & SECTOR ANALYSIS                           */}
        {/* ========================================================================= */}
        {activeView === 'analytics' && (
          <div className="space-y-4">
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
              <h2 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
                Portfolio Risk & Sector Analytics
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Deep diagnostic analysis into capital allocations, schedule slippage distributions, and multi-tier escalation metrics across all 2,054 projects.
              </p>
            </div>
            <SectorAnalytics
              projects={allProjects.length > 0 ? allProjects : projects}
              kpis={portfolioKPIs}
              onSelectProject={(p) => setSelectedProject(p)}
            />
          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="bg-slate-50 border-t border-slate-200 py-4 text-center text-xs text-slate-500">
        <p>
          PRISM (Predictive Risk Intelligence & Smart Monitoring) • SIH 2026 Hackathon Finalist Prototype
        </p>
        <p className="text-[11px] text-slate-600 mt-0.5">
          Grounded on Ministry of Statistics and Programme Implementation (MoSPI) & Prime Minister's Project Monitoring Group (PMG) framework.
        </p>
      </footer>

      {/* Deep-Dive Project Modal (Risk Evidence & Scenario Simulation) */}
      <ProjectDetailModal
        project={selectedProject}
        onClose={() => setSelectedProject(null)}
        onAskCopilotAboutProject={(p) => {
          setSelectedProject(null);
          setIsCopilotOpen(true);
        }}
      />

      {/* Grounded AI Assistant Drawer */}
      <AICopilotDrawer
        isOpen={isCopilotOpen}
        onClose={() => setIsCopilotOpen(false)}
        activeProject={selectedProject}
        onSelectProject={(p) => setSelectedProject(p)}
        allProjects={allProjects.length > 0 ? allProjects : projects}
      />

      {/* Executive Flash Report Modal */}
      <ExecutiveFlashReportModal
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
        kpis={portfolioKPIs}
        criticalProjects={criticalProjects}
      />

      {/* Early Warning Alerts Interactive Modal */}
      <EarlyWarningAlertsModal
        isOpen={isAlertsModalOpen}
        onClose={() => setIsAlertsModalOpen(false)}
        alerts={alerts}
        onSelectProject={(p) => setSelectedProject(p)}
        allProjects={allProjects.length > 0 ? allProjects : projects}
      />

    </div>
  );
}
