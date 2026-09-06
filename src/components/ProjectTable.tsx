import React from 'react';
import { ShieldAlert, AlertTriangle, ArrowRight, ExternalLink, Activity } from 'lucide-react';
import { Project, RiskTier } from '../types/index';

interface ProjectTableProps {
  projects: Project[];
  onSelectProject: (project: Project) => void;
}

export const ProjectTable: React.FC<ProjectTableProps> = ({ projects, onSelectProject }) => {
  const getRiskBadge = (tier: RiskTier, score: number) => {
    switch (tier) {
      case 'CRITICAL':
        return (
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200 shadow-sm">
              <ShieldAlert className="w-3.5 h-3.5" />
              {score} • CRITICAL
            </span>
          </div>
        );
      case 'HIGH':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-orange-50 text-orange-700 border border-orange-200 shadow-sm">
            <AlertTriangle className="w-3.5 h-3.5" />
            {score} • HIGH
          </span>
        );
      case 'MODERATE':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 shadow-sm">
            {score} • MODERATE
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-sm">
            {score} • LOW
          </span>
        );
    }
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

  if (projects.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-600">
        <p className="text-base font-semibold">No infrastructure projects match current filter criteria.</p>
        <p className="text-xs mt-1">Try resetting the search terms or sector selections.</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
              <th className="py-3 px-4">Project & Code</th>
              <th className="py-3 px-3">Sector & State</th>
              <th className="py-3 px-3 text-right">Cost (Orig → Revised)</th>
              <th className="py-3 px-3">Progress (Physical vs Financial)</th>
              <th className="py-3 px-3 text-right">Delay (Months)</th>
              <th className="py-3 px-3">ML Risk Index</th>
              <th className="py-3 px-4">Primary Bottleneck</th>
              <th className="py-3 px-4 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {projects.map((p) => {
              // Divergence check
              const isDivergent = p.financialProgressPercent > p.physicalProgressPercent + 8;

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

                  {/* Physical vs Financial Progress */}
                  <td className="py-3.5 px-3 min-w-[180px]">
                    <div className="space-y-1">
                      {/* Physical Progress */}
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

                      {/* Financial Progress */}
                      <div>
                        <div className="flex justify-between text-[10px] text-slate-600 mb-0.5">
                          <span>Financial Burn</span>
                          <span className={`font-bold ${isDivergent ? 'text-orange-600' : 'text-purple-600'}`}>
                            {p.financialProgressPercent}%
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${isDivergent ? 'bg-blue-600' : 'bg-purple-500'}`}
                            style={{ width: `${Math.min(100, p.financialProgressPercent)}%` }}
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
                      Pred: <span className="text-orange-600 font-medium">+{p.predictedDelayMonths} mo</span>
                    </div>
                  </td>

                  {/* ML Risk Score */}
                  <td className="py-3.5 px-3 whitespace-nowrap">
                    {getRiskBadge(p.riskTier, p.riskScore)}
                  </td>

                  {/* Primary Bottleneck */}
                  <td className="py-3.5 px-4 max-w-xs">
                    <p className="text-[11px] text-slate-700 line-clamp-2 leading-relaxed">
                      {p.primaryDelayCause}
                    </p>
                  </td>

                  {/* Action Button */}
                  <td className="py-3.5 px-4 text-center whitespace-nowrap">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectProject(p);
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-white hover:bg-gray-50 text-blue-600 hover:text-blue-700 border border-gray-200 transition-all group-hover:border-blue-300"
                    >
                      <span>Inspect SHAP</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
