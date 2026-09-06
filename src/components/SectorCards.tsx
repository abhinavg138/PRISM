import React from 'react';
import { 
  Truck, Train, Zap, Pickaxe, Flame, Anchor, 
  Droplets, Radio, Building2, Factory, Landmark, 
  ArrowRight, CheckCircle2, Filter
} from 'lucide-react';
import { SectorStat } from '../types/index';

interface SectorCardsProps {
  sectors: SectorStat[];
  selectedSector: string;
  onSelectSector: (sector: string) => void;
  isLoading?: boolean;
}

const SECTOR_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  'Road Transport & Highways': Truck,
  'Railways': Train,
  'Power & Energy': Zap,
  'Coal & Mining': Pickaxe,
  'Petroleum & Gas': Flame,
  'Ports & Shipping': Anchor,
  'Water Resources': Droplets,
  'Telecommunications': Radio,
  'Urban Affairs & Metro': Building2,
  'Steel & Heavy Industry': Factory,
  'Other Infrastructure': Landmark
};

export const SectorCards: React.FC<SectorCardsProps> = ({
  sectors,
  selectedSector,
  onSelectSector,
  isLoading = false
}) => {
  if (isLoading) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm animate-pulse">
        <div className="h-4 bg-slate-200 rounded w-48 mb-4"></div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
            <div key={i} className="h-36 bg-slate-100 rounded-xl border border-slate-200"></div>
          ))}
        </div>
      </div>
    );
  }

  if (!sectors || sectors.length === 0) {
    return null;
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-sm space-y-3">
      {/* Header & Transparency Note */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Infrastructure Sectors
            </h3>
            <span className="text-[10px] font-medium text-slate-500">
              ({sectors.length} sectors represented)
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Sector classifications are derived from implementing agencies.
          </p>
        </div>

        {selectedSector && selectedSector !== 'ALL' && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-600">
              Active Filter: <strong className="text-blue-700">{selectedSector}</strong>
            </span>
            <button
              onClick={() => onSelectSector('ALL')}
              className="px-2.5 py-1 text-xs font-semibold text-blue-700 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors"
            >
              Clear Filter (Show All)
            </button>
          </div>
        )}
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {sectors.map((sec) => {
          const isSelected = selectedSector === sec.sector;
          const Icon = SECTOR_ICON_MAP[sec.sector] || Landmark;

          return (
            <div
              key={sec.sector}
              onClick={() => onSelectSector(isSelected ? 'ALL' : sec.sector)}
              className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between group ${
                isSelected
                  ? 'border-blue-600 ring-2 ring-blue-600/20 bg-blue-50/50 shadow-sm'
                  : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/80 bg-white'
              }`}
            >
              {/* Sector Header: Icon & Name */}
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    isSelected
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-700 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors'
                  }`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  {isSelected && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-100/80 px-1.5 py-0.5 rounded">
                      <CheckCircle2 className="w-3 h-3" />
                      Active
                    </span>
                  )}
                </div>

                <h4 className="font-bold text-xs text-slate-900 mt-2 line-clamp-1 group-hover:text-blue-600 transition-colors">
                  {sec.sector}
                </h4>

                {/* Total Projects Count */}
                <div className="mt-1 flex items-baseline gap-1.5">
                  <span className="text-xl font-extrabold text-slate-900 tracking-tight">
                    {sec.totalProjects.toLocaleString()}
                  </span>
                  <span className="text-[11px] text-slate-500 font-medium">Projects</span>
                </div>
              </div>

              {/* Progress & Risk Stats */}
              <div className="mt-3 pt-2.5 border-t border-slate-100 space-y-2 text-xs">
                {/* Average Physical Progress */}
                <div>
                  <div className="flex justify-between items-center text-[10px] text-slate-500 mb-1">
                    <span>Avg Physical Progress</span>
                    <span className="font-bold text-slate-800">{sec.avgPhysicalProgress}%</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-blue-600 h-full rounded-full transition-all"
                      style={{ width: `${Math.min(100, sec.avgPhysicalProgress)}%` }}
                    />
                  </div>
                </div>

                {/* Critical & High Risk Metrics */}
                <div className="flex items-center justify-between gap-2 text-[11px] pt-1">
                  <div className="flex items-center gap-1">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      sec.criticalProjects > 0
                        ? 'bg-red-50 text-red-700 border border-red-200'
                        : 'bg-slate-100 text-slate-500'
                    }`}>
                      {sec.criticalProjects}
                    </span>
                    <span className="text-[10px] text-slate-600">Critical</span>
                  </div>

                  <div className="flex items-center gap-1">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      sec.highRiskProjects > 0
                        ? 'bg-orange-50 text-orange-700 border border-orange-200'
                        : 'bg-slate-100 text-slate-500'
                    }`}>
                      {sec.highRiskProjects}
                    </span>
                    <span className="text-[10px] text-slate-600">High Risk</span>
                  </div>
                </div>
              </div>

              {/* Bottom Action Hint */}
              <div className="mt-2.5 pt-2 border-t border-slate-100/80 flex items-center justify-between text-[11px] font-semibold text-blue-600 group-hover:text-blue-700">
                <span>{isSelected ? 'Deselect Sector' : 'View Sector'}</span>
                <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
