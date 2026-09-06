import React from 'react';
import { ShieldAlert, AlertTriangle, Layers, Activity, Gauge } from 'lucide-react';
import { PortfolioKPIs } from '../types/index';

interface KPISummaryProps {
  kpis: PortfolioKPIs;
  onFilterRisk?: (tier: string) => void;
  selectedTier?: string;
}

export const KPISummary: React.FC<KPISummaryProps> = ({ kpis, onFilterRisk, selectedTier }) => {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      
      {/* 1. Total Projects Card */}
      <div 
        onClick={() => onFilterRisk?.('ALL')}
        className={`bg-white border rounded-xl p-3.5 transition-all cursor-pointer hover:border-slate-300 shadow-xs ${
          selectedTier === 'ALL' ? 'border-blue-500 ring-1 ring-blue-500/20' : 'border-slate-200'
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Projects</span>
          <div className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
            <Layers className="w-3.5 h-3.5" />
          </div>
        </div>
        <div className="mt-1.5 flex items-baseline gap-1.5">
          <span className="text-2xl font-bold text-slate-900 tracking-tight">
            {kpis.totalProjects?.toLocaleString()}
          </span>
        </div>
        <p className="mt-1 text-[11px] text-slate-500 truncate">
          Active PAIMANA Portfolio
        </p>
      </div>

      {/* 2. Critical Risk Card */}
      <div 
        onClick={() => onFilterRisk?.('CRITICAL')}
        className={`bg-white border rounded-xl p-3.5 transition-all cursor-pointer hover:border-red-300 shadow-xs ${
          selectedTier === 'CRITICAL' ? 'border-red-500 ring-1 ring-red-500/20 bg-red-50/40' : 'border-slate-200'
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-red-600 uppercase tracking-wider flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse"></span>
            Critical
          </span>
          <div className="w-7 h-7 rounded-lg bg-red-50 border border-red-100 flex items-center justify-center text-red-600">
            <ShieldAlert className="w-3.5 h-3.5" />
          </div>
        </div>
        <div className="mt-1.5 flex items-baseline gap-1.5">
          <span className="text-2xl font-bold text-red-600 tracking-tight">{kpis.criticalProjects}</span>
          <span className="text-[10px] text-red-700 font-semibold px-1.5 py-0.5 rounded bg-red-100 border border-red-200">
            Risk 80–100
          </span>
        </div>
        <p className="mt-1 text-[11px] text-red-600/80 truncate">
          P1 Immediate Action
        </p>
      </div>

      {/* 3. High Risk Card */}
      <div 
        onClick={() => onFilterRisk?.('HIGH')}
        className={`bg-white border rounded-xl p-3.5 transition-all cursor-pointer hover:border-orange-300 shadow-xs ${
          selectedTier === 'HIGH' ? 'border-orange-500 ring-1 ring-orange-500/20 bg-orange-50/40' : 'border-slate-200'
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider">High Risk</span>
          <div className="w-7 h-7 rounded-lg bg-orange-50 border border-orange-100 flex items-center justify-center text-orange-600">
            <AlertTriangle className="w-3.5 h-3.5" />
          </div>
        </div>
        <div className="mt-1.5 flex items-baseline gap-1.5">
          <span className="text-2xl font-bold text-orange-600 tracking-tight">{kpis.highRiskProjects}</span>
          <span className="text-[10px] text-orange-700 font-semibold px-1.5 py-0.5 rounded bg-orange-100 border border-orange-200">
            Risk 60–79
          </span>
        </div>
        <p className="mt-1 text-[11px] text-slate-500 truncate">
          P2 Priority Watchlist
        </p>
      </div>

      {/* 4. Average Risk Score Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Avg Risk Score</span>
          <div className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
            <Activity className="w-3.5 h-3.5" />
          </div>
        </div>
        <div className="mt-1.5 flex items-baseline gap-1">
          <span className="text-2xl font-bold text-slate-900 tracking-tight">
            {kpis.averageRiskScore != null ? kpis.averageRiskScore : '—'}
          </span>
          <span className="text-xs text-slate-500 font-medium">/ 100</span>
        </div>
        <p className="mt-1 text-[11px] text-slate-500 truncate">
          PRISM Risk Index
        </p>
      </div>

      {/* 5. Average Physical Progress Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs col-span-2 sm:col-span-1">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Avg Physical Progress</span>
          <div className="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
            <Gauge className="w-3.5 h-3.5" />
          </div>
        </div>
        <div className="mt-1.5 flex items-baseline gap-1">
          <span className="text-2xl font-bold text-emerald-600 tracking-tight">
            {kpis.averagePhysicalProgress != null ? `${kpis.averagePhysicalProgress}%` : '—'}
          </span>
        </div>
        <p className="mt-1 text-[11px] text-slate-500 truncate">
          MoM Field Reported
        </p>
      </div>

    </div>
  );
};
