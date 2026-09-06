import React from 'react';
import { ShieldAlert, Activity, Sparkles, FileText, Bot, RefreshCw, Layers } from 'lucide-react';
import { DEMO_USER_ROLES } from '../../data/projectsData';
import { UserRole } from '../types/index';

interface NavbarProps {
  currentRole: UserRole;
  onSelectRole: (role: UserRole) => void;
  onOpenCopilot: () => void;
  onOpenReport: () => void;
  onResetDemo: () => void;
  isCopilotOpen: boolean;
  activeView: 'dashboard' | 'gis' | 'analytics';
  onChangeView: (view: 'dashboard' | 'gis' | 'analytics') => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentRole,
  onSelectRole,
  onOpenCopilot,
  onOpenReport,
  onResetDemo,
  isCopilotOpen,
  activeView,
  onChangeView
}) => {
  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200 text-slate-900 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo & National Branding */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-tr from-blue-600 via-orange-500 to-emerald-600 flex items-center justify-center p-0.5 shadow-inner">
                <div className="w-full h-full bg-white rounded-[7px] flex items-center justify-center font-black text-blue-600 text-lg tracking-wider">
                  Δ
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-xl tracking-tight text-slate-900 flex items-center gap-1">
                    PRISM
                  </span>
                  <span className="text-[10px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded bg-blue-600 text-blue-600 border border-blue-600">
                    SIH 2026
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 font-medium leading-none mt-0.5 hidden sm:block">
                  Predictive Risk Intelligence & Smart Monitoring • MoSPI / PMG
                </p>
              </div>
            </div>

            {/* Live Engine Status Chips */}
            <div className="hidden lg:flex items-center gap-2 pl-4 border-l border-slate-200">
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 text-xs font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>ML Pipeline: Calibrated</span>
              </div>
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-600 text-xs font-medium">
                <Activity className="w-3 h-3" />
                <span>PAIMANA Sync: Online</span>
              </div>
            </div>
          </div>

          {/* Navigation Views */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-300">
            <button
              onClick={() => onChangeView('dashboard')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                activeView === 'dashboard'
                  ? 'bg-blue-600 text-white font-bold shadow-sm'
                  : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200'
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => onChangeView('gis')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                activeView === 'gis'
                  ? 'bg-blue-600 text-white font-bold shadow-sm'
                  : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200'
              }`}
            >
              GIS Risk Map
            </button>
            <button
              onClick={() => onChangeView('analytics')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                activeView === 'analytics'
                  ? 'bg-blue-600 text-white font-bold shadow-sm'
                  : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200'
              }`}
            >
              Analytics
            </button>
          </div>

          {/* Right Actions & Role Switcher */}
          <div className="flex items-center gap-3">
            {/* Role Switcher */}
            <div className="hidden md:flex items-center gap-2">
              <span className="text-xs text-slate-600">Persona:</span>
              <select
                value={currentRole.id}
                onChange={(e) => {
                  const r = DEMO_USER_ROLES.find(x => x.id === e.target.value);
                  if (r) onSelectRole(r);
                }}
                className="bg-slate-100 border border-slate-300 text-xs text-blue-600 rounded-md px-2.5 py-1.5 font-medium focus:outline-none focus:ring-1 focus:ring-blue-600"
              >
                {DEMO_USER_ROLES.map(role => (
                  <option key={role.id} value={role.id}>
                    {role.badge} ({role.name.split(',')[0]})
                  </option>
                ))}
              </select>
            </div>

            {/* Flash Report Button */}
            <button
              onClick={onOpenReport}
              className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
              title="Generate MoSPI Executive Flash Report"
            >
              <FileText className="w-3.5 h-3.5 text-blue-600" />
              <span className="hidden sm:inline">Flash Report</span>
            </button>

            {/* AI Copilot Button */}
            <button
              onClick={onOpenCopilot}
              className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ${
                isCopilotOpen
                  ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-orange-500/20'
                  : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-slate-900 shadow-sm'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>PRISM Copilot</span>
            </button>

            {/* Demo Reset */}
            <button
              onClick={onResetDemo}
              className="p-1.5 text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
              title="Reset Demo Simulation State"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
