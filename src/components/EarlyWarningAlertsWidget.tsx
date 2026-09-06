import React from 'react';
import { AlertTriangle, ArrowRight, ShieldAlert, Clock, Building2, ChevronRight } from 'lucide-react';
import { EarlyWarningAlert, Project } from '../types/index';

interface EarlyWarningAlertsWidgetProps {
  alerts: EarlyWarningAlert[];
  onOpenAlertsModal: () => void;
  onSelectProject: (p: Project) => void;
  allProjects: Project[];
  limit?: number;
}

export const EarlyWarningAlertsWidget: React.FC<EarlyWarningAlertsWidgetProps> = ({
  alerts,
  onOpenAlertsModal,
  onSelectProject,
  allProjects,
  limit = 4
}) => {
  const criticalCount = alerts.filter(a => a.severity === 'CRITICAL').length;
  const highCount = alerts.filter(a => a.severity === 'HIGH').length;
  const mediumCount = alerts.filter(a => a.severity === 'MEDIUM').length;

  const previewList = alerts.slice(0, limit);

  const handleOpenProject = (alert: EarlyWarningAlert) => {
    const fullProj = allProjects.find(p => p.id === alert.projectId);
    if (fullProj) {
      onSelectProject(fullProj);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
      
      {/* Header */}
      <div className="p-4 sm:px-5 sm:py-3.5 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-red-50 border border-red-200 flex items-center justify-center text-red-600 shadow-2xs">
            <AlertTriangle className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-wider">
                Early Warning Alerts
              </h3>
              <span className="px-2 py-0.2 rounded text-[10px] font-mono font-bold bg-red-50 text-red-700 border border-red-200">
                {alerts.length} Active Signals
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              Evidence-based operational alerts derived strictly from longitudinal observations.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden md:flex items-center gap-1.5 text-[11px] font-semibold">
            <span className="px-2 py-0.5 rounded bg-red-100 text-red-800 border border-red-200">
              {criticalCount} Critical
            </span>
            <span className="px-2 py-0.5 rounded bg-orange-100 text-orange-800 border border-orange-200">
              {highCount} High
            </span>
            <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
              {mediumCount} Medium
            </span>
          </div>

          <button
            onClick={onOpenAlertsModal}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white hover:bg-slate-100 text-blue-700 border border-slate-300 shadow-2xs transition-colors shrink-0"
          >
            <span>View all early warnings</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Alert Preview Cards */}
      {alerts.length === 0 ? (
        <div className="p-8 text-center text-slate-500 text-xs">
          No early warning alerts detected across the portfolio.
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {previewList.map((alert) => {
            const isCritical = alert.severity === 'CRITICAL';
            return (
              <div
                key={alert.id}
                onClick={() => handleOpenProject(alert)}
                className="p-3.5 sm:px-5 hover:bg-slate-50/80 transition-colors cursor-pointer group flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1 max-w-2xl">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold inline-flex items-center gap-1 ${
                      isCritical
                        ? 'bg-red-100 text-red-800 border border-red-200'
                        : 'bg-orange-100 text-orange-800 border border-orange-200'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${isCritical ? 'bg-red-600 animate-pulse' : 'bg-orange-500'}`}></span>
                      {alert.severity}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
                      {alert.alertType}
                    </span>
                    <span className="text-[11px] text-slate-400 font-medium">
                      {alert.detectedPeriod}
                    </span>
                  </div>

                  <div className="font-bold text-xs text-slate-900 group-hover:text-blue-700 transition-colors">
                    {alert.projectName}
                    <span className="font-mono text-slate-400 text-[11px] font-normal ml-2">
                      ({alert.projectCode} • {alert.state})
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-600 leading-snug line-clamp-1">
                    <strong className="text-slate-700">Evidence:</strong> "{alert.evidence}"
                  </p>
                </div>

                <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                  <span className="hidden lg:inline-block text-[11px] text-blue-900 font-medium bg-blue-50/80 border border-blue-100 px-2.5 py-1 rounded max-w-[240px] truncate" title={alert.recommendedAttention}>
                    {alert.recommendedAttention}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenProject(alert);
                    }}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-800 group-hover:translate-x-0.5 transition-transform"
                  >
                    <span>Inspect</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer */}
      <div className="p-2.5 sm:px-5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
        <span>Showing top {previewList.length} critical early warnings. Alerts are not predictions of project failure.</span>
        <button
          onClick={onOpenAlertsModal}
          className="font-semibold text-blue-700 hover:text-blue-800 inline-flex items-center gap-1"
        >
          <span>View all {alerts.length} early warnings</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

    </div>
  );
};
