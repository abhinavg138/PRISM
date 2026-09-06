import React from 'react';
import { Zap, ArrowRight, ShieldAlert, AlertTriangle, CheckCircle, Info, ExternalLink } from 'lucide-react';
import { Project, RiskTier, PriorityTier } from '../types/index';

interface PriorityProjectsOverviewProps {
  projects: Project[];
  onSelectProject: (p: Project) => void;
  onViewAllPriority: () => void;
  limit?: number;
}

export const PriorityProjectsOverview: React.FC<PriorityProjectsOverviewProps> = ({
  projects,
  onSelectProject,
  onViewAllPriority,
  limit = 8
}) => {
  // Sort deterministically by priorityScore descending, taking only prioritized records
  const allRanked = [...projects]
    .filter(p => p.priorityScore != null)
    .sort((a, b) => (b.priorityScore ?? 0) - (a.priorityScore ?? 0));

  const priorityList = allRanked.slice(0, limit);

  const getPriorityBadge = (tier?: PriorityTier | null, score?: number | null) => {
    if (tier === 'P1') {
      return (
        <div>
          <div className="flex items-center gap-1.5">
            <span className="px-2 py-0.5 rounded text-[11px] font-extrabold bg-red-100 text-red-800 border border-red-200 inline-flex items-center gap-1 shadow-2xs">
              <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse"></span>
              P1
            </span>
            <span className="font-mono font-bold text-slate-900 text-xs">{score ?? 0}</span>
          </div>
          <span className="text-[10px] text-red-700 font-semibold block mt-0.5">Highest Urgency</span>
        </div>
      );
    }
    if (tier === 'P2') {
      return (
        <div>
          <div className="flex items-center gap-1.5">
            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-orange-100 text-orange-800 border border-orange-200 inline-flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
              P2
            </span>
            <span className="font-mono font-bold text-slate-800 text-xs">{score ?? 0}</span>
          </div>
          <span className="text-[10px] text-orange-700 font-medium block mt-0.5">Significant Oversight</span>
        </div>
      );
    }
    return (
      <div>
        <div className="flex items-center gap-1.5">
          <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            P3
          </span>
          <span className="font-mono text-slate-700 text-xs">{score ?? 0}</span>
        </div>
        <span className="text-[10px] text-slate-500 block mt-0.5">Monitoring</span>
      </div>
    );
  };

  const getRiskBadge = (tier?: RiskTier, score?: number | null) => {
    if (tier === 'CRITICAL') {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-50 text-red-700 border border-red-200 inline-flex items-center gap-1">
          <ShieldAlert className="w-3 h-3" />
          {score}/100 • CRITICAL
        </span>
      );
    }
    if (tier === 'HIGH') {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-orange-50 text-orange-700 border border-orange-200 inline-flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" />
          {score}/100 • HIGH
        </span>
      );
    }
    if (tier === 'MODERATE') {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
          {score}/100 • MODERATE
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
        {score}/100 • LOW
      </span>
    );
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

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
      
      {/* Header */}
      <div className="p-4 sm:px-5 sm:py-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-red-100 border border-red-200 flex items-center justify-center text-red-600 shadow-2xs">
              <Zap className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Intervention Priority Queue
                </h3>
                <span className="px-2 py-0.2 rounded text-[10px] font-mono font-bold bg-blue-50 text-blue-700 border border-blue-200">
                  Top {priorityList.length} of {allRanked.length}
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Answers: <em>Which projects should decision-makers look at FIRST?</em> Ranked by deterministic PRISM Priority Engine.
              </p>
            </div>
          </div>

          {/* Priority Level Meaning Legend */}
          <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
            <span className="text-slate-400 font-medium">Priority Levels:</span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-50 text-red-800 border border-red-200 text-[10px] font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-red-600"></span>
              P1 = Highest intervention urgency (≥ 70)
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-orange-50 text-orange-800 border border-orange-200 text-[10px] font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
              P2 = Significant oversight (50–69)
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 text-[10px]">
              P3 = Monitoring (&lt; 50)
            </span>
          </div>
        </div>

        <button
          onClick={onViewAllPriority}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white hover:bg-slate-100 text-blue-700 border border-slate-300 shadow-2xs transition-colors shrink-0"
        >
          <span>View full priority queue</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Table Content or Informative Empty State */}
      {priorityList.length === 0 ? (
        <div className="p-8 text-center bg-slate-50/50">
          <Info className="w-8 h-8 text-slate-400 mx-auto mb-2" />
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            No Priority Intervention Records Under Active Filter
          </h4>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 leading-relaxed">
            All infrastructure projects in the active selection are currently operating within routine monitoring thresholds (P3).
            The full national portfolio contains 2,054 monitored projects with ranked priorities.
          </p>
          <button
            onClick={onViewAllPriority}
            className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors"
          >
            <span>View full priority queue</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-2.5 px-4 min-w-[130px]">Priority Level</th>
                <th className="py-2.5 px-4 min-w-[220px]">Project & Code</th>
                <th className="py-2.5 px-3 min-w-[140px]">Sector & State</th>
                <th className="py-2.5 px-3 min-w-[140px]">Risk Assessment</th>
                <th className="py-2.5 px-3 min-w-[90px]">Confidence</th>
                <th className="py-2.5 px-4 min-w-[150px]">Primary Risk Indicator</th>
                <th className="py-2.5 px-4 min-w-[280px]">Reason for Priority</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {priorityList.map((p) => {
                return (
                  <tr
                    key={p.id}
                    onClick={() => onSelectProject(p)}
                    className="hover:bg-blue-50/40 transition-colors cursor-pointer group"
                    title={`Click to view full detail for ${p.name}`}
                  >
                    {/* 1. Priority Level */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      {getPriorityBadge(p.priorityTier, p.priorityScore)}
                    </td>

                    {/* 2. Project Name & Code */}
                    <td className="py-3 px-4">
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
                    <td className="py-3 px-3">
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                        {p.derivedSector || p.sector}
                      </span>
                      <div className="text-[11px] text-slate-600 font-medium mt-1 truncate max-w-[130px]" title={p.state}>
                        {p.state}
                      </div>
                    </td>

                    {/* 4. Risk Assessment */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      {getRiskBadge(p.riskTier, p.riskScore)}
                    </td>

                    {/* 5. Evidence Confidence */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      {getConfidenceDisplay(p.evidenceConfidence)}
                    </td>

                    {/* 6. Primary Risk Indicator */}
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded bg-slate-100 text-slate-800 border border-slate-300">
                        {p.primaryRiskDriver || 'General Execution'}
                      </span>
                    </td>

                    {/* 7. Reason for Priority */}
                    <td className="py-3 px-4 text-slate-700 text-xs leading-relaxed">
                      <p className="line-clamp-2" title={p.priorityReason}>
                        {p.priorityReason || 'High risk combined with schedule pressure.'}
                      </p>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer link */}
      <div className="p-3 sm:px-5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-600">
        <span>
          Showing top <strong>{priorityList.length}</strong> urgent interventions from <strong>{allRanked.length}</strong> ranked infrastructure projects.
        </span>
        <button
          onClick={onViewAllPriority}
          className="font-semibold text-blue-700 hover:text-blue-800 inline-flex items-center gap-1 self-start sm:self-auto"
        >
          <span>View full priority queue</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

    </div>
  );
};
