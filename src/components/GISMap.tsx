import React, { useState, useMemo } from 'react';
import { 
  Compass, MapPin, ExternalLink, Filter, Search, RotateCcw,
  Building2, AlertTriangle, CheckCircle2, ChevronRight, Layers
} from 'lucide-react';
import { Project, RiskTier } from '../types/index';

interface GISMapProps {
  projects: Project[];
  onSelectProject: (project: Project) => void;
  selectedProjectId?: string;
}

export const GISMap: React.FC<GISMapProps> = ({ projects, onSelectProject, selectedProjectId }) => {
  const [hoveredProject, setHoveredProject] = useState<Project | null>(null);
  const [riskTierFilter, setRiskTierFilter] = useState<string>('ALL');
  const [stateFilter, setStateFilter] = useState<string>('ALL');
  const [sectorFilter, setSectorFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedStateForDrilldown, setSelectedStateForDrilldown] = useState<string | null>(null);

  // Extract available states and sectors dynamically from projects
  const availableStates = useMemo(() => {
    const set = new Set<string>();
    for (const p of projects) {
      if (p.state) set.add(p.state);
    }
    return Array.from(set).sort();
  }, [projects]);

  const availableSectors = useMemo(() => {
    const set = new Set<string>();
    for (const p of projects) {
      if (p.sector) set.add(p.sector);
    }
    return Array.from(set).sort();
  }, [projects]);

  // Apply filters: Risk Tier, State, Sector, Search
  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      if (riskTierFilter !== 'ALL' && p.riskTier !== riskTierFilter) return false;
      if (stateFilter !== 'ALL' && p.state !== stateFilter) return false;
      if (sectorFilter !== 'ALL' && p.sector !== sectorFilter) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchName = p.name?.toLowerCase().includes(query);
        const matchId = p.id?.toLowerCase().includes(query);
        const matchAgency = p.implementingAgency?.toLowerCase().includes(query);
        if (!matchName && !matchId && !matchAgency) return false;
      }
      return true;
    });
  }, [projects, riskTierFilter, stateFilter, sectorFilter, searchQuery]);

  // Strictly omit projects without valid geocoordinates (zero coordinate fabrication)
  const geolocatedProjects = useMemo(() => {
    return filteredProjects.filter(
      p => p.location?.lat != null && p.location?.lng != null && p.location.lat > 0 && p.location.lng > 0
    );
  }, [filteredProjects]);

  // State-wise registry from filtered projects
  const stateRegistry = useMemo(() => {
    const map = new Map<string, {
      state: string;
      projectCount: number;
      totalBudgetCr: number;
      criticalCount: number;
      highCount: number;
      totalRisk: number;
      ratedCount: number;
      totalProgress: number;
    }>();

    for (const p of filteredProjects) {
      const st = p.state || 'Unspecified';
      if (!map.has(st)) {
        map.set(st, {
          state: st,
          projectCount: 0,
          totalBudgetCr: 0,
          criticalCount: 0,
          highCount: 0,
          totalRisk: 0,
          ratedCount: 0,
          totalProgress: 0
        });
      }
      const entry = map.get(st)!;
      entry.projectCount++;
      entry.totalBudgetCr += (p.revisedCostCr || 0);
      entry.totalProgress += (p.physicalProgressPercent || 0);
      if (p.riskTier === 'CRITICAL') entry.criticalCount++;
      if (p.riskTier === 'HIGH') entry.highCount++;
      if (p.riskScore != null) {
        entry.totalRisk += p.riskScore;
        entry.ratedCount++;
      }
    }

    return Array.from(map.values())
      .map(entry => ({
        state: entry.state,
        projectCount: entry.projectCount,
        totalBudgetCr: Math.round(entry.totalBudgetCr),
        avgRiskScore: entry.ratedCount > 0 ? parseFloat((entry.totalRisk / entry.ratedCount).toFixed(1)) : 0,
        criticalCount: entry.criticalCount,
        highCount: entry.highCount,
        avgPhysicalProgress: entry.projectCount > 0 ? parseFloat((entry.totalProgress / entry.projectCount).toFixed(1)) : 0
      }))
      .sort((a, b) => b.projectCount - a.projectCount);
  }, [filteredProjects]);

  // Projects in the selected drilldown state
  const stateProjectsList = useMemo(() => {
    if (!selectedStateForDrilldown) return [];
    return filteredProjects.filter(p => p.state === selectedStateForDrilldown);
  }, [filteredProjects, selectedStateForDrilldown]);

  // Convert Indian Latitude (approx 8°N to 37°N) & Longitude (approx 68°E to 97°E) to SVG Percentage coordinates
  const projectToCoords = (lat: number, lng: number) => {
    const minLat = 7.5;
    const maxLat = 36.5;
    const minLng = 67.5;
    const maxLng = 96.5;

    const x = ((lng - minLng) / (maxLng - minLng)) * 80 + 10;
    const y = ((maxLat - lat) / (maxLat - minLat)) * 80 + 8;

    return { x: Math.max(5, Math.min(95, x)), y: Math.max(5, Math.min(95, y)) };
  };

  const getPinColor = (tier: RiskTier) => {
    switch (tier) {
      case 'CRITICAL':
        return { bg: 'bg-red-500', border: 'border-red-300', text: 'text-red-600', ring: 'border-red-500/40' };
      case 'HIGH':
        return { bg: 'bg-orange-500', border: 'border-orange-300', text: 'text-orange-600', ring: 'border-orange-500/40' };
      case 'MODERATE':
        return { bg: 'bg-yellow-500', border: 'border-yellow-300', text: 'text-amber-600', ring: 'border-yellow-500/40' };
      case 'LOW':
        return { bg: 'bg-emerald-500', border: 'border-emerald-300', text: 'text-emerald-600', ring: 'border-emerald-500/40' };
      case 'UNRATED':
      default:
        return { bg: 'bg-slate-500', border: 'border-slate-300', text: 'text-slate-600', ring: 'border-slate-500/40' };
    }
  };

  const resetFilters = () => {
    setRiskTierFilter('ALL');
    setStateFilter('ALL');
    setSectorFilter('ALL');
    setSearchQuery('');
    setSelectedStateForDrilldown(null);
  };

  const hasActiveFilters = riskTierFilter !== 'ALL' || stateFilter !== 'ALL' || sectorFilter !== 'ALL' || searchQuery.trim() !== '';

  return (
    <div className="space-y-6">
      
      {/* Map Control Bar & Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2">
              <Compass className="w-5 h-5 text-blue-600" />
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                National Infrastructure GIS Risk Surface & State Registry
              </h2>
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              Geographic coverage across 2,054 PAIMANA projects with zero coordinate fabrication.
            </p>
          </div>

          {/* Active Filter Counter & Reset */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold px-2 py-1 rounded bg-slate-100 text-slate-700 border border-slate-200">
              {filteredProjects.length.toLocaleString()} of {projects.length.toLocaleString()} Projects
            </span>
            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-semibold px-2 py-1 rounded hover:bg-blue-50 transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Filter Selectors Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3">
          
          {/* Risk Tier Filter */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Risk Tier
            </label>
            <select
              value={riskTierFilter}
              onChange={(e) => setRiskTierFilter(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
            >
              <option value="ALL">All Risk Tiers (2,054)</option>
              <option value="CRITICAL">Critical (80–100)</option>
              <option value="HIGH">High (60–79)</option>
              <option value="MODERATE">Moderate (40–59)</option>
              <option value="LOW">Low (0–39)</option>
            </select>
          </div>

          {/* State Filter */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              State / Union Territory
            </label>
            <select
              value={stateFilter}
              onChange={(e) => {
                setStateFilter(e.target.value);
                if (e.target.value !== 'ALL') setSelectedStateForDrilldown(e.target.value);
              }}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
            >
              <option value="ALL">All States ({availableStates.length})</option>
              {availableStates.map(st => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>
          </div>

          {/* Sector Filter */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Sector
            </label>
            <select
              value={sectorFilter}
              onChange={(e) => setSectorFilter(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
            >
              <option value="ALL">All Sectors ({availableSectors.length})</option>
              {availableSectors.map(sec => (
                <option key={sec} value={sec}>{sec}</option>
              ))}
            </select>
          </div>

          {/* Search Query */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Project Search
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search name or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

        </div>
      </div>

      {/* Map Canvas Container */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <div className="relative w-full h-[480px] bg-gradient-to-b from-slate-50 via-slate-100 to-slate-50 rounded-xl border border-slate-200 overflow-hidden select-none">
          
          {/* Cartographic Grid Lines */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b0a_1px,transparent_1px),linear-gradient(to_bottom,#1e293b0a_1px,transparent_1px)] bg-[size:4rem_4rem]"></div>
          
          {/* Stylized India Geography Contour Background SVG */}
          <svg
            className="absolute inset-0 w-full h-full opacity-25 pointer-events-none stroke-slate-600 fill-slate-700/5"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            <path
              d="M 28 10 
                 Q 35 6, 42 10 
                 Q 52 14, 58 20 
                 Q 72 22, 86 24 
                 Q 92 28, 86 34 
                 Q 78 35, 75 32 
                 Q 68 36, 64 42 
                 Q 62 55, 56 68 
                 Q 50 82, 45 92 
                 Q 38 82, 34 68 
                 Q 26 56, 22 46 
                 Q 16 38, 22 28 
                 Q 26 22, 28 10 Z"
              strokeWidth="0.8"
              strokeDasharray="2 2"
            />
            <line x1="5" y1="48" x2="95" y2="48" stroke="#334155" strokeWidth="0.4" strokeDasharray="3 3" />
            <text x="7" y="46" fill="#64748b" fontSize="2.2" fontStyle="italic">23.5° N Tropic of Cancer</text>
          </svg>

          {/* Informative Overlay when 0 Projects Have GPS Coordinates */}
          {geolocatedProjects.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center p-6">
              <div className="bg-white/95 backdrop-blur-md border border-slate-300 rounded-2xl p-6 text-center max-w-lg shadow-xl pointer-events-auto">
                <div className="w-12 h-12 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center mx-auto mb-3 text-blue-600">
                  <Compass className="w-6 h-6" />
                </div>
                
                <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  MoSPI PAIMANA Geographic Coverage Notice
                </h4>
                
                <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                  The official MoSPI PAIMANA dataset tracks projects by administrative <strong>State</strong> and <strong>Agency</strong>, but does not provide field GPS latitude/longitude coordinates.
                </p>
                
                <p className="text-[11px] text-slate-500 mt-1.5 font-medium bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  🛡️ <strong>Zero Coordinate Fabrication</strong>: In strict accordance with PRISM data integrity governance, no synthetic pins or arbitrary coordinates are generated. All projects are accurately cataloged in the <strong>National State Registry</strong> below.
                </p>

                {/* Filtered Portfolio Highlights */}
                <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-200 text-center">
                  <div className="p-2 bg-slate-50 rounded-lg">
                    <span className="text-[10px] text-slate-500 uppercase block">Filtered Projects</span>
                    <span className="text-xs font-mono font-bold text-slate-900">{filteredProjects.length.toLocaleString()}</span>
                  </div>
                  <div className="p-2 bg-slate-50 rounded-lg">
                    <span className="text-[10px] text-slate-500 uppercase block">Active States</span>
                    <span className="text-xs font-mono font-bold text-blue-600">{stateRegistry.length}</span>
                  </div>
                  <div className="p-2 bg-slate-50 rounded-lg">
                    <span className="text-[10px] text-slate-500 uppercase block">High / Critical</span>
                    <span className="text-xs font-mono font-bold text-red-600">
                      {filteredProjects.filter(p => p.riskTier === 'CRITICAL' || p.riskTier === 'HIGH').length}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Project Geo Pins for geocoded projects (e.g. DEMO mode or future geocoded projects) */}
          {geolocatedProjects.map((p) => {
            const coords = projectToCoords(p.location.lat!, p.location.lng!);
            const colors = getPinColor(p.riskTier);
            const isSelected = p.id === selectedProjectId;

            return (
              <div
                key={p.id}
                style={{ left: `${coords.x}%`, top: `${coords.y}%` }}
                className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer z-10 group"
                onMouseEnter={() => setHoveredProject(p)}
                onMouseLeave={() => setHoveredProject(null)}
                onClick={() => onSelectProject(p)}
              >
                {p.riskTier === 'CRITICAL' && (
                  <span className="absolute -inset-2 rounded-full bg-red-500/30 animate-ping pointer-events-none" />
                )}

                <div
                  className={`w-6 h-6 rounded-full ${colors.bg} border-2 ${colors.border} flex items-center justify-center text-white font-black text-[10px] shadow-lg transition-transform transform group-hover:scale-125 ${
                    isSelected ? 'ring-4 ring-amber-400 scale-125' : ''
                  }`}
                >
                  {p.riskScore != null ? p.riskScore : '—'}
                </div>

                <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute top-7 left-1/2 -translate-x-1/2 whitespace-nowrap bg-slate-900 border border-slate-700 text-white text-[11px] font-medium px-2 py-1 rounded shadow-xl pointer-events-none z-30">
                  {p.name.split('(')[0]}
                  <span className="ml-1 text-slate-400">({p.location.city || p.state})</span>
                </div>
              </div>
            );
          })}

          {/* Hover Card for geocoded projects */}
          {hoveredProject && (
            <div className="absolute bottom-4 left-4 max-w-sm bg-slate-900/95 border border-slate-700 text-white rounded-xl p-4 shadow-2xl backdrop-blur z-20">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400">
                    {hoveredProject.sector} • {hoveredProject.state}
                  </span>
                  <h4 className="text-xs font-bold mt-0.5 leading-snug">
                    {hoveredProject.name}
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Agency: {hoveredProject.implementingAgency}
                  </p>
                </div>
                <div className="text-right whitespace-nowrap">
                  <span className="px-2 py-0.5 text-[10px] font-extrabold rounded-full bg-red-500 text-white">
                    {hoveredProject.riskScore} • {hoveredProject.riskTier}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 mt-3 pt-2 border-t border-slate-700 text-[11px]">
                <div>
                  <span className="text-slate-400">Revised Outlay:</span>
                  <p className="font-semibold">₹{hoveredProject.revisedCostCr.toLocaleString()} Cr</p>
                </div>
                <div>
                  <span className="text-slate-400">Delay:</span>
                  <p className="font-semibold text-orange-400">+{hoveredProject.timeOverrunMonths} mo</p>
                </div>
              </div>

              <button
                onClick={() => onSelectProject(hoveredProject)}
                className="mt-3 w-full py-1.5 px-3 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-colors"
              >
                <span>Inspect Project Details</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Quick Legend in bottom right */}
          <div className="absolute bottom-3 right-3 flex items-center gap-2 bg-white/90 backdrop-blur px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs">
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-500"></span>
              <span className="text-[10px] font-bold text-slate-700">Critical (80–100)</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-orange-500"></span>
              <span className="text-[10px] font-bold text-slate-700">High (60–79)</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
              <span className="text-[10px] font-bold text-slate-700">Moderate (40–59)</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span className="text-[10px] font-bold text-slate-700">Low (0–39)</span>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* NATIONAL GEOGRAPHIC STATE & CORRIDOR REGISTRY                             */}
      {/* ========================================================================= */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-600" />
              National Geographic State & Corridor Registry ({stateRegistry.length} States / UTs)
            </h3>
            <p className="text-xs text-slate-600 mt-0.5">
              Verified administrative distribution of {filteredProjects.length.toLocaleString()} matching infrastructure projects. Click any state to drill down into project rosters.
            </p>
          </div>

          {selectedStateForDrilldown && (
            <button
              onClick={() => setSelectedStateForDrilldown(null)}
              className="text-xs text-blue-600 hover:text-blue-800 font-bold px-2 py-1 rounded bg-blue-50"
            >
              Clear Drilldown ({selectedStateForDrilldown})
            </button>
          )}
        </div>

        {/* State Table */}
        <div className="overflow-x-auto max-h-80 overflow-y-auto border border-slate-200 rounded-lg">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-slate-900 uppercase font-bold text-[10px] tracking-wider border-b border-slate-200 sticky top-0 z-10">
              <tr>
                <th className="py-2.5 px-3">State / Jurisdiction</th>
                <th className="py-2.5 px-3 text-right">Matching Projects</th>
                <th className="py-2.5 px-3 text-right">Total Outlay (₹ Cr)</th>
                <th className="py-2.5 px-3 text-right">Avg Risk Score</th>
                <th className="py-2.5 px-3 text-right">Critical</th>
                <th className="py-2.5 px-3 text-right">High Risk</th>
                <th className="py-2.5 px-3 text-right">Avg Progress</th>
                <th className="py-2.5 px-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {stateRegistry.map((st) => (
                <tr 
                  key={st.state}
                  onClick={() => setSelectedStateForDrilldown(selectedStateForDrilldown === st.state ? null : st.state)}
                  className={`cursor-pointer transition-colors ${
                    selectedStateForDrilldown === st.state 
                      ? 'bg-blue-50/80 border-l-4 border-blue-600 font-medium' 
                      : 'hover:bg-slate-50/80'
                  }`}
                >
                  <td className="py-2 px-3 font-semibold text-slate-900 flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    {st.state}
                  </td>
                  <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">{st.projectCount}</td>
                  <td className="py-2 px-3 text-right font-mono text-slate-900">₹{st.totalBudgetCr.toLocaleString()}</td>
                  <td className="py-2 px-3 text-right font-mono font-bold">
                    <span className={`px-2 py-0.5 rounded text-[11px] ${
                      st.avgRiskScore >= 60 ? 'bg-red-50 text-red-700 border border-red-200' :
                      st.avgRiskScore >= 45 ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                      'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    }`}>
                      {st.avgRiskScore}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-right font-mono text-red-600 font-bold">{st.criticalCount}</td>
                  <td className="py-2 px-3 text-right font-mono text-orange-600 font-bold">{st.highCount}</td>
                  <td className="py-2 px-3 text-right font-mono text-emerald-700 font-bold">{st.avgPhysicalProgress}%</td>
                  <td className="py-2 px-3 text-center">
                    <span className="text-[11px] font-bold text-blue-600 hover:text-blue-800">
                      {selectedStateForDrilldown === st.state ? 'Close' : 'View Projects'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* State Drilldown Projects Grid */}
        {selectedStateForDrilldown && (
          <div className="mt-4 pt-4 border-t border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-600" />
                Projects in {selectedStateForDrilldown} ({stateProjectsList.length} projects)
              </h4>
              <span className="text-xs text-slate-500 font-mono">
                Click any project card to open full risk assessment
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {stateProjectsList.slice(0, 12).map((p) => (
                <div
                  key={p.id}
                  onClick={() => onSelectProject(p)}
                  className="p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-blue-500 rounded-lg cursor-pointer transition-all group"
                >
                  <div className="flex items-start justify-between gap-1">
                    <div>
                      <span className="text-[10px] font-mono text-slate-500">{p.id}</span>
                      <h5 className="text-xs font-bold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-1">
                        {p.name}
                      </h5>
                      <span className="text-[10px] text-slate-600">{p.sector}</span>
                    </div>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-black shrink-0 ${
                      p.riskTier === 'CRITICAL' ? 'bg-red-100 text-red-800 border border-red-200' :
                      p.riskTier === 'HIGH' ? 'bg-orange-100 text-orange-800 border border-orange-200' :
                      'bg-amber-100 text-amber-800 border border-amber-200'
                    }`}>
                      Risk: {p.riskScore}
                    </span>
                  </div>

                  <div className="mt-2 flex items-center justify-between text-[10px] text-slate-600 pt-1.5 border-t border-slate-200">
                    <span>Progress: <strong>{p.physicalProgressPercent}%</strong></span>
                    <span>Delay: <strong className="text-orange-600">+{p.timeOverrunMonths} mo</strong></span>
                    <span className="font-mono font-semibold">₹{p.revisedCostCr.toLocaleString()} Cr</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

    </div>
  );
};
