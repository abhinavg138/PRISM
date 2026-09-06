import React, { useState, useEffect } from 'react';
import { ShieldAlert, AlertTriangle, ArrowRight, Activity, Zap, CheckCircle2 } from 'lucide-react';
import { Project, RiskTier, PriorityTier } from '../types/index';

interface ProjectTableProps {
  projects: Project[];
  onSelectProject: (project: Project) => void;
  queueMode?: 'all' | 'priority' | 'p1';
  onQueueModeChange?: (mode: 'all' | 'priority' | 'p1') => void;
}

export const ProjectTable: React.FC<ProjectTableProps> = ({
  projects,
  onSelectProject,
  queueMode: controlledQueueMode,
  onQueueModeChange
}) => {
  const [internalQueueMode, setInternalQueueMode] = useState<'all' | 'priority' | 'p1'>('all');
  const activeQueueMode = controlledQueueMode ?? internalQueueMode;

  const setQueueMode = (mode: 'all' | 'priority' | 'p1') => {
    if (onQueueModeChange) {
      onQueueModeChange(mode);
    } else {
      setInternalQueueMode(mode);
    }
  };

  const getPriorityBadge = (tier?: PriorityTier | null, score?: number | null) => {
    if (tier === 'P1') {
      return (
        <div>
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-extrabold bg-red-100 text-red-800 border border-red-200 shadow-2xs">
              <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse"></span>
              P1 • {score ?? 0}
            </span>
          </div>
          <span className="text-[10px] text-red-700 font-semibold block mt-0.5">Highest Urgency</span>
        </div>
      );
    }
    if (tier === 'P2') {
      return (
        <div>
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-orange-100 text-orange-800 border border-orange-200">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
              P2 • {score ?? 0}
            </span>
          </div>
          <span className="text-[10px] text-orange-700 font-medium block mt-0.5">Significant Oversight</span>
        </div>
      );
    }
    return (
      <div>
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
          P3 • {score ?? 0}
        </span>
        <span className="text-[10px] text-slate-500 block mt-0.5">Monitoring</span>
      </div>
    );
  };

  const getRiskBadge = (tier: RiskTier, score: number | null) => {
    switch (tier) {
      case 'CRITICAL':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">
            <ShieldAlert className="w-3 h-3" />
            {score ?? '—'} • CRITICAL
          </span>
        );
      case 'HIGH':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-50 text-orange-700 border border-orange-200">
            <AlertTriangle className="w-3 h-3" />
            {score ?? '—'} • HIGH
          </span>
        );
      case 'MODERATE':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            {score ?? '—'} • MODERATE
          </span>
        );
      case 'LOW':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            {score ?? '—'} • LOW
          </span>
        );
      case 'UNRATED':
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
            Unrated
          </span>
        );
    }
  };

  const getConfidenceDisplay = (conf?: number) => {
    const pct = conf != null ? Math.round(conf * 100) : 100;
    const obsCount = conf != null ? Math.max(1, Math.round(conf * 4)) : 4;
    return (
      <div>
        <span className={`font-mono font-bold text-xs ${
          pct >= 90 ? 'text-emerald-700' : pct >= 70 ? 'text-blue-700' : 'text-amber-700'
        }`}>
          {pct}%
        </span>
        <span className="text-[10px] text-slate-500 block">
          {obsCount}/4 reports
        </span>
      </div>
    );
  };

  const getSectorColor = (sector: string) => {
    switch (sector) {
      case 'Railways':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Road Transport & Highways':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Power & Energy':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Petroleum & Gas':
        return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'Urban Affairs & Metro':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      default:
        return 'bg-cyan-50 text-cyan-700 border-cyan-200';
    }
  };

  // Compute priority counts across current projects
  const p1Count = projects.filter(p => p.priorityTier === 'P1').length;
  const p2Count = projects.filter(p => p.priorityTier === 'P2').length;
  const priorityQueueCount = p1Count + p2Count;

  // Filter and sort according to selected queue mode
  let displayedProjects = [...projects];
  if (activeQueueMode === 'priority') {
    displayedProjects = displayedProjects
      .filter(p => p.priorityTier === 'P1' || p.priorityTier === 'P2')
      .sort((a, b) => (b.priorityScore || 0) - (a.priorityScore || 0));
  } else if (activeQueueMode === 'p1') {
    displayedProjects = displayedProjects
      .filter(p => p.priorityTier === 'P1')
      .sort((a, b) => (b.priorityScore || 0) - (a.priorityScore || 0));
  }

  const isPriorityQueueView = activeQueueMode === 'priority' || activeQueueMode === 'p1';

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
      
      {/* Priority Queue Control Bar */}
      <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setQueueMode('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeQueueMode === 'all'
                ? 'bg-white text-slate-900 shadow-xs border border-slate-300'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All Monitored Projects ({projects.length})
          </button>
          <button
            onClick={() => setQueueMode('priority')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeQueueMode === 'priority'
                ? 'bg-amber-100 text-amber-900 border border-amber-300 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-amber-700" />
            <span>Intervention Priority Queue ({priorityQueueCount})</span>
          </button>
          <button
            onClick={() => setQueueMode('p1')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeQueueMode === 'p1'
                ? 'bg-red-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse"></span>
            <span>P1 Immediate Interventions ({p1Count})</span>
          </button>
        </div>

        <div className="text-[11px] text-slate-500 font-medium">
          Showing <strong className="text-slate-800">{displayedProjects.length}</strong> projects
          {isPriorityQueueView && ' ranked by PRISM Priority Score'}
        </div>
      </div>

      {/* Priority Level Legend (visible whenever viewing priority queue or projects) */}
      <div className="px-4 py-2 bg-slate-50/70 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-slate-400 font-medium">Priority Methodology:</span>
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-50 text-red-800 border border-red-200 text-[10px] font-bold">
            P1 = Highest intervention urgency (≥ 70)
          </span>
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-orange-50 text-orange-800 border border-orange-200 text-[10px] font-medium">
            P2 = Significant oversight (50–69)
          </span>
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 text-[10px]">
            P3 = Monitoring (&lt; 50)
          </span>
        </div>
        <span className="text-[10px] text-slate-400">
          Formula: 40% Risk + 25% Schedule Urgency + 20% Deterioration + 15% Confidence
        </span>
      </div>

      {displayedProjects.length === 0 ? (
        <div className="p-12 text-center text-slate-600">
          <p className="text-base font-semibold">No infrastructure projects match current queue criteria.</p>
          <p className="text-xs mt-1">Try selecting another queue tab or adjusting your search filters.</p>
        </div>
      ) : isPriorityQueueView ? (
        /* ========================================================================= */
        /* DEDICATED FULL PRIORITY QUEUE VIEW                                      */
        /* ========================================================================= */
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4 min-w-[130px]">Priority Level</th>
                <th className="py-3 px-4 min-w-[240px]">Project & Code</th>
                <th className="py-3 px-3 min-w-[140px]">Sector & State</th>
                <th className="py-3 px-3 min-w-[140px]">Risk Assessment</th>
                <th className="py-3 px-3 min-w-[90px]">Confidence</th>
                <th className="py-3 px-4 min-w-[150px]">Primary Risk Indicator</th>
                <th className="py-3 px-4 min-w-[280px]">Reason for Priority</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {displayedProjects.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => onSelectProject(p)}
                  className="hover:bg-blue-50/40 cursor-pointer transition-colors group"
                >
                  {/* 1. Priority Level */}
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    {getPriorityBadge(p.priorityTier, p.priorityScore)}
                  </td>

                  {/* 2. Project Name & Code */}
                  <td className="py-3.5 px-4">
                    <div className="font-bold text-slate-900 group-hover:text-blue-700 transition-colors line-clamp-2 leading-snug">
                      {p.name}
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
                      <span className="font-mono text-slate-600">{p.code}</span>
                      {p.implementingAgency && (
                        <>
                          <span>•</span>
                          <span className="truncate max-w-[140px]" title={p.implementingAgency}>
                            {p.implementingAgency}
                          </span>
                        </>
                      )}
                    </div>
                  </td>

                  {/* 3. Sector & State */}
                  <td className="py-3.5 px-3">
                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                      {p.derivedSector || p.sector}
                    </span>
                    <div className="text-[11px] text-slate-600 font-medium mt-1 truncate max-w-[130px]" title={p.state}>
                      {p.state}
                    </div>
                  </td>

                  {/* 4. Risk Assessment */}
                  <td className="py-3.5 px-3 whitespace-nowrap">
                    {getRiskBadge(p.riskTier, p.riskScore)}
                  </td>

                  {/* 5. Evidence Confidence */}
                  <td className="py-3.5 px-3 whitespace-nowrap">
                    {getConfidenceDisplay(p.evidenceConfidence)}
                  </td>

                  {/* 6. Primary Risk Indicator */}
                  <td className="py-3.5 px-4">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded bg-slate-100 text-slate-800 border border-slate-300">
                      {p.primaryRiskDriver || 'General Execution'}
                    </span>
                  </td>

                  {/* 7. Reason for Priority */}
                  <td className="py-3.5 px-4 text-slate-700 text-xs leading-relaxed">
                    <p className="line-clamp-2" title={p.priorityReason}>
                      {p.priorityReason || 'High risk combined with schedule pressure.'}
                    </p>
                  </td>

                  {/* 8. Action */}
                  <td className="py-3.5 px-4 text-center whitespace-nowrap">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectProject(p);
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-white hover:bg-slate-50 text-blue-600 hover:text-blue-700 border border-slate-200 transition-all group-hover:border-blue-300 shadow-2xs"
                    >
                      <span>Detail</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* ========================================================================= */
        /* STANDARD ALL-PROJECTS VIEW                                              */
        /* ========================================================================= */
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Project & Code</th>
                <th className="py-3 px-3">Sector & State</th>
                <th className="py-3 px-3 text-right">Cost (Orig → Revised)</th>
                <th className="py-3 px-3">Progress & Spend Ratio</th>
                <th className="py-3 px-3 text-right">Schedule Slippage</th>
                <th className="py-3 px-3 min-w-[140px]">Priority & Risk</th>
                <th className="py-3 px-4 max-w-sm">Primary Driver & Priority Reason</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {displayedProjects.map((p) => {
                const spendRatio = p.expenditurePctOfRevisedCost ?? (
                  p.revisedCostCr > 0 ? parseFloat(((p.cumulativeExpenditureCr / p.revisedCostCr) * 100).toFixed(1)) : 0
                );
                const isDivergent = spendRatio > p.physicalProgressPercent + 8;

                return (
                  <tr
                    key={p.id}
                    onClick={() => onSelectProject(p)}
                    className="hover:bg-slate-100 cursor-pointer transition-colors group"
                  >
                    {/* Name & Code */}
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900 text-xs group-hover:text-blue-600 transition-colors">
                        {p.name}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-600">
                        <span className="font-mono text-slate-600">{p.code}</span>
                        <span>•</span>
                        <span>{p.implementingAgency}</span>
                        {p.dataSource && (
                          <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-bold ${
                            p.dataSource === 'PAIMANA' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}>
                            {p.dataSource}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Sector & State */}
                    <td className="py-3.5 px-3 whitespace-nowrap">
                      <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium border ${getSectorColor(p.sector)}`}>
                        {p.sector}
                      </span>
                      <div className="text-[11px] text-slate-600 mt-1">
                        {p.state}
                      </div>
                    </td>

                    {/* Cost & Overrun */}
                    <td className="py-3.5 px-3 text-right whitespace-nowrap">
                      <div className="font-semibold text-slate-800">
                        ₹{p.revisedCostCr.toLocaleString()} Cr
                      </div>
                      <div className="text-[11px] mt-0.5">
                        <span className="text-slate-500">Orig: ₹{p.originalCostCr.toLocaleString()} Cr</span>
                        {p.costOverrunPercent > 0 && (
                          <span className="ml-1.5 font-semibold text-red-600">
                            (+{p.costOverrunPercent}%)
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Physical Progress vs Spend Ratio */}
                    <td className="py-3.5 px-3 min-w-[180px]">
                      <div className="space-y-1">
                        <div>
                          <div className="flex justify-between text-[10px] text-slate-600 mb-0.5">
                            <span>Physical Progress</span>
                            <span className="font-bold text-blue-600">{p.physicalProgressPercent}%</span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-blue-500 h-full rounded-full transition-all"
                              style={{ width: `${Math.min(100, p.physicalProgressPercent)}%` }}
                            />
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between text-[10px] text-slate-600 mb-0.5">
                            <span>Spend / Cost Ratio</span>
                            <span className={`font-bold ${isDivergent ? 'text-orange-600' : 'text-purple-600'}`}>
                              {spendRatio}%
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${isDivergent ? 'bg-amber-500' : 'bg-purple-500'}`}
                              style={{ width: `${Math.min(100, spendRatio)}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Time Overrun */}
                    <td className="py-3.5 px-3 text-right whitespace-nowrap">
                      <div className={`font-bold ${p.timeOverrunMonths > 24 ? 'text-red-600' : p.timeOverrunMonths > 12 ? 'text-orange-600' : 'text-slate-700'}`}>
                        +{p.timeOverrunMonths} mo
                      </div>
                      <div className="text-[10px] text-slate-600 mt-0.5">
                        {p.predictedDelayMonths != null ? (
                          <>Pred: <span className="text-orange-600 font-medium">+{p.predictedDelayMonths} mo</span></>
                        ) : (
                          <span className="text-slate-500">PAIMANA Official</span>
                        )}
                      </div>
                    </td>

                    {/* Priority & Risk Badges */}
                    <td className="py-3.5 px-3 whitespace-nowrap">
                      <div className="space-y-1">
                        <div>
                          {getPriorityBadge(p.priorityTier, p.priorityScore)}
                        </div>
                        <div>
                          {getRiskBadge(p.riskTier, p.riskScore)}
                        </div>
                      </div>
                    </td>

                    {/* Primary Driver & Priority Reason */}
                    <td className="py-3.5 px-4 max-w-sm">
                      <div className="space-y-1">
                        {p.primaryRiskDriver && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold rounded bg-slate-100 text-slate-700 border border-slate-300">
                            <Activity className="w-2.5 h-2.5 text-slate-500" />
                            {p.primaryRiskDriver}
                          </span>
                        )}
                        <p className="text-[11px] text-slate-800 font-medium line-clamp-2 leading-tight">
                          {p.priorityReason || p.recommendedAction || p.primaryDelayCause}
                        </p>
                      </div>
                    </td>

                    {/* Action Button */}
                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectProject(p);
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-white hover:bg-gray-50 text-blue-600 hover:text-blue-700 border border-gray-200 transition-all group-hover:border-blue-300 shadow-2xs"
                      >
                        <span>Project Detail</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
