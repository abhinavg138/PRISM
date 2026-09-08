/**
 * ============================================================================
 * PRISM — GIS & National State Registry Module
 * Interactive Cartographic Surface with Zero Coordinate Fabrication governance.
 * Projects with coordinates are projected onto SVG map; state registry provides
 * authoritative regional drilldown across all 2,054 PAIMANA projects.
 * ============================================================================
 */

import { state, notify } from './state.js';
import { formatCurrencyCr, getRiskBadgeHtml, renderIcons, escapeHtml } from './utils.js';

let selectedDrilldownState = null;

export function renderGISMap() {
  const container = document.getElementById('gis-map-content');
  if (!container) return;

  const allProjects = state.allProjects || [];
  
  // Filter projects based on GIS view filters
  const riskFilter = document.getElementById('gis-filter-risk')?.value || 'ALL';
  const sectorFilter = document.getElementById('gis-filter-sector')?.value || 'ALL';
  const searchQuery = document.getElementById('gis-filter-search')?.value?.trim().toLowerCase() || '';

  const filtered = allProjects.filter(p => {
    if (riskFilter !== 'ALL' && p.riskTier !== riskFilter) return false;
    if (sectorFilter !== 'ALL' && p.sector !== sectorFilter) return false;
    if (searchQuery) {
      const matchName = (p.name || '').toLowerCase().includes(searchQuery);
      const matchId = (p.id || '').toLowerCase().includes(searchQuery);
      const matchState = (p.state || '').toLowerCase().includes(searchQuery);
      if (!matchName && !matchId && !matchState) return false;
    }
    return true;
  });

  // Zero Coordinate Fabrication: only projects with valid positive coordinates
  const geolocated = filtered.filter(p => p.location && p.location.lat > 0 && p.location.lng > 0);

  // Build state registry
  const stateMap = new Map();
  for (const p of filtered) {
    const st = p.state || 'Unspecified';
    if (!stateMap.has(st)) {
      stateMap.set(st, { state: st, count: 0, cost: 0, critical: 0, high: 0, totalRisk: 0, ratedCount: 0 });
    }
    const entry = stateMap.get(st);
    entry.count++;
    entry.cost += (p.revisedCostCr || p.originalCostCr || 0);
    if (p.riskTier === 'CRITICAL') entry.critical++;
    if (p.riskTier === 'HIGH') entry.high++;
    if (p.riskScore != null) {
      entry.totalRisk += p.riskScore;
      entry.ratedCount++;
    }
  }

  const stateRegistry = Array.from(stateMap.values())
    .map(e => ({
      ...e,
      avgRisk: e.ratedCount > 0 ? (e.totalRisk / e.ratedCount).toFixed(1) : '0'
    }))
    .sort((a, b) => b.count - a.count);

  container.innerHTML = `
    <!-- GIS Filter Bar -->
    <div class="card p-4 mb-5">
      <div class="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div>
          <label class="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Risk Tier Filter</label>
          <select id="gis-filter-risk" class="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium text-slate-800">
            <option value="ALL" ${riskFilter === 'ALL' ? 'selected' : ''}>All Risk Tiers</option>
            <option value="CRITICAL" ${riskFilter === 'CRITICAL' ? 'selected' : ''}>Critical (80–100)</option>
            <option value="HIGH" ${riskFilter === 'HIGH' ? 'selected' : ''}>High (60–79)</option>
            <option value="MODERATE" ${riskFilter === 'MODERATE' ? 'selected' : ''}>Moderate (40–59)</option>
            <option value="LOW" ${riskFilter === 'LOW' ? 'selected' : ''}>Low (0–39)</option>
          </select>
        </div>

        <div>
          <label class="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Sector Filter</label>
          <select id="gis-filter-sector" class="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium text-slate-800">
            <option value="ALL" ${sectorFilter === 'ALL' ? 'selected' : ''}>All Sectors</option>
            ${(state.availableSectors || []).map(sec => `
              <option value="${escapeHtml(sec)}" ${sectorFilter === sec ? 'selected' : ''}>${escapeHtml(sec)}</option>
            `).join('')}
          </select>
        </div>

        <div>
          <label class="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Search Region or Project</label>
          <input type="text" id="gis-filter-search" value="${escapeHtml(searchQuery)}" placeholder="Search state, project..." class="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800">
        </div>

        <div class="flex items-end">
          <button id="btn-gis-reset" class="btn btn-secondary w-full text-xs py-1.5">
            <i data-lucide="rotate-ccw" class="w-3.5 h-3.5"></i> Reset Filters
          </button>
        </div>
      </div>
    </div>

    <!-- Map Canvas Container -->
    <div class="card p-5 mb-6">
      <div class="relative w-full h-[480px] bg-gradient-to-b from-slate-50 via-slate-100 to-slate-50 rounded-xl border border-slate-200 overflow-hidden select-none">
        
        <!-- Cartographic Grid -->
        <div class="absolute inset-0 bg-[linear-gradient(to_right,#1e293b0a_1px,transparent_1px),linear-gradient(to_bottom,#1e293b0a_1px,transparent_1px)] bg-[size:4rem_4rem]"></div>

        <!-- Stylized India Geography Contour Background SVG -->
        <svg class="absolute inset-0 w-full h-full opacity-25 pointer-events-none stroke-slate-600 fill-slate-700/5" viewBox="0 0 100 100" preserveAspectRatio="none">
          <path d="M 28 10 Q 35 6, 42 10 Q 52 14, 58 20 Q 72 22, 86 24 Q 92 28, 86 34 Q 78 35, 75 32 Q 68 36, 64 42 Q 62 55, 56 68 Q 50 82, 45 92 Q 38 82, 34 68 Q 26 56, 22 46 Q 16 38, 22 28 Q 26 22, 28 10 Z" stroke-width="0.8" stroke-dasharray="2 2" />
          <line x1="5" y1="48" x2="95" y2="48" stroke="#334155" stroke-width="0.4" stroke-dasharray="3 3" />
          <text x="7" y="46" fill="#64748b" font-size="2.2" font-style="italic">23.5° N Tropic of Cancer</text>
        </svg>

        <!-- Zero Coordinate Fabrication Informational Overlay if 0 projects have GPS -->
        ${geolocated.length === 0 ? `
          <div class="absolute inset-0 flex items-center justify-center p-6">
            <div class="bg-white/95 backdrop-blur-md border border-slate-300 rounded-2xl p-6 text-center max-w-lg shadow-xl pointer-events-auto">
              <div class="w-12 h-12 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center mx-auto mb-3 text-blue-600">
                <i data-lucide="compass" class="w-6 h-6"></i>
              </div>
              <h4 class="text-sm font-bold text-slate-900 uppercase tracking-wider">MoSPI PAIMANA Geographic Coverage Notice</h4>
              <p class="text-xs text-slate-600 mt-2 leading-relaxed">
                The official MoSPI PAIMANA dataset tracks projects by administrative <strong>State</strong> and <strong>Agency</strong>, but does not record physical GPS coordinates.
              </p>
              <div class="text-[11px] text-slate-500 mt-2 font-medium bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                🛡️ <strong>Zero Coordinate Fabrication</strong>: Under PRISM data integrity standards, synthetic coordinates are strictly prohibited. Explore all <strong>${filtered.length.toLocaleString()} projects</strong> via the <strong>National State Registry</strong> below.
              </div>
              <div class="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-200 text-center">
                <div class="p-2 bg-slate-50 rounded-lg">
                  <span class="text-[10px] text-slate-500 uppercase block">Projects</span>
                  <span class="text-xs font-mono font-bold text-slate-900">${filtered.length.toLocaleString()}</span>
                </div>
                <div class="p-2 bg-slate-50 rounded-lg">
                  <span class="text-[10px] text-slate-500 uppercase block">Active States</span>
                  <span class="text-xs font-mono font-bold text-blue-600">${stateRegistry.length}</span>
                </div>
                <div class="p-2 bg-slate-50 rounded-lg">
                  <span class="text-[10px] text-slate-500 uppercase block">High / Critical</span>
                  <span class="text-xs font-mono font-bold text-red-600">
                    ${filtered.filter(p => p.riskTier === 'CRITICAL' || p.riskTier === 'HIGH').length}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ` : `
          <!-- Geo Pins for coordinates -->
          ${geolocated.map(p => {
            const coords = projectToCoords(p.location.lat, p.location.lng);
            let pinColor = 'bg-emerald-500';
            if (p.riskTier === 'CRITICAL') pinColor = 'bg-red-500';
            else if (p.riskTier === 'HIGH') pinColor = 'bg-orange-500';
            else if (p.riskTier === 'MODERATE') pinColor = 'bg-amber-500';

            return `
              <div class="map-pin" style="left: ${coords.x}%; top: ${coords.y}%;" title="${escapeHtml(p.name)} (${p.riskTier})" onclick="window.prismApp.openProjectDetail('${escapeHtml(p.id)}')">
                <div class="w-3.5 h-3.5 rounded-full ${pinColor} border-2 border-white shadow-md"></div>
              </div>
            `;
          }).join('')}
        `}
      </div>
    </div>

    <!-- National State Registry Table -->
    <div class="card p-5">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <div>
          <h3 class="text-base font-bold text-slate-900 flex items-center gap-2">
            <i data-lucide="layers" class="w-4 h-4 text-blue-600"></i>
            National State & Regional Registry (${stateRegistry.length} States/UTs)
          </h3>
          <p class="text-xs text-slate-500">Portfolio distribution, total budget, and critical risk concentration by administrative territory</p>
        </div>
        ${selectedDrilldownState ? `
          <button id="btn-clear-state-drilldown" class="btn btn-secondary text-xs py-1 px-2.5">
            Clear State Filter: <strong>${escapeHtml(selectedDrilldownState)}</strong> &times;
          </button>
        ` : ''}
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs">
          <thead>
            <tr class="border-b border-slate-200 bg-slate-50 text-slate-500 font-semibold">
              <th class="py-2.5 px-3">State / Union Territory</th>
              <th class="py-2.5 px-3">Total Projects</th>
              <th class="py-2.5 px-3">Sanctioned Outlay</th>
              <th class="py-2.5 px-3">Avg Risk Score</th>
              <th class="py-2.5 px-3">Critical Projects</th>
              <th class="py-2.5 px-3">High Risk Projects</th>
              <th class="py-2.5 px-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            ${stateRegistry.map(s => `
              <tr class="hover:bg-slate-50/80 transition-colors ${selectedDrilldownState === s.state ? 'bg-blue-50/60 font-semibold' : ''}">
                <td class="py-2.5 px-3 font-semibold text-slate-900">${escapeHtml(s.state)}</td>
                <td class="py-2.5 px-3 font-mono">${s.count}</td>
                <td class="py-2.5 px-3">${formatCurrencyCr(s.cost)}</td>
                <td class="py-2.5 px-3 font-mono font-bold ${Number(s.avgRisk) >= 60 ? 'text-red-600' : 'text-slate-700'}">${s.avgRisk}</td>
                <td class="py-2.5 px-3"><span class="badge ${s.critical > 0 ? 'badge-critical' : 'badge-low'} text-[10px]">${s.critical}</span></td>
                <td class="py-2.5 px-3"><span class="badge ${s.high > 0 ? 'badge-high' : 'badge-low'} text-[10px]">${s.high}</span></td>
                <td class="py-2.5 px-3 text-right">
                  <button class="btn btn-secondary py-0.5 px-2 text-[11px] btn-filter-state-projects" data-state="${escapeHtml(s.state)}">
                    Filter Projects
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  renderIcons();
  bindGisEvents();
}

