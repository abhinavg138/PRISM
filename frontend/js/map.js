/**
 * ============================================================================
 * PRISM — GIS & National State Registry Module (v10)
 * Interactive Leaflet Cartographic Surface with State-Capital Anchor Pins.
 * Visualizes authoritative state-level project density and risk concentration
 * under strict "Zero Coordinate Fabrication" governance.
 * ============================================================================
 */

import { state, notify } from './state.js';
import { formatCurrencyCr, renderIcons, escapeHtml } from './utils.js';

let selectedDrilldownState = null;
let leafletMap = null;
let markersLayer = null;

// Authoritative State / UT Capital Coordinates Reference Table
const STATE_CAPITAL_COORDS = {
  'Andhra Pradesh': [16.5062, 80.6480],
  'Arunachal Pradesh': [27.0844, 93.6053],
  'Assam': [26.1433, 91.7898],
  'Bihar': [25.5941, 85.1376],
  'Chhattisgarh': [21.2514, 81.6296],
  'Goa': [15.4909, 73.8278],
  'Gujarat': [23.2156, 72.6369],
  'Haryana': [30.7333, 76.7794],
  'Himachal Pradesh': [31.1048, 77.1734],
  'Jharkhand': [23.3441, 85.3096],
  'Karnataka': [12.9716, 77.5946],
  'Kerala': [8.5241, 76.9366],
  'Madhya Pradesh': [23.2599, 77.4126],
  'Maharashtra': [19.0760, 72.8777],
  'Manipur': [24.8170, 93.9368],
  'Meghalaya': [25.5788, 91.8933],
  'Mizoram': [23.7271, 92.7176],
  'Nagaland': [25.6751, 94.1086],
  'Odisha': [20.2961, 85.8245],
  'Punjab': [30.7333, 76.7794],
  'Rajasthan': [26.9124, 75.7873],
  'Sikkim': [27.3389, 88.6065],
  'Tamil Nadu': [13.0827, 80.2707],
  'Telangana': [17.3850, 78.4867],
  'Tripura': [23.8315, 91.2868],
  'Uttar Pradesh': [26.8467, 80.9462],
  'Uttarakhand': [30.3165, 78.0322],
  'West Bengal': [22.5726, 88.3639],
  'Andaman and Nicobar Islands': [11.6234, 92.7265],
  'Chandigarh': [30.7333, 76.7794],
  'Dadra and Nagar Haveli and Daman and Diu': [20.3974, 72.8328],
  'Delhi': [28.6139, 77.2090],
  'Jammu and Kashmir': [34.0837, 74.7973],
  'Ladakh': [34.1526, 77.5771],
  'Lakshadweep': [10.5593, 72.6358],
  'Puducherry': [11.9416, 79.8083]
};

const STATE_ALIASES = {
  'Andaman & Nicobar': 'Andaman and Nicobar Islands',
  'Andaman & Nicobar Islands': 'Andaman and Nicobar Islands',
  'Dadra & Nagar Haveli and Daman & Diu': 'Dadra and Nagar Haveli and Daman and Diu',
  'DNH & DD': 'Dadra and Nagar Haveli and Daman and Diu',
  'NCT of Delhi': 'Delhi',
  'Orissa': 'Odisha',
  'Pondicherry': 'Puducherry'
};

function getStateCoords(stateName) {
  if (!stateName) return null;
  const clean = stateName.trim();
  if (STATE_CAPITAL_COORDS[clean]) return STATE_CAPITAL_COORDS[clean];
  const alias = STATE_ALIASES[clean];
  if (alias && STATE_CAPITAL_COORDS[alias]) return STATE_CAPITAL_COORDS[alias];
  const lower = clean.toLowerCase();
  for (const [k, v] of Object.entries(STATE_CAPITAL_COORDS)) {
    if (k.toLowerCase() === lower) return v;
  }
  return null;
}

function getStateRiskTheme(s) {
  const count = Math.max(1, s.count);
  const highCritShare = (s.critical + s.high) / count;
  const avgScore = Number(s.avgRisk) || 0;

  if (highCritShare >= 0.40 || avgScore >= 65) {
    return {
      fillColor: '#ef4444',
      tierLabel: 'Critical / High Risk',
      colorClass: 'text-red-600',
      badgeClass: 'badge-critical'
    };
  }
  if (highCritShare >= 0.20 || avgScore >= 50) {
    return {
      fillColor: '#f97316',
      tierLabel: 'Elevated Risk',
      colorClass: 'text-amber-600',
      badgeClass: 'badge-high'
    };
  }
  if (avgScore >= 35) {
    return {
      fillColor: '#3b82f6',
      tierLabel: 'Moderate Oversight',
      colorClass: 'text-blue-600',
      badgeClass: 'badge-moderate'
    };
  }
  return {
    fillColor: '#10b981',
    tierLabel: 'Low Risk Concentration',
    colorClass: 'text-emerald-600',
    badgeClass: 'badge-low'
  };
}

