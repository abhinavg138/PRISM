import React, { useState, useMemo } from 'react';
import { 
  X, AlertTriangle, ShieldAlert, Zap, Filter, Search, 
  ArrowRight, Info, CheckCircle2, ChevronRight, Clock, Building2, MapPin
} from 'lucide-react';
import { EarlyWarningAlert, AlertType, AlertSeverity, Project } from '../types/index';

interface EarlyWarningAlertsModalProps {
  isOpen: boolean;
  onClose: () => void;
  alerts: EarlyWarningAlert[];
  onSelectProject: (p: Project) => void;
  allProjects: Project[];
}

export const EarlyWarningAlertsModal: React.FC<EarlyWarningAlertsModalProps> = ({
  isOpen,
  onClose,
  alerts,
  onSelectProject,
  allProjects
}) => {
  const [selectedSeverity, setSelectedSeverity] = useState<string>('ALL');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Calculate counts
  const countsBySeverity = useMemo(() => {
    return {
      total: alerts.length,
      critical: alerts.filter(a => a.severity === 'CRITICAL').length,
      high: alerts.filter(a => a.severity === 'HIGH').length,
      medium: alerts.filter(a => a.severity === 'MEDIUM').length
    };
  }, [alerts]);

  const countsByType = useMemo(() => {
    const map: Record<string, number> = {};
    for (const a of alerts) {
      map[a.alertType] = (map[a.alertType] || 0) + 1;
    }
    return map;
  }, [alerts]);

  // Filtered alerts
  const filteredAlerts = useMemo(() => {
    return alerts.filter(a => {
      if (selectedSeverity !== 'ALL' && a.severity !== selectedSeverity) return false;
      if (selectedType !== 'ALL' && a.alertType !== selectedType) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = a.projectName.toLowerCase().includes(q);
        const matchesCode = a.projectCode.toLowerCase().includes(q);
        const matchesState = a.state.toLowerCase().includes(q);
        const matchesEvidence = a.evidence.toLowerCase().includes(q);
        if (!matchesName && !matchesCode && !matchesState && !matchesEvidence) return false;
      }
      return true;
    });
  }, [alerts, selectedSeverity, selectedType, searchQuery]);

  if (!isOpen) return null;

  const handleOpenProject = (alert: EarlyWarningAlert) => {
    const fullProj = allProjects.find(p => p.id === alert.projectId);
    if (fullProj) {
      onClose();
      onSelectProject(fullProj);
    }
  };

  const getSeverityBadge = (severity: AlertSeverity) => {
    switch (severity) {
      case 'CRITICAL':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-extrabold bg-red-100 text-red-800 border border-red-200 inline-flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse"></span>
            CRITICAL
          </span>
        );
      case 'HIGH':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-orange-100 text-orange-800 border border-orange-200 inline-flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
            HIGH
          </span>
        );
      case 'MEDIUM':
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            MEDIUM
          </span>
        );
    }
  };

  const getTypeBadge = (type: AlertType) => {
    switch (type) {
      case 'Progress Stagnation':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'Deteriorating Progress':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'Schedule Pressure':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'Cost Escalation':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'Physical-Financial Divergence':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'High/Critical Risk':
        return 'bg-red-100 text-red-800 border-red-300';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 font-sans">
        
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-red-100 border border-red-200 flex items-center justify-center text-red-700 shadow-2xs">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                  PRISM Early Warning Alerts
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-red-100 text-red-700 border border-red-200">
                  {countsBySeverity.total} Active Signals
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Evidence-based early warnings derived strictly from longitudinal MoSPI PAIMANA observations.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Severity Summary Stat Bar */}
        <div className="p-3 sm:px-5 bg-white border-b border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-2.5 shrink-0 text-xs">
          <button
            onClick={() => setSelectedSeverity('ALL')}
            className={`p-2 rounded-lg border text-left transition-all ${
              selectedSeverity === 'ALL'
                ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
            }`}
          >
            <span className="text-[10px] uppercase font-bold tracking-wider opacity-80 block">All Early Warnings</span>
            <span className="text-lg font-black leading-tight block">{countsBySeverity.total}</span>
          </button>

          <button
            onClick={() => setSelectedSeverity('CRITICAL')}
            className={`p-2 rounded-lg border text-left transition-all ${
              selectedSeverity === 'CRITICAL'
                ? 'bg-red-600 text-white border-red-600 shadow-xs'
                : 'bg-red-50/50 hover:bg-red-50 border-red-200 text-red-900'
            }`}
          >
            <span className="text-[10px] uppercase font-bold tracking-wider opacity-80 block">Critical Severity</span>
            <span className="text-lg font-black leading-tight block">{countsBySeverity.critical}</span>
          </button>

          <button
            onClick={() => setSelectedSeverity('HIGH')}
            className={`p-2 rounded-lg border text-left transition-all ${
              selectedSeverity === 'HIGH'
                ? 'bg-orange-500 text-white border-orange-500 shadow-xs'
                : 'bg-orange-50/50 hover:bg-orange-50 border-orange-200 text-orange-900'
            }`}
          >
            <span className="text-[10px] uppercase font-bold tracking-wider opacity-80 block">High Severity</span>
            <span className="text-lg font-black leading-tight block">{countsBySeverity.high}</span>
          </button>

          <button
            onClick={() => setSelectedSeverity('MEDIUM')}
            className={`p-2 rounded-lg border text-left transition-all ${
              selectedSeverity === 'MEDIUM'
                ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                : 'bg-amber-50/50 hover:bg-amber-50 border-amber-200 text-amber-900'
            }`}
          >
            <span className="text-[10px] uppercase font-bold tracking-wider opacity-80 block">Medium Severity</span>
            <span className="text-lg font-black leading-tight block">{countsBySeverity.medium}</span>
          </button>
        </div>

        {/* Filter Toolbar */}
        <div className="p-3 sm:px-5 bg-slate-50/80 border-b border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 shrink-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="text-xs font-semibold bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-2xs text-slate-700"
              >
                <option value="ALL">All Alert Types ({alerts.length})</option>
                <option value="Progress Stagnation">Progress Stagnation ({countsByType['Progress Stagnation'] || 0})</option>
                <option value="Deteriorating Progress">Deteriorating Progress ({countsByType['Deteriorating Progress'] || 0})</option>
                <option value="Schedule Pressure">Schedule Pressure ({countsByType['Schedule Pressure'] || 0})</option>
                <option value="Cost Escalation">Cost Escalation ({countsByType['Cost Escalation'] || 0})</option>
                <option value="Physical-Financial Divergence">Physical-Financial Divergence ({countsByType['Physical-Financial Divergence'] || 0})</option>
                <option value="High/Critical Risk">High/Critical Risk ({countsByType['High/Critical Risk'] || 0})</option>
              </select>
            </div>

            <span className="text-xs text-slate-500 font-medium">
              Showing <strong>{filteredAlerts.length}</strong> matching signals
            </span>
          </div>

          <div className="relative min-w-[220px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by project, state, code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg bg-white border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-800 placeholder-slate-400 shadow-2xs"
            />
          </div>
        </div>

        {/* Alerts List Container */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
          {filteredAlerts.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-xs">
              <Info className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="font-semibold text-slate-700">No early warning alerts match the selected criteria.</p>
              <p className="text-slate-400 mt-0.5">Try changing severity or alert type filters.</p>
            </div>
          ) : (
            filteredAlerts.map((alert) => {
              const borderCol =
                alert.severity === 'CRITICAL' ? 'border-l-red-500 hover:border-red-400' :
                alert.severity === 'HIGH' ? 'border-l-orange-500 hover:border-orange-400' :
                'border-l-amber-500 hover:border-amber-400';

              return (
                <div
                  key={alert.id}
                  onClick={() => handleOpenProject(alert)}
                  className={`bg-white border border-slate-200 border-l-4 ${borderCol} rounded-xl p-4 shadow-xs hover:shadow-sm transition-all cursor-pointer group`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
                    <div className="flex flex-wrap items-center gap-2">
                      {getSeverityBadge(alert.severity)}
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${getTypeBadge(alert.alertType)}`}>
                        {alert.alertType}
                      </span>
                      <span className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        Detected: {alert.detectedPeriod}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs shrink-0">
                      {alert.priorityScore != null && (
                        <span className="text-[11px] text-slate-500">
                          Priority: <strong className="text-slate-800">{alert.priorityTier || 'P1'} • {alert.priorityScore}</strong>
                        </span>
                      )}
                      {alert.riskScore != null && (
                        <span className="text-[11px] text-slate-500">
                          Risk: <strong className="text-slate-800">{alert.riskScore}/100</strong>
                        </span>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenProject(alert);
                        }}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-800 group-hover:translate-x-0.5 transition-transform"
                      >
                        <span>Inspect Project</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Project Identification */}
                  <div className="mt-2.5">
                    <h3 className="text-sm font-bold text-slate-900 group-hover:text-blue-700 transition-colors">
                      {alert.projectName}
                    </h3>
                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 mt-1">
                      <span className="font-mono text-slate-600 font-semibold">{alert.projectCode}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Building2 className="w-3 h-3 text-slate-400" />
                        {alert.sector}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        {alert.state}
                      </span>
                      {alert.implementingAgency && (
                        <>
                          <span>•</span>
                          <span>{alert.implementingAgency}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Evidence Block */}
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                    <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/80">
                      <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block mb-1">
                        Observed Evidence
                      </span>
                      <p className="text-slate-800 font-medium leading-relaxed text-[11px]">
                        "{alert.evidence}"
                      </p>
                    </div>

                    <div className="bg-blue-50/50 p-2.5 rounded-lg border border-blue-100">
                      <span className="text-[10px] uppercase font-bold text-blue-700 tracking-wider block mb-1">
                        Recommended Attention
                      </span>
                      <p className="text-blue-950 font-medium leading-relaxed text-[11px]">
                        {alert.recommendedAttention}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 sm:px-5 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500 shrink-0">
          <div className="flex items-center gap-1.5 text-[11px]">
            <Info className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span>
              Alerts are <strong>not predictions of failure</strong>. They are evidence-based early warnings indicating operational conditions requiring oversight attention.
            </span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 transition-colors shadow-2xs self-end sm:self-auto"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
