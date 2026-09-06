import React from 'react';
import { ChevronDown, Sparkles, RefreshCw } from 'lucide-react';
import { DEMO_USER_ROLES } from '../../data/projectsData';
import { UserRole } from '../types/index';

interface NavbarProps {
  currentRole: UserRole;
  onSelectRole: (role: UserRole) => void;
  onOpenCopilot: () => void;
  onOpenReport?: () => void;
  onResetDemo: () => void;
  isCopilotOpen: boolean;
  activeView: 'dashboard' | 'projects' | 'gis' | 'analytics';
  onChangeView: (view: 'dashboard' | 'projects' | 'gis' | 'analytics') => void;
  dataSource?: 'PAIMANA' | 'DEMO';
}

export const Navbar: React.FC<NavbarProps> = ({
  currentRole,
  onSelectRole,
  onOpenCopilot,
  onResetDemo,
  isCopilotOpen,
  activeView,
  onChangeView,
  dataSource = 'PAIMANA'
}) => {
  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200 text-slate-900 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* LEFT: PRISM logo + name + subtitle & STATUS badge */}
          <div className="flex items-center gap-3 sm:gap-4 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-blue-600 via-orange-500 to-emerald-600 flex items-center justify-center p-0.5 shadow-sm">
                <div className="w-full h-full bg-white rounded-[6px] flex items-center justify-center font-black text-blue-600 text-base tracking-wider">
                  Δ
                </div>
              </div>
              <div>
                <div className="flex items-center gap-1.5 leading-none">
                  <span className="font-extrabold text-lg tracking-tight text-slate-900">
                    PRISM
                  </span>
                  <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                    SIH 2026
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 font-medium leading-none mt-1 hidden sm:block">
                  Predictive Risk Intelligence & Smart Monitoring
                </p>
              </div>
            </div>

            {/* STATUS: Badge */}
            <div className="flex items-center pl-1 sm:pl-2">
              <div className="h-4 w-px bg-slate-200 mr-2 sm:mr-3 hidden md:block"></div>
              {dataSource === 'DEMO' ? (
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-[11px] font-semibold tracking-wide">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                  <span>DEMO SHOWCASE</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-semibold tracking-wide">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span>PAIMANA LIVE</span>
                </div>
              )}
            </div>
          </div>

          {/* CENTER: Clean navigation tabs without segmented pill container */}
          <nav className="flex items-center gap-1 sm:gap-6 h-full shrink-0">
            <button
              onClick={() => onChangeView('dashboard')}
              className={`h-full flex items-center px-1 text-xs font-semibold border-b-2 transition-colors ${
                activeView === 'dashboard'
                  ? 'border-blue-600 text-blue-700 font-bold'
                  : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => onChangeView('projects')}
              className={`h-full flex items-center px-1 text-xs font-semibold border-b-2 transition-colors ${
                activeView === 'projects'
                  ? 'border-blue-600 text-blue-700 font-bold'
                  : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
              }`}
            >
              Projects
            </button>
            <button
              onClick={() => onChangeView('gis')}
              className={`h-full flex items-center px-1 text-xs font-semibold border-b-2 transition-colors ${
                activeView === 'gis'
                  ? 'border-blue-600 text-blue-700 font-bold'
                  : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
              }`}
            >
              Risk Map
            </button>
            <button
              onClick={() => onChangeView('analytics')}
              className={`h-full flex items-center px-1 text-xs font-semibold border-b-2 transition-colors ${
                activeView === 'analytics'
                  ? 'border-blue-600 text-blue-700 font-bold'
                  : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
              }`}
            >
              Analytics
            </button>
          </nav>

          {/* RIGHT: Judge Demo compact selector | Copilot compact button | Refresh icon */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Judge Demo compact selector */}
            <div className="relative inline-flex items-center">
              <select
                value={currentRole.id}
                onChange={(e) => {
                  const r = DEMO_USER_ROLES.find(x => x.id === e.target.value);
                  if (r) onSelectRole(r);
                }}
                className="appearance-none bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-medium rounded-lg pl-2.5 pr-6 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer shadow-sm transition-colors"
                title="Switch Evaluation Role / Mode"
              >
                {DEMO_USER_ROLES.map(role => (
                  <option key={role.id} value={role.id}>
                    {role.id === 'role-judge' ? 'Judge Demo ▾' : `${role.badge} ▾`}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 pointer-events-none" />
            </div>

            {/* Copilot compact button */}
            <button
              onClick={onOpenCopilot}
              className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition-all ${
                isCopilotOpen
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300 shadow-sm'
              }`}
              title="Toggle PRISM AI Copilot"
            >
              <Sparkles className={`w-3.5 h-3.5 ${isCopilotOpen ? 'text-white' : 'text-blue-600'}`} />
              <span>Copilot</span>
            </button>

            {/* Refresh icon */}
            <button
              onClick={onResetDemo}
              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors border border-transparent hover:border-slate-200"
              title="Reset Demo Simulation State / Refresh"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

        </div>
      </div>
    </header>
  );
};