function buildStatePopupHtml(s, theme) {
  return `
    <div class="p-3.5 bg-white text-slate-800 text-xs min-w-[240px]">
      <div class="flex items-center justify-between border-b border-slate-100 pb-2 mb-2.5">
        <div>
          <h4 class="font-bold text-slate-900 text-sm leading-tight">${escapeHtml(s.state)}</h4>
          <span class="text-[10px] text-slate-500 font-medium">State-Capital Regional Anchor</span>
        </div>
        <span class="badge ${theme.badgeClass} text-[10px] font-bold">${theme.tierLabel}</span>
      </div>

      <div class="grid grid-cols-2 gap-2 mb-3">
        <div class="bg-slate-50 p-2 rounded-lg border border-slate-100">
          <span class="text-[10px] text-slate-500 uppercase font-semibold block">Projects</span>
          <span class="text-sm font-bold text-slate-900 font-mono">${s.count}</span>
        </div>
        <div class="bg-slate-50 p-2 rounded-lg border border-slate-100">
          <span class="text-[10px] text-slate-500 uppercase font-semibold block">Avg Risk</span>
          <span class="text-sm font-bold ${Number(s.avgRisk) >= 60 ? 'text-red-600' : 'text-slate-900'} font-mono">${s.avgRisk}/100</span>
        </div>
      </div>

      <div class="space-y-1 text-[11px] text-slate-600 mb-3 border-t border-slate-100 pt-2">
        <div class="flex justify-between">
          <span class="text-slate-500">Sanctioned Outlay:</span>
          <span class="font-mono font-bold text-slate-800">${formatCurrencyCr(s.cost)}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-slate-500">Critical Projects:</span>
          <span class="font-bold ${s.critical > 0 ? 'text-red-600' : 'text-slate-700'}">${s.critical}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-slate-500">High Risk Projects:</span>
          <span class="font-bold ${s.high > 0 ? 'text-amber-600' : 'text-slate-700'}">${s.high}</span>
        </div>
      </div>

      <button onclick="window.prismApp.filterByState('${escapeHtml(s.state)}')" class="w-full py-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer">
        <span>View ${escapeHtml(s.state)} Projects</span>
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"></path></svg>
      </button>
    </div>
  `;
}

// Expose filterByState on window.prismApp for map popup drilldowns
if (!window.prismApp) window.prismApp = {};
window.prismApp.filterByState = function(stateName) {
  if (!stateName) return;
  state.filters.state = stateName;
  state.pagination.page = 1;
  const stateSelect = document.getElementById('filter-state');
  if (stateSelect) stateSelect.value = stateName;
  notify('NAVIGATE', 'projects');
};

export function invalidateMapSize() {
  if (leafletMap) {
    leafletMap.invalidateSize();
  }
}

