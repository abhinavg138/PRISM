import React from 'react';
import { ArrowRight, BarChart3 } from 'lucide-react';
import { PortfolioKPIs } from '../types/index';

interface PortfolioRiskInsightProps {
  kpis: PortfolioKPIs;
  onViewAnalytics: () => void;
}

export const PortfolioRiskInsight: React.FC<PortfolioRiskInsightProps> = ({
  kpis,
  onViewAnalytics
}) => {
  const total = kpis.totalProjects || 1;
  const criticalPct = Math.round(((kpis.criticalProjects || 0) / total) * 1000) / 10;
  const highPct = Math.round(((kpis.highRiskProjects || 0) / total) * 1000) / 10;
  const moderatePct = Math.round(((kpis.moderateRiskProjects || 0) / total) * 1000) / 10;
  const lowPct = Math.round(((kpis.lowRiskProjects || 0) / total) * 1000) / 10;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs space-y-3.5">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700">
            <BarChart3 className="w-3.5 h-3.5" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Portfolio Risk Distribution
            </h3>
            <p className="text-[11px] text-slate-500">
              PRISM Risk Index stratification across {total.toLocaleString()} projects
            </p>
          </div>
        </div>

        <button
          onClick={onViewAnalytics}
          className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-800 transition-colors"
        >
          <span>Deep-dive in Analytics</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Stacked Proportional Bar */}
      <div className="w-full h-4 bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
        {criticalPct > 0 && (
          <div 
            style={{ width: `${Math.max(criticalPct, 0.8)}%` }} 
            className="bg-red-600 h-full transition-all" 
            title={`Critical: ${kpis.criticalProjects} (${criticalPct}%)`}
          />
        )}
        {highPct > 0 && (
          <div 
            style={{ width: `${highPct}%` }} 
            className="bg-orange-500 h-full transition-all" 
            title={`High: ${kpis.highRiskProjects} (${highPct}%)`}
          />
        )}
        {moderatePct > 0 && (
          <div 
            style={{ width: `${moderatePct}%` }} 
            className="bg-amber-400 h-full transition-all" 
            title={`Moderate: ${kpis.moderateRiskProjects} (${moderatePct}%)`}
          />
        )}
        {lowPct > 0 && (
          <div 
            style={{ width: `${lowPct}%` }} 
            className="bg-emerald-500 h-full transition-all" 
            title={`Low: ${kpis.lowRiskProjects} (${lowPct}%)`}
          />
        )}
      </div>

      {/* Breakdown Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
        
        {/* Critical */}
        <div className="p-2.5 bg-red-50/60 border border-red-200/80 rounded-lg">
          <div className="flex items-center justify-between text-[10px] text-red-700 font-bold uppercase tracking-wider">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-red-600"></span>
              Critical (80–100)
            </span>
            <span>{criticalPct}%</span>
          </div>
          <div className="mt-1 text-base font-bold text-red-700">
            {kpis.criticalProjects} <span className="text-xs font-normal text-red-600/80">projects</span>
          </div>
        </div>

        {/* High Risk */}
        <div className="p-2.5 bg-orange-50/60 border border-orange-200/80 rounded-lg">
          <div className="flex items-center justify-between text-[10px] text-orange-700 font-bold uppercase tracking-wider">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
              High (60–79)
            </span>
            <span>{highPct}%</span>
          </div>
          <div className="mt-1 text-base font-bold text-orange-700">
            {kpis.highRiskProjects} <span className="text-xs font-normal text-orange-600/80">projects</span>
          </div>
        </div>

        {/* Moderate Risk */}
        <div className="p-2.5 bg-amber-50/60 border border-amber-200/80 rounded-lg">
          <div className="flex items-center justify-between text-[10px] text-amber-800 font-bold uppercase tracking-wider">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
              Moderate (40–59)
            </span>
            <span>{moderatePct}%</span>
          </div>
          <div className="mt-1 text-base font-bold text-amber-900">
            {kpis.moderateRiskProjects} <span className="text-xs font-normal text-amber-700">projects</span>
          </div>
        </div>

        {/* Low Risk */}
        <div className="p-2.5 bg-emerald-50/60 border border-emerald-200/80 rounded-lg">
          <div className="flex items-center justify-between text-[10px] text-emerald-700 font-bold uppercase tracking-wider">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              Low (0–39)
            </span>
            <span>{lowPct}%</span>
          </div>
          <div className="mt-1 text-base font-bold text-emerald-700">
            {kpis.lowRiskProjects} <span className="text-xs font-normal text-emerald-600/80">projects</span>
          </div>
        </div>

      </div>

    </div>
  );
};
