import React, { useState, useEffect, useMemo } from 'react';
import { Navbar } from './components/Navbar';
import { KPISummary } from './components/KPISummary';
import { FilterBar } from './components/FilterBar';
import { ProjectTable } from './components/ProjectTable';
import { GISMap } from './components/GISMap';
import { SectorAnalytics } from './components/SectorAnalytics';
import { SectorCards } from './components/SectorCards';
import { ProjectDetailModal } from './components/ProjectDetailModal';
import { AICopilotDrawer } from './components/AICopilotDrawer';
import { ExecutiveFlashReportModal } from './components/ExecutiveFlashReportModal';
import { DEMO_USER_ROLES, SEEDED_PROJECTS, computePortfolioKPIs } from '../data/projectsData';
import { Project, FilterState, UserRole, PortfolioKPIs, SectorStat } from './types/index';
import { Sparkles, ShieldAlert, ArrowRight, Zap, PlayCircle, Info, FileText } from 'lucide-react';

export default function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isCopilotOpen, setIsCopilotOpen] = useState<boolean>(false);
  const [isReportOpen, setIsReportOpen] = useState<boolean>(false);
  const [currentRole, setCurrentRole] = useState<UserRole>(DEMO_USER_ROLES[3]); // Default to SIH 2026 Jury Demo
  const [activeView, setActiveView] = useState<'dashboard' | 'projects' | 'gis' | 'analytics'>('dashboard');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [availableSectors, setAvailableSectors] = useState<string[]>([]);
  const [availableStates, setAvailableStates] = useState<string[]>([]);
  const [dataSource, setDataSource] = useState<'PAIMANA' | 'DEMO'>('PAIMANA');
  const [sectorStats, setSectorStats] = useState<SectorStat[]>([]);
  const [isSectorsLoading, setIsSectorsLoading] = useState<boolean>(false);

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

  // Fetch projects from backend API
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
        setProjects(data.projects);
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

  useEffect(() => {
    fetchProjects();
  }, [filters]);

  useEffect(() => {
    fetchSectors();
  }, [dataSource]);

  // Compute live KPIs
  const kpis: PortfolioKPIs = useMemo(() => {
    return computePortfolioKPIs(projects);
  }, [projects]);

  // Critical projects list for report
  const criticalProjects = useMemo(() => {
    return projects.filter(p => p.riskTier === 'CRITICAL').sort((a, b) => (b.riskScore || 0) - (a.riskScore || 0));
  }, [projects]);

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
      fetchProjects();
      fetchSectors();
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
      await fetchProjects();
      const res = await fetch('/api/projects/PRJ-IN-001');
      if (res.ok) {
        const usbrl = await res.json();
        setSelectedProject(usbrl);
      }
    } catch (err) {
      console.error('Judge flow error:', err);
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
        onSelectRole={setCurrentRole}
        onOpenCopilot={() => setIsCopilotOpen(true)}
        onOpenReport={() => setIsReportOpen(true)}
        onResetDemo={handleResetDemo}
        isCopilotOpen={isCopilotOpen}
        activeView={activeView}
        onChangeView={handleChangeView}
      />

      {/* Main Content Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        
        {/* Decision Intelligence Hero Banner */}
        {activeView === 'dashboard' && (
          <div className="p-4 bg-gradient-to-r from-white via-blue-50/60 to-white border border-blue-600 rounded-2xl shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shrink-0">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    SIH 2026 DECISION INTELLIGENCE STREAM
                  </h3>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded font-mono ${dataSource === 'PAIMANA' ? 'bg-blue-600 text-white' : 'bg-amber-600 text-white'}`}>
                    {dataSource} {dataSource === 'DEMO' ? 'SHOWCASE' : 'ACTIVE'}
                  </span>
                </div>
                <p className="text-xs text-slate-700 mt-0.5">
                  Monitor 2,054 infrastructure projects using real PAIMANA monthly observations.
                </p>
                <div className="flex items-center gap-1.5 mt-1 text-[11px] font-medium text-blue-700">
                  <span>Evaluation flow:</span>
                  <span className="font-semibold text-slate-800">Monitor → Assess Risk → Explain → Prioritize → Act</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setIsReportOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 transition-all shadow-sm"
                title="Generate MoSPI Executive Flash Report"
              >
                <FileText className="w-4 h-4 text-blue-600" />
                <span>Flash Report</span>
              </button>
              <button
                onClick={triggerJudgeFlow}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white transition-all shadow-sm"
                title="Switch to Demo Showcase preset with USBRL deep-dive"
              >
                <PlayCircle className="w-4 h-4" />
                <span>Launch Judge Demo Mode (USBRL)</span>
              </button>
            </div>
          </div>
        )}

        {/* Top KPI Metric Cards */}
        {(activeView === 'dashboard' || activeView === 'projects') && (
          <KPISummary
            kpis={kpis}
            onFilterRisk={(tier) => handleFilterUpdate({ riskTier: tier })}
            selectedTier={filters.riskTier}
          />
        )}

        {/* Infrastructure Sector Cards (Phase 3 Presentation) */}
        {activeView === 'dashboard' && (
          <SectorCards
            sectors={sectorStats}
            selectedSector={filters.sector}
            onSelectSector={(sec) => handleFilterUpdate({ sector: sec })}
            isLoading={isSectorsLoading}
          />
        )}

        {/* View Switcher Output */}
        {(activeView === 'dashboard' || activeView === 'projects') && (
          <div id="projects-section" className="space-y-4">
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
            />
          </div>
        )}

        {activeView === 'gis' && (
          <GISMap
            projects={projects}
            onSelectProject={(p) => setSelectedProject(p)}
            selectedProjectId={selectedProject?.id}
          />
        )}

        {activeView === 'analytics' && (
          <SectorAnalytics
            projects={projects}
            kpis={kpis}
            onSelectProject={(p) => setSelectedProject(p)}
          />
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
        allProjects={projects.length > 0 ? projects : (dataSource === 'DEMO' ? SEEDED_PROJECTS : [])}
      />

      {/* Executive Flash Report Modal */}
      <ExecutiveFlashReportModal
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
        kpis={kpis}
        criticalProjects={criticalProjects}
      />

    </div>
  );
}