function initLeafletMap(stateRegistry) {
  const mapContainer = document.getElementById('leaflet-map-container');
  if (!mapContainer || !window.L) return;

  if (leafletMap) {
    leafletMap.remove();
    leafletMap = null;
    markersLayer = null;
  }

  leafletMap = L.map(mapContainer, {
    center: [22.9734, 78.6569],
    zoom: 5,
    minZoom: 4,
    maxZoom: 10,
    scrollWheelZoom: false
  });

  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19
  }).addTo(leafletMap);

  markersLayer = L.layerGroup().addTo(leafletMap);

  let plottedCount = 0;
  for (const s of stateRegistry) {
    const coords = getStateCoords(s.state);
    if (!coords) {
      console.warn(`[GIS Map] No capital coordinates mapped for state: "${s.state}"`);
      continue;
    }

    // Scale radius smoothly with square root of project count
    const radius = Math.min(30, Math.max(7, Math.round(5 + Math.sqrt(s.count) * 1.5)));
    const theme = getStateRiskTheme(s);

    const marker = L.circleMarker(coords, {
      radius: radius,
      fillColor: theme.fillColor,
      color: '#ffffff',
      weight: 2,
      opacity: 0.95,
      fillOpacity: 0.75
    });

    const popupContent = buildStatePopupHtml(s, theme);
    marker.bindPopup(popupContent, {
      maxWidth: 280,
      className: 'prism-leaflet-popup'
    });

    marker.bindTooltip(`<strong>${escapeHtml(s.state)}</strong>: ${s.count} projects (Avg Risk: ${s.avgRisk})`, {
      direction: 'top',
      offset: [0, -radius],
      opacity: 0.9
    });

    marker.addTo(markersLayer);
    plottedCount++;
  }

  setTimeout(() => {
    if (leafletMap) leafletMap.invalidateSize();
  }, 100);
}

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
    <div class="card p-4 sm:p-5 mb-6">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
        <div>
          <h3 class="text-sm font-bold text-slate-900 flex items-center gap-2">
            <i data-lucide="map" class="w-4 h-4 text-blue-600"></i>
            Interactive National Geographic Surface
          </h3>
          <p class="text-xs text-slate-500">State capital anchors scaled by project density and colored by risk concentration</p>
        </div>

        <!-- Small Unobtrusive Data Integrity Info Affordance -->
        <div class="relative">
          <button id="btn-gis-info-toggle" class="btn btn-secondary text-xs py-1 px-2.5 flex items-center gap-1.5 cursor-pointer" title="Data Integrity Notice">
            <i data-lucide="info" class="w-3.5 h-3.5 text-blue-600"></i>
            <span class="text-xs">Data Integrity Policy</span>
          </button>
          <div id="gis-info-popover" class="hidden absolute right-0 top-full mt-1.5 w-80 p-3.5 bg-white/95 backdrop-blur-md rounded-xl border border-slate-200 shadow-xl text-xs text-slate-600 z-50">
            <div class="flex items-center justify-between border-b border-slate-100 pb-1.5 mb-2">
              <span class="font-bold text-slate-800 flex items-center gap-1.5 text-[11px] uppercase tracking-wide">
                <i data-lucide="shield-check" class="w-3.5 h-3.5 text-blue-600"></i>
                Zero Coordinate Fabrication
              </span>
              <button id="btn-close-gis-info" class="text-slate-400 hover:text-slate-600 cursor-pointer text-base font-bold leading-none">&times;</button>
            </div>
            <p class="leading-relaxed text-[11px]">
              Markers represent <strong>state capitals</strong>, not individual project locations. MoSPI PAIMANA does not report per-project GPS coordinates, so PRISM aggregates and visualizes risk at the state level rather than fabricating project-level positions.
            </p>
          </div>
        </div>
      </div>

      <!-- Leaflet Map Container -->
      <div id="leaflet-map-container" class="relative w-full h-[500px] rounded-xl border border-slate-200 overflow-hidden select-none"></div>

      <!-- Map Legend -->
      <div class="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
        <div class="flex items-center gap-4 flex-wrap">
          <span class="font-bold text-slate-700 text-[11px] uppercase tracking-wider">Risk Concentration:</span>
          <div class="flex items-center gap-1.5">
            <span class="w-3 h-3 rounded-full bg-red-500 inline-block border border-white shadow-2xs"></span>
            <span class="text-[11px] text-slate-600 font-medium">Critical / High</span>
          </div>
          <div class="flex items-center gap-1.5">
            <span class="w-3 h-3 rounded-full bg-orange-500 inline-block border border-white shadow-2xs"></span>
            <span class="text-[11px] text-slate-600 font-medium">Elevated</span>
          </div>
          <div class="flex items-center gap-1.5">
            <span class="w-3 h-3 rounded-full bg-blue-500 inline-block border border-white shadow-2xs"></span>
            <span class="text-[11px] text-slate-600 font-medium">Moderate</span>
          </div>
          <div class="flex items-center gap-1.5">
            <span class="w-3 h-3 rounded-full bg-emerald-500 inline-block border border-white shadow-2xs"></span>
            <span class="text-[11px] text-slate-600 font-medium">Low / Healthy</span>
          </div>
        </div>
        <div class="text-[11px] text-slate-400">
          Marker radius scales with project density &bull; Click marker for state summary
        </div>
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
          <button id="btn-clear-state-drilldown" class="btn btn-secondary text-xs py-1 px-2.5 cursor-pointer">
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
                  <button class="btn btn-secondary py-0.5 px-2 text-[11px] btn-filter-state-projects cursor-pointer" data-state="${escapeHtml(s.state)}">
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
  initLeafletMap(stateRegistry);
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

  // Toggle data integrity popover
  const toggleBtn = document.getElementById('btn-gis-info-toggle');
  const popover = document.getElementById('gis-info-popover');
  const closeBtn = document.getElementById('btn-close-gis-info');

  toggleBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    popover?.classList.toggle('hidden');
  });

  closeBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    popover?.classList.add('hidden');
  });

  document.addEventListener('click', (e) => {
    if (popover && !popover.contains(e.target) && e.target !== toggleBtn) {
      popover.classList.add('hidden');
    }
  });

  document.querySelectorAll('.btn-filter-state-projects').forEach(btn => {
    btn.addEventListener('click', () => {
      const st = btn.getAttribute('data-state');
      if (st) {
        window.prismApp.filterByState(st);
      }
    });
  });
}
