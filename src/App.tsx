import React, { useState, useEffect, useMemo } from 'react';
import { Navbar } from './components/Navbar';
import { KPISummary } from './components/KPISummary';
import { FilterBar } from './components/FilterBar';
import { ProjectTable } from './components/ProjectTable';
import { GISMap } from './components/GISMap';
import { SectorAnalytics } from './components/SectorAnalytics';
import { ProjectDetailModal } from './components/ProjectDetailModal';
import { AICopilotDrawer } from './components/AICopilotDrawer';
import { ExecutiveFlashReportModal } from './components/ExecutiveFlashReportModal';
import { DEMO_USER_ROLES, SEEDED_PROJECTS, computePortfolioKPIs } from '../data/projectsData';
import { Project, FilterState, UserRole, PortfolioKPIs } from './types/index';
import { Sparkles, ShieldAlert, ArrowRight, Zap, PlayCircle, Info } from 'lucide-react';

export default function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isCopilotOpen, setIsCopilotOpen] = useState<boolean>(false);
  const [isReportOpen, setIsReportOpen] = useState<boolean>(false);
  const [currentRole, setCurrentRole] = useState<UserRole>(DEMO_USER_ROLES[3]); // Default to SIH 2026 Jury Demo
  const [activeView, setActiveView] = useState<'dashboard' | 'gis' | 'analytics'>('dashboard');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [availableSectors, setAvailableSectors] = useState<string[]>([]);
  const [availableStates, setAvailableStates] = useState<string[]>([]);
  const [dataSource, setDataSource] = useState<'PAIMANA' | 'DEMO'>('PAIMANA');

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

  useEffect(() => {
    fetchProjects();
  }, [filters]);

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
        onChangeView={setActiveView}
      />

      {/* Main Content Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        
        {/* Hackathon Judge Walkthrough Highlight Banner */}
        <div className="p-4 bg-gradient-to-r from-white via-blue-50 to-white border border-blue-600 rounded-2xl shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shrink-0">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  SIH 2026 Judge Evaluation Stream
                </h3>
                <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded font-mono ${dataSource === 'PAIMANA' ? 'bg-blue-600 text-white' : 'bg-amber-600 text-white'}`}>
                  {dataSource} ACTIVE
                </span>
              </div>
              <p className="text-xs text-slate-700 mt-0.5">
                Experience the 5-step evaluation flow: National KPIs → Critical Project Inspection → TreeSHAP Feature Attribution → Real-time What-If Policy Simulation → Grounded Copilot.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={triggerJudgeFlow}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white transition-all shadow-md shadow-amber-500/20"
            >
              <PlayCircle className="w-4 h-4" />
              <span>Launch Judge Walkthrough (USBRL)</span>
            </button>
          </div>
        </div>

        {/* Top KPI Metric Cards */}
        <KPISummary
          kpis={kpis}
          onFilterRisk={(tier) => handleFilterUpdate({ riskTier: tier })}
          selectedTier={filters.riskTier}
        />

        {/* View Switcher Output */}
        {activeView === 'dashboard' && (
          <div className="space-y-4">
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

      {/* Deep-Dive Project Modal (SHAP & What-If Simulation) */}
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
