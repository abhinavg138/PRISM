import React from 'react';
import { ShieldAlert, TrendingUp, Clock, AlertTriangle, IndianRupee, Layers } from 'lucide-react';
import { PortfolioKPIs } from '../types/index';

interface KPISummaryProps {
  kpis: PortfolioKPIs;
  onFilterRisk: (tier: string) => void;
  selectedTier: string;
}

export const KPISummary: React.FC<KPISummaryProps> = ({ kpis, onFilterRisk, selectedTier }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      
      {/* Total Projects Card */}
      <div 
        onClick={() => onFilterRisk('ALL')}
        className={`bg-white border rounded-xl p-4 transition-all cursor-pointer hover:border-gray-300 shadow-sm ${
          selectedTier === 'ALL' ? 'border-blue-500 ring-1 ring-blue-500/30' : 'border-gray-200'
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Monitored</span>
          <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
            <Layers className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-bold text-gray-900 tracking-tight">{kpis.totalProjects}</span>
          <span className="text-xs text-gray-500 font-medium">Projects</span>
        </div>
        <p className="mt-1 text-[11px] text-gray-500">
          Portfolio outlay: <strong className="text-gray-900">₹{(kpis.totalBudgetCr / 1000).toFixed(1)}k Cr</strong>
        </p>
      </div>

      {/* Critical Risk Card */}
      <div 
        onClick={() => onFilterRisk('CRITICAL')}
        className={`bg-white border rounded-xl p-4 transition-all cursor-pointer hover:border-red-300 shadow-sm ${
          selectedTier === 'CRITICAL' ? 'border-red-500 ring-1 ring-red-500/30 bg-red-50/50' : 'border-gray-200'
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-red-600 uppercase tracking-wider flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse"></span>
            Critical Risk
          </span>
          <div className="w-8 h-8 rounded-lg bg-red-50 border border-red-100 flex items-center justify-center text-red-600">
            <ShieldAlert className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-bold text-red-600 tracking-tight">{kpis.criticalProjects}</span>
          <span className="text-[10px] text-red-700 font-semibold px-1.5 py-0.5 rounded bg-red-100 border border-red-200">
            Index ≥ 80
          </span>
        </div>
        <p className="mt-1 text-[11px] text-red-600/80">
          Require immediate cabinet escalation
        </p>
      </div>

      {/* Budget at Risk Card */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Budget at Risk</span>
          <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
            <IndianRupee className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-bold text-amber-600 tracking-tight">₹{(kpis.budgetAtRiskCr / 1000).toFixed(1)}k</span>
          <span className="text-xs text-gray-500">Cr</span>
        </div>
        <p className="mt-1 text-[11px] text-gray-500">
          <strong className="text-amber-600">{kpis.totalBudgetCr > 0 ? Math.round((kpis.budgetAtRiskCr / kpis.totalBudgetCr) * 100) : 0}%</strong> of total committed capital
        </p>
      </div>

      {/* Average Delay Card */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Slippage</span>
          <div className="w-8 h-8 rounded-lg bg-orange-50 border border-orange-100 flex items-center justify-center text-orange-600">
            <Clock className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-bold text-orange-600 tracking-tight">{kpis.averageDelayMonths}</span>
          <span className="text-xs text-gray-500">Months</span>
        </div>
        <p className="mt-1 text-[11px] text-gray-500">
          Avg cost escalation: <strong className="text-orange-600">+{kpis.averageCostEscalationPercent}%</strong>
        </p>
      </div>

      {/* High Risk Watchlist */}
      <div 
        onClick={() => onFilterRisk('HIGH')}
        className={`bg-white border rounded-xl p-4 transition-all cursor-pointer hover:border-orange-300 shadow-sm ${
          selectedTier === 'HIGH' ? 'border-orange-500 ring-1 ring-orange-500/30 bg-orange-50/50' : 'border-gray-200'
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">High Risk Watch</span>
          <div className="w-8 h-8 rounded-lg bg-orange-50 border border-orange-100 flex items-center justify-center text-orange-600">
            <AlertTriangle className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-bold text-orange-600 tracking-tight">{kpis.highRiskProjects}</span>
          <span className="text-xs text-gray-500">Projects</span>
        </div>
        <p className="mt-1 text-[11px] text-gray-500">
          Early warning monitoring active
        </p>
      </div>

    </div>
  );
};
