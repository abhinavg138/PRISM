import React from 'react';
import { MapPin, Building2, Clock, IndianRupee, ArrowUpRight, ShieldAlert } from 'lucide-react';
import { Project, RiskTier } from '../types/index';

interface ProjectRiskCardProps {
  project: Project;
  onSelect?: (project: Project) => void;
  compact?: boolean;
}

export const ProjectRiskCard: React.FC<ProjectRiskCardProps> = ({
  project,
  onSelect,
  compact = false
}) => {
  const isUnrated = project.riskScore == null;
  const riskTier: RiskTier = project.riskTier || 'UNRATED';

  const getRiskBadgeStyle = (tier: RiskTier) => {
    switch (tier) {
      case 'CRITICAL':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'HIGH':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'MODERATE':
        return 'bg-yellow-50 text-yellow-800 border-yellow-200';
      case 'LOW':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      default:
        return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  const getProgressColor = (tier: RiskTier) => {
    switch (tier) {
      case 'CRITICAL':
        return 'bg-rose-500';
      case 'HIGH':
        return 'bg-amber-500';
      case 'MODERATE':
        return 'bg-yellow-500';
      case 'LOW':
        return 'bg-emerald-500';
      default:
        return 'bg-blue-500';
    }
  };

  const progress = typeof project.physicalProgressPercent === 'number'
    ? Math.max(0, Math.min(100, project.physicalProgressPercent))
    : null;

  const cleanName = project.name ? project.name.split('(')[0].trim() : `Project ${project.id}`;

  return (
    <div
      onClick={() => onSelect && onSelect(project)}
      role={onSelect ? 'button' : undefined}
      tabIndex={onSelect ? 0 : undefined}
      onKeyDown={(e) => {
        if (onSelect && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onSelect(project);
        }
      }}
      className={`group relative rounded-xl border border-slate-200 bg-white p-3.5 text-left transition-all ${
        onSelect
          ? 'cursor-pointer hover:border-blue-300 hover:shadow-md hover:bg-slate-50/50'
          : 'shadow-xs'
      }`}
    >
      {/* Header Row: Title + Project ID + Action */}
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 mb-1">
            <span className="font-mono text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200/80">
              PAIMANA-{project.id}
            </span>
            {project.priorityTier && (
              <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                project.priorityTier === 'P1'
                  ? 'bg-rose-100 text-rose-800'
                  : project.priorityTier === 'P2'
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-slate-100 text-slate-700'
              }`}>
                {project.priorityTier}
              </span>
            )}
          </div>
          <h4
            className="text-xs font-bold text-slate-900 leading-snug group-hover:text-blue-700 transition-colors line-clamp-2"
            title={project.name}
          >
            {cleanName}
          </h4>
        </div>

        {/* Risk Badge Pill */}
        <div className="shrink-0 flex flex-col items-end gap-1">
          <div className={`px-2 py-0.5 rounded-full border text-[11px] font-bold flex items-center gap-1 ${getRiskBadgeStyle(riskTier)}`}>
            <span>{isUnrated ? 'UNRATED' : `${project.riskScore} / 100`}</span>
            {!isUnrated && (
              <span className="text-[9px] uppercase tracking-wider opacity-85">
                {riskTier}
              </span>
            )}
          </div>

          {onSelect && (
            <span className="text-[10px] font-medium text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
              Open details <ArrowUpRight className="w-3 h-3" />
            </span>
          )}
        </div>
      </div>

      {/* Linear Physical Progress Bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-[11px] mb-1">
          <span className="text-slate-500 font-medium">Physical Progress</span>
          <span className="font-bold text-slate-800">
            {progress !== null ? `${progress}%` : 'Not Reported'}
          </span>
        </div>
        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
          {progress !== null ? (
            <div
              className={`h-full rounded-full transition-all duration-300 ${getProgressColor(riskTier)}`}
              style={{ width: `${progress}%` }}
            />
          ) : (
            <div className="h-full w-full bg-slate-200" />
          )}
        </div>
      </div>

      {/* 2-Column Metadata Grid */}
      <div className="grid grid-cols-2 gap-2 text-[11px] pt-2 border-t border-slate-100">
        <div className="flex items-center gap-1.5 text-slate-600 min-w-0">
          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="truncate" title={project.state || 'Unspecified'}>
            {project.state || 'Unspecified'}
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-slate-600 min-w-0">
          <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="truncate" title={String(project.derivedSector || project.sector || 'Infrastructure')}>
            {String(project.derivedSector || project.sector || 'Infrastructure')}
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-slate-600 min-w-0">
          <IndianRupee className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="truncate font-mono">
            ₹{project.revisedCostCr?.toLocaleString() || project.originalCostCr?.toLocaleString() || '0'} Cr
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-slate-600 min-w-0">
          <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="truncate font-medium">
            {project.timeOverrunMonths && project.timeOverrunMonths > 0
              ? `+${project.timeOverrunMonths} mo delay`
              : 'On Schedule'}
          </span>
        </div>
      </div>

      {/* Primary Concern / Alert (if present and not compact) */}
      {!compact && (project.primaryRiskDriver || project.priorityReason) && (
        <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-start gap-1.5 text-[11px] text-slate-600 leading-tight">
          <ShieldAlert className="w-3 h-3 text-amber-500 shrink-0 mt-0.5" />
          <span className="line-clamp-1 italic">
            {project.primaryRiskDriver || project.priorityReason}
          </span>
        </div>
      )}
    </div>
  );
};
