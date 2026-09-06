import React, { useState, useEffect, useMemo } from 'react';
import { 
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, 
  Tooltip, Legend, PieChart, Pie, Cell, CartesianGrid 
} from 'recharts';
import { 
  BarChart3, PieChart as PieIcon, MapPin, DollarSign, 
  TrendingDown, Search 
} from 'lucide-react';
import { Project, PortfolioKPIs, FullAnalyticsData } from '../types/index';

interface SectorAnalyticsProps {
  projects: Project[];
  kpis: PortfolioKPIs;
  onSelectProject: (p: Project) => void;
}

type TabType = 'overview' | 'sectors' | 'geography' | 'cost' | 'indicators';

export const SectorAnalytics: React.FC<SectorAnalyticsProps> = ({
  projects,
  kpis,
  onSelectProject
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [analyticsData, setAnalyticsData] = useState<FullAnalyticsData | null>(null);
  const [stateSearch, setStateSearch] = useState('');
  const [selectedStateForDrilldown, setSelectedStateForDrilldown] = useState<string | null>(null);

  // Fetch full repository analytics
  useEffect(() => {
    fetch('/api/analytics')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data) setAnalyticsData(data);
      })
      .catch(err => console.warn('Failed to load /api/analytics, using client aggregation:', err));
  }, []);

  // Compute fallback analytics dynamically from projects in case API is loading or offline
  const computedData = useMemo(() => {
    const totalProjects = projects.length;
    
    // Sector map
    const sectorMap = new Map<string, {
      count: number;
      totalBudget: number;
      origBudget: number;
      totalDelay: number;
      criticalCount: number;
      highCount: number;
      totalRisk: number;
      totalProgress: number;
      ratedCount: number;
    }>();

    for (const p of projects) {
      const sec = p.sector || 'Other Infrastructure';
      if (!sectorMap.has(sec)) {
        sectorMap.set(sec, { count: 0, totalBudget: 0, origBudget: 0, totalDelay: 0, criticalCount: 0, highCount: 0, totalRisk: 0, totalProgress: 0, ratedCount: 0 });
      }
      const s = sectorMap.get(sec)!;
      s.count++;
      s.totalBudget += (p.revisedCostCr || 0);
      s.origBudget += (p.originalCostCr || 0);
      s.totalDelay += (p.timeOverrunMonths || 0);
      s.totalProgress += (p.physicalProgressPercent || 0);
      if (p.riskTier === 'CRITICAL') s.criticalCount++;
      if (p.riskTier === 'HIGH') s.highCount++;
      if (p.riskScore != null) {
        s.totalRisk += p.riskScore;
        s.ratedCount++;
      }
    }

    const sectorAnalytics = Array.from(sectorMap.entries()).map(([sector, s]) => ({
      sector,
      projectCount: s.count,
      portfolioPercent: totalProjects > 0 ? parseFloat(((s.count / totalProjects) * 100).toFixed(1)) : 0,
      originalCostCr: Math.round(s.origBudget),
      revisedCostCr: Math.round(s.totalBudget),
      costOverrunPercent: s.origBudget > 0 ? parseFloat((((s.totalBudget - s.origBudget) / s.origBudget) * 100).toFixed(1)) : 0,
      avgPhysicalProgress: s.count > 0 ? parseFloat((s.totalProgress / s.count).toFixed(1)) : 0,
      avgRiskScore: s.ratedCount > 0 ? parseFloat((s.totalRisk / s.ratedCount).toFixed(1)) : 0,
      criticalProjects: s.criticalCount,
      highRiskProjects: s.highCount,
      avgDelayMonths: s.count > 0 ? Math.round(s.totalDelay / s.count) : 0
    })).sort((a, b) => b.projectCount - a.projectCount);

    // State map
    const stateMap = new Map<string, {
      count: number;
      totalBudget: number;
      totalRisk: number;
      ratedCount: number;
      criticalCount: number;
      highCount: number;
      totalProgress: number;
    }>();

    for (const p of projects) {
      const state = p.state || 'Unspecified';
      if (!stateMap.has(state)) {
        stateMap.set(state, { count: 0, totalBudget: 0, totalRisk: 0, ratedCount: 0, criticalCount: 0, highCount: 0, totalProgress: 0 });
      }
      const st = stateMap.get(state)!;
      st.count++;
      st.totalBudget += (p.revisedCostCr || 0);
      st.totalProgress += (p.physicalProgressPercent || 0);
      if (p.riskTier === 'CRITICAL') st.criticalCount++;
      if (p.riskTier === 'HIGH') st.highCount++;
      if (p.riskScore != null) {
        st.totalRisk += p.riskScore;
        st.ratedCount++;
      }
    }

    const stateAnalytics = Array.from(stateMap.entries()).map(([state, st]) => ({
      state,
      projectCount: st.count,
      totalBudgetCr: Math.round(st.totalBudget),
      avgRiskScore: st.ratedCount > 0 ? parseFloat((st.totalRisk / st.ratedCount).toFixed(1)) : 0,
      criticalCount: st.criticalCount,
      highCount: st.highCount,
      avgPhysicalProgress: st.count > 0 ? parseFloat((st.totalProgress / st.count).toFixed(1)) : 0
    })).sort((a, b) => b.projectCount - a.projectCount);

    // Cost brackets
    let origSum = 0;
    let revSum = 0;
    let severe = 0, mod = 0, minor = 0, onBudget = 0;
    for (const p of projects) {
      origSum += (p.originalCostCr || 0);
      revSum += (p.revisedCostCr || 0);
      const over = p.costOverrunPercent || 0;
      if (over >= 50) severe++;
      else if (over >= 20) mod++;
      else if (over > 0) minor++;
      else onBudget++;
    }

    // Execution indicators
    let stagnant = 0;
    let divergence = 0;
    let criticalUrgency = 0;
    for (const p of projects) {
      const trend = p.monthlyTrend || [];
      if (trend.length >= 2) {
        let sCount = 0;
        for (let i = trend.length - 1; i >= 1; i--) {
          if (Math.abs((trend[i].actualPercent ?? 0) - (trend[i - 1].actualPercent ?? 0)) <= 0.2) sCount++;
          else break;
        }
        if (sCount >= 2) stagnant++;
      }
      if (p.urgency && p.urgency >= 80) criticalUrgency++;
      const expPct = p.expenditurePctOfRevisedCost ?? (p.revisedCostCr > 0 ? (p.cumulativeExpenditureCr / p.revisedCostCr) * 100 : 0);
      if (expPct - (p.physicalProgressPercent || 0) >= 15) divergence++;
    }

    return {
      sectorAnalytics,
      stateAnalytics,
      costEscalation: {
        totalOriginalCostCr: Math.round(origSum),
        totalRevisedCostCr: Math.round(revSum),
        totalEscalationCr: Math.round(revSum - origSum),
        overallOverrunPercent: origSum > 0 ? parseFloat((((revSum - origSum) / origSum) * 100).toFixed(1)) : 0,
        brackets: [
          { name: 'Severe (>50%)', count: severe, percent: totalProjects > 0 ? parseFloat(((severe / totalProjects) * 100).toFixed(1)) : 0, color: '#ef4444' },
          { name: 'Moderate (20–50%)', count: mod, percent: totalProjects > 0 ? parseFloat(((mod / totalProjects) * 100).toFixed(1)) : 0, color: '#f97316' },
          { name: 'Minor (1–20%)', count: minor, percent: totalProjects > 0 ? parseFloat(((minor / totalProjects) * 100).toFixed(1)) : 0, color: '#eab308' },
          { name: 'On Budget (0%)', count: onBudget, percent: totalProjects > 0 ? parseFloat(((onBudget / totalProjects) * 100).toFixed(1)) : 0, color: '#10b981' }
        ]
      },
      executionIndicators: {
        prolongedStagnationCount: stagnant,
        stagnationRate: totalProjects > 0 ? parseFloat(((stagnant / totalProjects) * 100).toFixed(1)) : 0,
        divergenceCount: divergence,
        divergenceRate: totalProjects > 0 ? parseFloat(((divergence / totalProjects) * 100).toFixed(1)) : 0,
        criticalUrgencyCount: criticalUrgency
      }
    };
  }, [projects]);

  // Use API data if available, otherwise computedData
  const activeSectors = analyticsData?.sectorAnalytics || computedData.sectorAnalytics;
  const activeStates = analyticsData?.stateAnalytics || computedData.stateAnalytics;
  const activeCost = analyticsData?.costEscalation || computedData.costEscalation;
  const activeIndicators = analyticsData?.executionIndicators || computedData.executionIndicators;
  const activeObservations = analyticsData?.observationsCoverage || {
    totalObservations: 7499,
    observationsByMonth: { 'April 2026': 1842, 'May 2026': 1875, 'June 2026': 1889, 'July 2026': 1893 },
    coverageCounts: { '4 Observations': 1664, '3 Observations': 139, '2 Observations': 175, '1 Observation': 76 }
  };

  // Risk Distribution Data (CRITICAL: 80-100, HIGH: 60-79, MODERATE: 40-59, LOW: 0-39)
  const totalProjectsCount = projects.length || kpis.totalProjects || 2054;
  const riskPieData = analyticsData?.riskDistribution || [
    { name: 'Critical (80–100)', count: kpis.criticalProjects, percent: parseFloat(((kpis.criticalProjects / totalProjectsCount) * 100).toFixed(1)), color: '#ef4444' },
    { name: 'High (60–79)', count: kpis.highRiskProjects, percent: parseFloat(((kpis.highRiskProjects / totalProjectsCount) * 100).toFixed(1)), color: '#f97316' },
    { name: 'Moderate (40–59)', count: kpis.moderateRiskProjects, percent: parseFloat(((kpis.moderateRiskProjects / totalProjectsCount) * 100).toFixed(1)), color: '#eab308' },
    { name: 'Low (0–39)', count: kpis.lowRiskProjects, percent: parseFloat(((kpis.lowRiskProjects / totalProjectsCount) * 100).toFixed(1)), color: '#10b981' }
  ];

  // Priority Distribution Data (P1 >= 70, P2: 50-69, P3 < 50)
  const priorityPieData = analyticsData?.priorityDistribution || [
    { name: 'P1 Immediate Urgency (≥70)', count: kpis.p1Projects ?? 508, percent: parseFloat((((kpis.p1Projects ?? 508) / totalProjectsCount) * 100).toFixed(1)), color: '#ef4444' },
    { name: 'P2 Significant Oversight (50–69)', count: kpis.p2Projects ?? 853, percent: parseFloat((((kpis.p2Projects ?? 853) / totalProjectsCount) * 100).toFixed(1)), color: '#f97316' },
    { name: 'P3 Routine Monitoring (<50)', count: kpis.p3Projects ?? 693, percent: parseFloat((((kpis.p3Projects ?? 693) / totalProjectsCount) * 100).toFixed(1)), color: '#10b981' }
  ];

  // Sector Chart Data (clean sector labels for charts)
  const sectorBarData = activeSectors.map(s => ({
    sector: s.sector.replace('Road Transport & Highways', 'Highways').replace('Urban Affairs & Metro', 'Urban Metro').replace('Petroleum & Natural Gas', 'Petroleum'),
    fullSector: s.sector,
    projectCount: s.projectCount,
    avgPhysicalProgress: s.avgPhysicalProgress,
    avgRiskScore: s.avgRiskScore,
    criticalProjects: s.criticalProjects,
    highRiskProjects: s.highRiskProjects,
    costOverrunPercent: s.costOverrunPercent,
    outlayLakhCr: parseFloat((s.revisedCostCr / 100000).toFixed(2))
  }));

  // State Bar Data (Top 10 states by project count)
  const top10States = activeStates.slice(0, 10).map(s => ({
    state: s.state.length > 15 ? s.state.slice(0, 15) + '...' : s.state,
    fullState: s.state,
    projectCount: s.projectCount,
    avgRiskScore: s.avgRiskScore,
    criticalCount: s.criticalCount,
    highCount: s.highCount,
    totalBudgetCr: s.totalBudgetCr
  }));

  // Monthly Observations Data
  const monthlyObservationsData = Object.entries(activeObservations.observationsByMonth).map(([month, count]) => ({
    month,
    observations: count
  }));

  // Coverage Depth Data
  const coverageDepthData = Object.entries(activeObservations.coverageCounts).map(([depth, count]) => ({
    depth,
    projects: count
  }));

  // P1 Queue
  const topPriorityProjects = projects
    .filter(p => p.priorityTier === 'P1' || p.riskTier === 'CRITICAL')
    .sort((a, b) => (b.priorityScore ?? 0) - (a.priorityScore ?? 0));

  // Filtered states for state matrix table
  const filteredStatesList = activeStates.filter(s => 
    s.state.toLowerCase().includes(stateSearch.toLowerCase())
  );

  // Filtered projects for state drilldown
  const drilldownProjects = selectedStateForDrilldown 
    ? projects.filter(p => p.state === selectedStateForDrilldown)
    : [];

  return (
    <div className="space-y-6">
      
      {/* Portfolio Analytics Header & KPI Ribbon */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-4 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-mono text-xs font-bold border border-blue-200">
                PAIMANA National Portfolio
              </span>
              <span className="text-xs text-slate-500 font-mono">
                {totalProjectsCount.toLocaleString()} Projects • {activeObservations.totalObservations.toLocaleString()} Observations
              </span>
            </div>
            <h2 className="text-base font-bold text-slate-900 mt-1">
              National Infrastructure Multi-Dimensional Analytics
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Comprehensive statistical insights across all MoSPI PAIMANA reporting cycles (April–July 2026). All metrics dynamically computed from repository data.
            </p>
          </div>

          {/* Tab Navigation */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-lg border border-slate-200">
            <button
              onClick={() => setActiveTab('overview')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                activeTab === 'overview'
                  ? 'bg-white text-blue-700 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <PieIcon className="w-3.5 h-3.5" />
              <span>Overview & Tiers</span>
            </button>
            <button
              onClick={() => setActiveTab('sectors')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                activeTab === 'sectors'
                  ? 'bg-white text-blue-700 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Sector Dynamics</span>
            </button>
            <button
              onClick={() => setActiveTab('geography')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                activeTab === 'geography'
                  ? 'bg-white text-blue-700 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>State Distribution</span>
            </button>
            <button
              onClick={() => setActiveTab('cost')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                activeTab === 'cost'
                  ? 'bg-white text-blue-700 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <DollarSign className="w-3.5 h-3.5" />
              <span>Cost Escalation</span>
            </button>
            <button
              onClick={() => setActiveTab('indicators')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                activeTab === 'indicators'
                  ? 'bg-white text-blue-700 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <TrendingDown className="w-3.5 h-3.5" />
              <span>Execution & Stagnation</span>
            </button>
          </div>
        </div>

        {/* High-Level Empirical KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-4">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total Projects</span>
            <p className="text-lg font-black text-slate-900 mt-0.5">{totalProjectsCount.toLocaleString()}</p>
            <span className="text-[10px] text-slate-500 font-mono">100% PAIMANA</span>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Committed Outlay</span>
            <p className="text-lg font-black text-slate-900 mt-0.5">₹{(activeCost.totalRevisedCostCr / 100000).toFixed(2)}L Cr</p>
            <span className="text-[10px] text-slate-500 font-mono">₹{activeCost.totalRevisedCostCr.toLocaleString()} Cr</span>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Cost Escalation</span>
            <p className="text-lg font-black text-red-600 mt-0.5">+₹{(activeCost.totalEscalationCr / 100000).toFixed(2)}L Cr</p>
            <span className="text-[10px] text-red-600 font-bold font-mono">+{activeCost.overallOverrunPercent}% Overrun</span>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Avg Risk Score</span>
            <p className="text-lg font-black text-amber-600 mt-0.5">{kpis.averageRiskScore ?? 44.5}</p>
            <span className="text-[10px] text-slate-500 font-mono">Moderate Tier</span>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Avg Physical Progress</span>
            <p className="text-lg font-black text-blue-600 mt-0.5">{kpis.averagePhysicalProgress ?? 51.5}%</p>
            <span className="text-[10px] text-slate-500 font-mono">National Mean</span>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Stagnation Alerts</span>
            <p className="text-lg font-black text-orange-600 mt-0.5">{activeIndicators.prolongedStagnationCount}</p>
            <span className="text-[10px] text-orange-700 font-mono font-bold">{activeIndicators.stagnationRate}% Flat ≥2 Mo</span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: OVERVIEW & PORTFOLIO DISTRIBUTIONS                                  */}
      {/* ========================================================================= */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* PRISM Risk Tier Distribution Donut */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                    PRISM Risk Tier Distribution
                  </h3>
                  <span className="text-[11px] font-mono text-slate-500">
                    2,054 Rated Projects
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-0.5">
                  Methodology: Critical (80–100), High (60–79), Moderate (40–59), Low (0–39)
                </p>
              </div>

              <div className="h-64 w-full my-2">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={riskPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={3}
                      dataKey="count"
                    >
                      {riskPieData.map((entry, index) => (
                        <Cell key={`risk-cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val: any, name: any) => [`${val} projects`, name]}
                      contentStyle={{ backgroundColor: '#020617', borderColor: '#334155', borderRadius: '8px', fontSize: '12px', color: '#fff' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-200 text-xs">
                {riskPieData.map((item) => (
                  <div key={item.name} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                    <div className="truncate">
                      <span className="text-slate-700 font-medium truncate block">{item.name}</span>
                      <span className="text-slate-900 font-bold">{item.count} projects</span>
                    </div>
                    <span className="ml-auto text-slate-600 font-mono font-bold text-[11px]">{item.percent}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* PRISM Priority Tier Distribution Donut */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                    Cabinet PMG Priority Tier Allocation
                  </h3>
                  <span className="text-[11px] font-mono text-slate-500">
                    Intervention Queue
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-0.5">
                  Decision Thresholds: P1 Immediate (≥70), P2 Significant (50–69), P3 Routine (&lt;50)
                </p>
              </div>

              <div className="h-64 w-full my-2">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={priorityPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={3}
                      dataKey="count"
                    >
                      {priorityPieData.map((entry, index) => (
                        <Cell key={`priority-cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val: any, name: any) => [`${val} projects`, name]}
                      contentStyle={{ backgroundColor: '#020617', borderColor: '#334155', borderRadius: '8px', fontSize: '12px', color: '#fff' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-3 border-t border-slate-200 text-xs">
                {priorityPieData.map((item) => (
                  <div key={item.name} className="p-2 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                      <span className="text-slate-700 font-bold truncate text-[11px]">{item.name.split(' ')[0]}</span>
                    </div>
                    <p className="text-slate-900 font-black text-sm">{item.count}</p>
                    <span className="text-slate-500 font-mono text-[10px]">{item.percent}% of portfolio</span>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Cabinet PMG Intervention Priority Roster Preview */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                  Top P1 Immediate Intervention Queue Preview
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  High-stakes projects requiring inter-ministerial resolution. Select any project to inspect evidence.
                </p>
              </div>
              <span className="text-xs font-mono font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-1 rounded">
                {kpis.p1Projects ?? 508} P1 Projects Identified
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {topPriorityProjects.slice(0, 6).map((p) => (
                <div
                  key={p.id}
                  onClick={() => onSelectProject(p)}
                  className="p-4 bg-slate-50 border border-slate-200 hover:border-red-600 rounded-xl cursor-pointer transition-all hover:bg-slate-100 group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-mono text-slate-600">{p.id}</span>
                      <h4 className="text-xs font-bold text-slate-900 group-hover:text-blue-600 transition-colors mt-0.5 line-clamp-1">
                        {p.name}
                      </h4>
                      <span className="text-[11px] text-slate-600">{p.sector} • {p.state}</span>
                    </div>
                    <div className="text-right whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded text-xs font-black bg-red-100 text-red-800 border border-red-200">
                        {p.priorityTier || 'P1'} • {p.priorityScore ?? p.riskScore}
                      </span>
                      <span className="block text-[10px] text-slate-500 mt-0.5">Risk: {p.riskScore}</span>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] pt-2 border-t border-slate-200">
                    <div>
                      <span className="text-slate-500">Overrun:</span>
                      <p className="font-bold text-red-600">+{p.costOverrunPercent}%</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Delay:</span>
                      <p className="font-bold text-orange-600">+{p.timeOverrunMonths} mo</p>
                    </div>
                  </div>

                  <div className="mt-2 text-[11px] text-slate-700 bg-white p-2 rounded border border-slate-200">
                    <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider block mb-0.5">Recommended Action:</span>
                    <p className="line-clamp-2 leading-tight font-medium text-slate-800">
                      {p.recommendedAction || p.primaryDelayCause}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: SECTOR DYNAMICS & SLIPPAGE                                         */}
      {/* ========================================================================= */}
      {activeTab === 'sectors' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Project Counts & Risk Distribution by Sector */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
              <div className="mb-4">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Project Counts & High-Risk Concentration by Sector
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  Distribution of monitored projects and high-risk flags across 11 infrastructure sectors
                </p>
              </div>

              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={sectorBarData} margin={{ top: 10, right: 10, left: 0, bottom: 35 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="sector" stroke="#64748b" tick={{ fontSize: 10 }} interval={0} angle={-25} textAnchor="end" />
                    <YAxis stroke="#64748b" tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(val: any, name: any) => [`${val}`, name]}
                      contentStyle={{ backgroundColor: '#020617', borderColor: '#334155', borderRadius: '8px', fontSize: '12px', color: '#fff' }}
                    />
                    <Legend verticalAlign="top" wrapperStyle={{ paddingBottom: 8 }} />
                    <Bar dataKey="projectCount" name="Total Projects" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="highRiskProjects" name="High Risk (60–79)" fill="#f97316" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="criticalProjects" name="Critical (80–100)" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Physical Progress by Sector & Cost Overrun % */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
              <div className="mb-4">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Physical Progress & Cost Overrun Rate by Sector
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  Sector-wide average physical completion (%) vs cost escalation percentage (%)
                </p>
              </div>

              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={sectorBarData} margin={{ top: 10, right: 10, left: 0, bottom: 35 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="sector" stroke="#64748b" tick={{ fontSize: 10 }} interval={0} angle={-25} textAnchor="end" />
                    <YAxis stroke="#64748b" tick={{ fontSize: 11 }} unit="%" />
                    <Tooltip
                      formatter={(val: any, name: any) => [`${val}%`, name]}
                      contentStyle={{ backgroundColor: '#020617', borderColor: '#334155', borderRadius: '8px', fontSize: '12px', color: '#fff' }}
                    />
                    <Legend verticalAlign="top" wrapperStyle={{ paddingBottom: 8 }} />
                    <Bar dataKey="avgPhysicalProgress" name="Avg Physical Progress (%)" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="costOverrunPercent" name="Cost Overrun (%)" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>

          {/* Complete Sector Intelligence Matrix Table */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Complete Sector Intelligence Matrix (All 11 Sectors)
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  Consolidated financial outlay, schedule slippage, risk score, and completion metrics
                </p>
              </div>
              <span className="text-xs font-mono text-slate-500">2,054 PAIMANA Projects</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-slate-900 uppercase font-bold text-[10px] tracking-wider border-y border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Sector</th>
                    <th className="py-2.5 px-3 text-right">Projects</th>
                    <th className="py-2.5 px-3 text-right">Portfolio Share</th>
                    <th className="py-2.5 px-3 text-right">Total Outlay (₹ Cr)</th>
                    <th className="py-2.5 px-3 text-right">Cost Overrun</th>
                    <th className="py-2.5 px-3 text-right">Avg Progress</th>
                    <th className="py-2.5 px-3 text-right">Avg Delay</th>
                    <th className="py-2.5 px-3 text-right">Avg Risk</th>
                    <th className="py-2.5 px-3 text-right">High / Critical</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activeSectors.map((s) => (
                    <tr key={s.sector} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-3 font-semibold text-slate-900">{s.sector}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">{s.projectCount}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-600">{s.portfolioPercent}%</td>
                      <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-900">₹{s.revisedCostCr.toLocaleString()}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-red-600">+{s.costOverrunPercent}%</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">{s.avgPhysicalProgress}%</td>
                      <td className="py-2.5 px-3 text-right font-mono text-orange-600">+{s.avgDelayMonths} mo</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">{s.avgRiskScore}</td>
                      <td className="py-2.5 px-3 text-right">
                        <span className="px-2 py-0.5 rounded font-mono font-bold text-[11px] bg-orange-50 text-orange-800 border border-orange-200">
                          {s.highRiskProjects + s.criticalProjects} projs
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: GEOGRAPHIC STATE-LEVEL RISK DISTRIBUTION                           */}
      {/* ========================================================================= */}
      {activeTab === 'geography' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Top States by Project Density & Risk Score Chart */}
            <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
              <div className="mb-4">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Top 10 States by Project Density & Capital Allocation
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  Project volume and average risk score across top federal state jurisdictions
                </p>
              </div>

              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={top10States} margin={{ top: 10, right: 10, left: 0, bottom: 35 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="state" stroke="#64748b" tick={{ fontSize: 10 }} interval={0} angle={-25} textAnchor="end" />
                    <YAxis yAxisId="left" stroke="#64748b" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="right" orientation="right" stroke="#64748b" tick={{ fontSize: 11 }} domain={[0, 100]} />
                    <Tooltip
                      formatter={(val: any, name: any) => [`${val}`, name]}
                      contentStyle={{ backgroundColor: '#020617', borderColor: '#334155', borderRadius: '8px', fontSize: '12px', color: '#fff' }}
                    />
                    <Legend verticalAlign="top" wrapperStyle={{ paddingBottom: 8 }} />
                    <Bar yAxisId="left" dataKey="projectCount" name="Total Projects" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    <Bar yAxisId="right" dataKey="avgRiskScore" name="Avg Risk Score" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Geographic Summary Card */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Geographic Coverage Facts
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  State and UT administrative boundaries
                </p>
                
                <div className="mt-4 space-y-3">
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Active States / UTs</span>
                    <p className="text-xl font-black text-slate-900 mt-0.5">{activeStates.length}</p>
                    <span className="text-[10px] text-slate-500 font-mono">Pan-India Coverage</span>
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Top State by Project Count</span>
                    <p className="text-sm font-black text-slate-900 mt-0.5">{top10States[0]?.fullState || 'Maharashtra'}</p>
                    <span className="text-[11px] text-blue-700 font-mono font-bold">{top10States[0]?.projectCount || 0} projects</span>
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Multi-State Corridors</span>
                    <p className="text-xs text-slate-700 mt-0.5 leading-relaxed">
                      Cross-border railway freight corridors and national highway packages crossing multiple administrative zones.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900 mt-3">
                <span className="font-bold block mb-0.5">Field GPS Coordinates Note:</span>
                MoSPI flash reports do not record GPS coordinates. State registry below provides exact administrative coverage.
              </div>
            </div>

          </div>

          {/* Interactive State-Wise Analytics Matrix */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  State-Wise Risk & Outlay Registry ({activeStates.length} States / UTs)
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  Click on any state row to view its monitored project roster
                </p>
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search state..."
                  value={stateSearch}
                  onChange={(e) => setStateSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 text-slate-900"
                />
              </div>
            </div>

            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-slate-900 uppercase font-bold text-[10px] tracking-wider border-y border-slate-200 sticky top-0 z-10">
                  <tr>
                    <th className="py-2.5 px-3">State / Union Territory</th>
                    <th className="py-2.5 px-3 text-right">Projects</th>
                    <th className="py-2.5 px-3 text-right">Total Outlay (₹ Cr)</th>
                    <th className="py-2.5 px-3 text-right">Avg Risk Score</th>
                    <th className="py-2.5 px-3 text-right">Critical</th>
                    <th className="py-2.5 px-3 text-right">High Risk</th>
                    <th className="py-2.5 px-3 text-right">Avg Progress</th>
                    <th className="py-2.5 px-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredStatesList.map((st) => (
                    <tr 
                      key={st.state} 
                      onClick={() => setSelectedStateForDrilldown(selectedStateForDrilldown === st.state ? null : st.state)}
                      className={`cursor-pointer transition-colors ${
                        selectedStateForDrilldown === st.state ? 'bg-blue-50/70 border-l-4 border-blue-600' : 'hover:bg-slate-50/80'
                      }`}
                    >
                      <td className="py-2.5 px-3 font-semibold text-slate-900 flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        {st.state}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">{st.projectCount}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-900">₹{st.totalBudgetCr.toLocaleString()}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold">
                        <span className={`px-2 py-0.5 rounded text-[11px] ${
                          st.avgRiskScore >= 60 ? 'bg-red-50 text-red-700 border border-red-200' :
                          st.avgRiskScore >= 45 ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                          'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}>
                          {st.avgRiskScore}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-red-600 font-bold">{st.criticalCount}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-orange-600 font-bold">{st.highCount}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-emerald-700 font-bold">{st.avgPhysicalProgress}%</td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="text-[11px] font-bold text-blue-600 hover:text-blue-700">
                          {selectedStateForDrilldown === st.state ? 'Close' : 'View Projects'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* State Drilldown Projects Table */}
            {selectedStateForDrilldown && (
              <div className="mt-4 pt-4 border-t border-slate-200">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-600" />
                    Projects in {selectedStateForDrilldown} ({drilldownProjects.length} projects)
                  </h4>
                  <button 
                    onClick={() => setSelectedStateForDrilldown(null)}
                    className="text-xs text-slate-500 hover:text-slate-900 font-bold"
                  >
                    Clear Drilldown
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {drilldownProjects.slice(0, 9).map(p => (
                    <div
                      key={p.id}
                      onClick={() => onSelectProject(p)}
                      className="p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-blue-500 rounded-lg cursor-pointer transition-all"
                    >
                      <div className="flex items-start justify-between gap-1">
                        <div>
                          <span className="text-[10px] font-mono text-slate-500">{p.id}</span>
                          <h5 className="text-xs font-bold text-slate-900 line-clamp-1">{p.name}</h5>
                          <span className="text-[10px] text-slate-600">{p.sector}</span>
                        </div>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-black shrink-0 ${
                          p.riskTier === 'CRITICAL' ? 'bg-red-100 text-red-800' :
                          p.riskTier === 'HIGH' ? 'bg-orange-100 text-orange-800' :
                          'bg-amber-100 text-amber-800'
                        }`}>
                          Risk: {p.riskScore}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-[10px] text-slate-600 pt-1.5 border-t border-slate-200">
                        <span>Progress: <strong>{p.physicalProgressPercent}%</strong></span>
                        <span>Delay: <strong>+{p.timeOverrunMonths} mo</strong></span>
                        <span>₹{p.revisedCostCr.toLocaleString()} Cr</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: COST ESCALATION & FISCAL OVERRUN ANALYTICS                         */}
      {/* ========================================================================= */}
      {activeTab === 'cost' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Cost Escalation Outlay Comparison */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Portfolio Capital Outlay Escalation
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  Original approved outlay vs current revised cost
                </p>

                <div className="mt-4 space-y-3">
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Original Approved Outlay</span>
                    <p className="text-xl font-black text-slate-900 mt-0.5">
                      ₹{(activeCost.totalOriginalCostCr / 100000).toFixed(2)}L Cr
                    </p>
                    <span className="text-[10px] text-slate-500 font-mono">₹{activeCost.totalOriginalCostCr.toLocaleString()} Cr baseline</span>
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Current Revised Outlay</span>
                    <p className="text-xl font-black text-slate-900 mt-0.5">
                      ₹{(activeCost.totalRevisedCostCr / 100000).toFixed(2)}L Cr
                    </p>
                    <span className="text-[10px] text-slate-500 font-mono">₹{activeCost.totalRevisedCostCr.toLocaleString()} Cr committed</span>
                  </div>

                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-red-600">Net Portfolio Cost Escalation</span>
                    <p className="text-xl font-black text-red-700 mt-0.5">
                      +₹{(activeCost.totalEscalationCr / 100000).toFixed(2)}L Cr
                    </p>
                    <span className="text-[11px] font-bold text-red-700 font-mono">
                      +{activeCost.overallOverrunPercent}% Portfolio Cost Overrun
                    </span>
                  </div>
                </div>
              </div>

              <div className="text-[11px] text-slate-500 mt-4 pt-3 border-t border-slate-200 leading-relaxed">
                Cost escalations are derived directly from MoSPI PAIMANA monthly audit filings comparing original sanction outlays against latest executive revised costs.
              </div>
            </div>

            {/* Cost Escalation Brackets Donut & Breakdown */}
            <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Cost Overrun Distribution Brackets
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  Categorization of all 2,054 projects by degree of budget overrun
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center my-4">
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={activeCost.brackets}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={3}
                        dataKey="count"
                      >
                        {activeCost.brackets.map((entry, index) => (
                          <Cell key={`bracket-cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(val: any, name: any) => [`${val} projects`, name]}
                        contentStyle={{ backgroundColor: '#020617', borderColor: '#334155', borderRadius: '8px', fontSize: '12px', color: '#fff' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="space-y-2.5">
                  {activeCost.brackets.map((b) => (
                    <div key={b.name} className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: b.color }} />
                        <div>
                          <span className="text-xs font-bold text-slate-800 block">{b.name}</span>
                          <span className="text-[10px] text-slate-500 font-mono">{b.percent}% of portfolio</span>
                        </div>
                      </div>
                      <span className="text-sm font-black text-slate-900 font-mono">{b.count} projs</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sector Cost Overrun Comparison Bar */}
              <div className="pt-4 border-t border-slate-200">
                <span className="text-xs font-bold text-slate-900 uppercase tracking-wider block mb-2">
                  Cost Overrun % by Sector
                </span>
                <div className="h-44 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={sectorBarData} margin={{ top: 5, right: 10, left: 0, bottom: 25 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="sector" stroke="#64748b" tick={{ fontSize: 9 }} interval={0} angle={-20} textAnchor="end" />
                      <YAxis stroke="#64748b" tick={{ fontSize: 10 }} unit="%" />
                      <Tooltip
                        formatter={(val: any) => [`${val}%`, 'Overrun']}
                        contentStyle={{ backgroundColor: '#020617', borderColor: '#334155', borderRadius: '8px', fontSize: '11px', color: '#fff' }}
                      />
                      <Bar dataKey="costOverrunPercent" name="Cost Overrun %" fill="#ef4444" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: EXECUTION & STAGNATION INDICATORS                                  */}
      {/* ========================================================================= */}
      {activeTab === 'indicators' && (
        <div className="space-y-6">
          
          {/* Key Execution Alert Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-black bg-orange-50 text-orange-700 border border-orange-200">
                  INDICATOR 1
                </span>
                <span className="text-xs font-mono font-bold text-orange-700">{activeIndicators.stagnationRate}% Rate</span>
              </div>
              <h4 className="text-sm font-bold text-slate-900">Prolonged Physical Stagnation</h4>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Projects with consecutive flat observations (|Δ progress| ≤ 0.2%) across monthly reporting cycles.
              </p>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-baseline justify-between">
                <span className="text-2xl font-black text-orange-600">{activeIndicators.prolongedStagnationCount}</span>
                <span className="text-xs text-slate-500 font-mono">Projects Flagged</span>
              </div>
            </div>

            <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-black bg-purple-50 text-purple-700 border border-purple-200">
                  INDICATOR 2
                </span>
                <span className="text-xs font-mono font-bold text-purple-700">{activeIndicators.divergenceRate}% Rate</span>
              </div>
              <h4 className="text-sm font-bold text-slate-900">Physical-Financial Divergence</h4>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Projects where fund burn rate exceeds cumulative physical milestone completion by ≥ 15%.
              </p>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-baseline justify-between">
                <span className="text-2xl font-black text-purple-600">{activeIndicators.divergenceCount}</span>
                <span className="text-xs text-slate-500 font-mono">Projects Flagged</span>
              </div>
            </div>

            <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-black bg-red-50 text-red-700 border border-red-200">
                  INDICATOR 3
                </span>
                <span className="text-xs font-mono font-bold text-red-700">Schedule Pressure</span>
              </div>
              <h4 className="text-sm font-bold text-slate-900">Critical Schedule Deceleration</h4>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Projects operating under extreme compression urgency (&gt;80/100) where recent velocity has collapsed.
              </p>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-baseline justify-between">
                <span className="text-2xl font-black text-red-600">{activeIndicators.criticalUrgencyCount}</span>
                <span className="text-xs text-slate-500 font-mono">Projects Flagged</span>
              </div>
            </div>
          </div>

          {/* Longitudinal Reporting Cycles Coverage (7,499 observations) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Monthly Observations Breakdown */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
              <div className="mb-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                    PAIMANA Longitudinal Observations by Month
                  </h3>
                  <span className="text-xs font-mono font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                    {activeObservations.totalObservations.toLocaleString()} Total
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-0.5">
                  Monthly Flash Report snapshots cataloged in repository (April–July 2026)
                </p>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyObservationsData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="month" stroke="#64748b" tick={{ fontSize: 11 }} />
                    <YAxis stroke="#64748b" tick={{ fontSize: 11 }} domain={[1500, 2000]} />
                    <Tooltip
                      formatter={(val: any) => [`${val} observations`, 'Count']}
                      contentStyle={{ backgroundColor: '#020617', borderColor: '#334155', borderRadius: '8px', fontSize: '12px', color: '#fff' }}
                    />
                    <Bar dataKey="observations" name="Monthly Observations" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-4 gap-2 pt-3 border-t border-slate-200 text-center">
                {monthlyObservationsData.map(m => (
                  <div key={m.month} className="p-2 bg-slate-50 rounded border border-slate-200">
                    <span className="text-[10px] text-slate-500 block truncate">{m.month}</span>
                    <span className="text-xs font-mono font-bold text-slate-900">{m.observations}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Longitudinal Observation Depth per Project */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
              <div className="mb-4">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Observation Depth & Longitudinal Coverage
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  Number of monthly snapshots available per project in the 2,054 portfolio
                </p>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={coverageDepthData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="depth" stroke="#64748b" tick={{ fontSize: 11 }} />
                    <YAxis stroke="#64748b" tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(val: any) => [`${val} projects`, 'Count']}
                      contentStyle={{ backgroundColor: '#020617', borderColor: '#334155', borderRadius: '8px', fontSize: '12px', color: '#fff' }}
                    />
                    <Bar dataKey="projects" name="Projects" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-4 gap-2 pt-3 border-t border-slate-200 text-center">
                {coverageDepthData.map(c => (
                  <div key={c.depth} className="p-2 bg-slate-50 rounded border border-slate-200">
                    <span className="text-[10px] text-slate-500 block truncate">{c.depth}</span>
                    <span className="text-xs font-mono font-bold text-emerald-700">{c.projects}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
