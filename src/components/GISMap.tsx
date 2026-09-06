import React, { useState } from 'react';
import { ShieldAlert, AlertTriangle, MapPin, Eye, ExternalLink, Compass } from 'lucide-react';
import { Project, RiskTier } from '../types/index';

interface GISMapProps {
  projects: Project[];
  onSelectProject: (project: Project) => void;
  selectedProjectId?: string;
}

export const GISMap: React.FC<GISMapProps> = ({ projects, onSelectProject, selectedProjectId }) => {
  const [hoveredProject, setHoveredProject] = useState<Project | null>(null);
  const [sectorFilter, setSectorFilter] = useState<string>('ALL');

  // Convert Indian Latitude (approx 8°N to 37°N) & Longitude (approx 68°E to 97°E) to SVG Percentage coordinates
  // Lat: 37°N is top (y: 8%), 8°N is bottom (y: 92%)
  // Lng: 68°E is left (x: 10%), 97°E is right (x: 90%)
  const projectToCoords = (lat: number, lng: number) => {
    const minLat = 7.5;
    const maxLat = 36.5;
    const minLng = 67.5;
    const maxLng = 96.5;

    const x = ((lng - minLng) / (maxLng - minLng)) * 80 + 10;
    const y = ((maxLat - lat) / (maxLat - minLat)) * 80 + 8;

    return { x: Math.max(5, Math.min(95, x)), y: Math.max(5, Math.min(95, y)) };
  };

  const getPinColor = (tier: RiskTier) => {
    switch (tier) {
      case 'CRITICAL':
        return { bg: 'bg-red-500', border: 'border-red-300', text: 'text-red-600', ring: 'border-red-500/40' };
      case 'HIGH':
        return { bg: 'bg-orange-500', border: 'border-orange-300', text: 'text-orange-600', ring: 'border-orange-500/40' };
      case 'MODERATE':
        return { bg: 'bg-yellow-500', border: 'border-yellow-300', text: 'text-amber-600', ring: 'border-yellow-500/40' };
      case 'LOW':
        return { bg: 'bg-emerald-500', border: 'border-emerald-300', text: 'text-emerald-600', ring: 'border-emerald-500/40' };
      case 'UNRATED':
      default:
        return { bg: 'bg-slate-500', border: 'border-slate-300', text: 'text-slate-600', ring: 'border-slate-500/40' };
    }
  };

  const displayedProjects = sectorFilter === 'ALL' 
    ? projects 
    : projects.filter(p => p.sector === sectorFilter);

  // Strictly omit projects without valid geocoordinates (zero coordinate fabrication)
  const geolocatedProjects = displayedProjects.filter(
    p => p.location?.lat != null && p.location?.lng != null && p.location.lat > 0 && p.location.lng > 0
  );

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
      
      {/* Map Header & Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b border-slate-200 gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Compass className="w-5 h-5 text-blue-600" />
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              National Infrastructure GIS Geospatial Risk Surface
            </h2>
          </div>
          <p className="text-xs text-slate-600 mt-0.5">
            Geolocated risk distribution across national transport, power, and maritime corridors
          </p>
        </div>

        {/* Quick Legend & Sector Filter */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-50 border border-slate-200">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"></span>
            <span className="text-slate-700 font-medium">Critical</span>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-50 border border-slate-200">
            <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span>
            <span className="text-slate-700 font-medium">High</span>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-50 border border-slate-200">
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-500"></span>
            <span className="text-slate-700 font-medium">Medium</span>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-50 border border-slate-200">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            <span className="text-slate-700 font-medium">Low</span>
          </div>
        </div>
      </div>

      {/* Map Canvas Container */}
      <div className="relative mt-4 w-full h-[540px] bg-gradient-to-b from-gray-50 via-gray-100 to-gray-50 rounded-xl border border-slate-200 overflow-hidden select-none">
        
        {/* Cartographic Grid Lines */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b15_1px,transparent_1px),linear-gradient(to_bottom,#1e293b15_1px,transparent_1px)] bg-[size:4rem_4rem]"></div>
        
        {/* Stylized India Geography Contour Background SVG */}
        <svg
          className="absolute inset-0 w-full h-full opacity-30 pointer-events-none stroke-slate-700/60 fill-slate-800/10"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          {/* Stylized outline of Indian Subcontinent boundaries */}
          <path
            d="M 28 10 
               Q 35 6, 42 10 
               Q 52 14, 58 20 
               Q 72 22, 86 24 
               Q 92 28, 86 34 
               Q 78 35, 75 32 
               Q 68 36, 64 42 
               Q 62 55, 56 68 
               Q 50 82, 45 92 
               Q 38 82, 34 68 
               Q 26 56, 22 46 
               Q 16 38, 22 28 
               Q 26 22, 28 10 Z"
            strokeWidth="0.8"
            strokeDasharray="2 2"
          />
          {/* Tropic of Cancer & Equator guidance latitudinal lines */}
          <line x1="5" y1="48" x2="95" y2="48" stroke="#334155" strokeWidth="0.4" strokeDasharray="3 3" />
          <text x="7" y="46" fill="#64748b" fontSize="2.2" fontStyle="italic">23.5° N Tropic of Cancer</text>
        </svg>

        {/* Notice when viewing PAIMANA projects with no coordinates */}
        {geolocatedProjects.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none p-6">
            <div className="bg-white/95 backdrop-blur border border-slate-300 rounded-xl p-5 text-center max-w-md shadow-lg pointer-events-auto">
              <div className="w-10 h-10 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center mx-auto mb-2.5 text-blue-600">
                <Compass className="w-5 h-5" />
              </div>
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Geospatial Coordinates Not In Dataset
              </h4>
              <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                The official MoSPI PAIMANA dataset does not include GIS coordinates. To preserve data integrity, coordinates are not fabricated. Projects without verified coordinates are omitted from the map.
              </p>
            </div>
          </div>
        )}

        {/* Project Geo Pins for geocoded projects */}
        {geolocatedProjects.map((p) => {
          const coords = projectToCoords(p.location.lat!, p.location.lng!);
          const colors = getPinColor(p.riskTier);
          const isSelected = p.id === selectedProjectId;

          return (
            <div
              key={p.id}
              style={{ left: `${coords.x}%`, top: `${coords.y}%` }}
              className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer z-10 group"
              onMouseEnter={() => setHoveredProject(p)}
              onMouseLeave={() => setHoveredProject(null)}
              onClick={() => onSelectProject(p)}
            >
              {/* Pulsing Radar Ring for Critical Projects */}
              {p.riskTier === 'CRITICAL' && (
                <span className="absolute -inset-2 rounded-full bg-red-500/30 animate-ping pointer-events-none" />
              )}

              {/* Pin Marker */}
              <div
                className={`w-6 h-6 rounded-full ${colors.bg} border-2 ${colors.border} flex items-center justify-center text-white font-black text-[10px] shadow-lg transition-transform transform group-hover:scale-125 ${
                  isSelected ? 'ring-4 ring-amber-400 scale-125' : ''
                }`}
              >
                {p.riskScore != null ? p.riskScore : '—'}
              </div>

              {/* Label Pill on Hover or Selected */}
              <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute top-7 left-1/2 -translate-x-1/2 whitespace-nowrap bg-slate-50 border border-slate-300 text-slate-900 text-[11px] font-medium px-2 py-1 rounded shadow-xl pointer-events-none z-30">
                {p.name.split('(')[0]}
                <span className="ml-1 text-slate-600">({p.location.city || p.state})</span>
              </div>
            </div>
          );
        })}

        {/* Hover / Selected Info Card (Floating Overlay) */}
        {hoveredProject && (
          <div className="absolute bottom-4 left-4 max-w-sm bg-slate-50 border border-slate-300 rounded-xl p-4 shadow-2xl backdrop-blur z-20 transition-all">
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600">
                  {hoveredProject.sector} • {hoveredProject.state}
                </span>
                <h4 className="text-xs font-bold text-slate-900 mt-0.5 leading-snug">
                  {hoveredProject.name}
                </h4>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  Agency: <span className="text-slate-800">{hoveredProject.implementingAgency}</span>
                </p>
              </div>
              <div className="text-right whitespace-nowrap">
                <span className={`px-2 py-0.5 text-[10px] font-extrabold rounded-full ${
                  hoveredProject.riskTier === 'CRITICAL' ? 'bg-red-50 text-red-700 border border-red-200' :
                  hoveredProject.riskTier === 'HIGH' ? 'bg-orange-50 text-orange-700 border border-orange-200' :
                  'bg-amber-50 text-amber-700 border border-amber-200'
                }`}>
                  {hoveredProject.riskScore} • {hoveredProject.riskTier}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-3 pt-2 border-t border-slate-200 text-[11px]">
              <div>
                <span className="text-slate-600">Revised Budget:</span>
                <p className="font-semibold text-slate-800">₹{hoveredProject.revisedCostCr.toLocaleString()} Cr</p>
              </div>
              <div>
                <span className="text-slate-600">Schedule Slippage:</span>
                <p className="font-semibold text-orange-600">+{hoveredProject.timeOverrunMonths} months</p>
              </div>
              <div>
                <span className="text-slate-600">Physical Progress:</span>
                <p className="font-semibold text-blue-600">{hoveredProject.physicalProgressPercent}%</p>
              </div>
              <div>
                <span className="text-slate-600">Top Bottleneck:</span>
                <p className="font-medium text-blue-600 truncate">{hoveredProject.topRiskDrivers[0]?.label}</p>
              </div>
            </div>

            <button
              onClick={() => onSelectProject(hoveredProject)}
              className="mt-3 w-full py-1.5 px-3 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-colors shadow-sm"
            >
              <span>Inspect Project & Risk Evidence</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Static Map Hint */}
        <div className="absolute top-3 right-3 bg-slate-50 border border-slate-200 text-slate-600 text-[11px] px-2.5 py-1 rounded-md backdrop-blur">
          Click any pin for full risk assessment & priority evidence
        </div>
      </div>
    </div>
  );
};