function bindGisEvents() {
  document.getElementById('gis-filter-risk')?.addEventListener('change', renderGISMap);
  document.getElementById('gis-filter-sector')?.addEventListener('change', renderGISMap);
  
  let debounceTimer = null;
  document.getElementById('gis-filter-search')?.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(renderGISMap, 200);
  });

  document.getElementById('btn-gis-reset')?.addEventListener('click', () => {
    const r = document.getElementById('gis-filter-risk');
    const s = document.getElementById('gis-filter-sector');
    const q = document.getElementById('gis-filter-search');
    if (r) r.value = 'ALL';
    if (s) s.value = 'ALL';
    if (q) q.value = '';
    selectedDrilldownState = null;
    renderGISMap();
  });

  document.getElementById('btn-clear-state-drilldown')?.addEventListener('click', () => {
    selectedDrilldownState = null;
    renderGISMap();
  });

  document.querySelectorAll('.btn-filter-state-projects').forEach(btn => {
    btn.addEventListener('click', () => {
      const st = btn.getAttribute('data-state');
      if (st) {
        state.filters.state = st;
        notify('NAVIGATE', 'projects');
      }
    });
  });
}

function projectToCoords(lat, lng) {
  const minLat = 7.5;
  const maxLat = 36.5;
  const minLng = 67.5;
  const maxLng = 96.5;

  const x = ((lng - minLng) / (maxLng - minLng)) * 80 + 10;
  const y = ((maxLat - lat) / (maxLat - minLat)) * 80 + 8;

  return { x: Math.max(5, Math.min(95, x)), y: Math.max(5, Math.min(95, y)) };
}
