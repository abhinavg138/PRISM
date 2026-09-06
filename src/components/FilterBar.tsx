import React from 'react';
import { Search, Filter, ArrowUpDown } from 'lucide-react';
import { FilterState } from '../types/index';

interface FilterBarProps {
  filters: FilterState;
  onFilterChange: (updates: Partial<FilterState>) => void;
  availableSectors: string[];
  availableStates: string[];
  totalResults: number;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  filters,
  onFilterChange,
  availableSectors,
  availableStates,
  totalResults
}) => {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm">
      <div className="flex flex-col lg:flex-row gap-3 items-center justify-between">
        
        {/* Search Input */}
        <div className="relative w-full lg:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
          <input
            type="text"
            placeholder="Search project name, code, agency, city..."
            value={filters.search}
            onChange={(e) => onFilterChange({ search: e.target.value })}
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-800 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600"
          />
          {filters.search && (
            <button
              onClick={() => onFilterChange({ search: '' })}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-600 hover:text-slate-800"
            >
              ✕
            </button>
          )}
        </div>

        {/* Dropdowns & Risk Tabs */}
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          
          {/* Sector Selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-600 font-medium">Sector:</span>
            <select
              value={filters.sector}
              onChange={(e) => onFilterChange({ sector: e.target.value })}
              className="text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-600"
            >
              <option value="ALL">All Sectors</option>
              {availableSectors.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* State Selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-600 font-medium">State:</span>
            <select
              value={filters.state}
              onChange={(e) => onFilterChange({ state: e.target.value })}
              className="text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-600"
            >
              <option value="ALL">All States</option>
              {availableStates.map(st => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>
          </div>

          {/* Risk Tier Quick Tabs */}
          <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-lg border border-slate-200">
            {['ALL', 'CRITICAL', 'HIGH', 'MODERATE', 'LOW', 'UNRATED'].map(tier => (
              <button
                key={tier}
                onClick={() => onFilterChange({ riskTier: tier })}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded transition-colors ${
                  filters.riskTier === tier
                    ? tier === 'CRITICAL'
                      ? 'bg-red-500 text-slate-900'
                      : tier === 'HIGH'
                      ? 'bg-orange-500 text-slate-900'
                      : tier === 'MODERATE'
                      ? 'bg-yellow-500 text-white'
                      : tier === 'LOW'
                      ? 'bg-emerald-500 text-slate-900'
                      : tier === 'UNRATED'
                      ? 'bg-slate-300 text-slate-900 border border-slate-400'
                      : 'bg-gray-100 text-gray-800 border border-gray-200'
                    : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                {tier === 'ALL' ? 'All' : tier === 'UNRATED' ? 'Unrated' : tier}
              </button>
            ))}
          </div>

          {/* Sort By */}
          <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-600" />
            <select
              value={`${filters.sortBy}-${filters.sortDirection}`}
              onChange={(e) => {
                const [by, dir] = e.target.value.split('-');
                onFilterChange({ sortBy: by as any, sortDirection: dir as any });
              }}
              className="text-xs bg-slate-50 border border-slate-300 rounded-lg px-2 py-1.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-600"
            >
              <option value="riskScore-desc">Highest Risk Score</option>
              <option value="costOverrun-desc">Highest Cost Overrun %</option>
              <option value="timeOverrun-desc">Longest Delay (Months)</option>
              <option value="revisedCostCr-desc">Highest Revised Budget</option>
              <option value="name-asc">Project Name (A-Z)</option>
            </select>
          </div>

          {/* Counter badge */}
          <span className="text-xs text-slate-600 ml-auto font-medium">
            Showing <strong className="text-slate-900">{totalResults}</strong> projects
          </span>

        </div>
      </div>
    </div>
  );
};
