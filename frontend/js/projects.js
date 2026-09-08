/**
 * ============================================================================
 * PRISM — Projects Directory Module
 * Filter controls, search, multi-column sorting, and paginated table.
 * ============================================================================
 */

import { state, notify } from './state.js';
import { api } from './api.js';
import { formatCurrencyCr, formatPercent, getRiskBadgeHtml, getPriorityBadgeHtml, renderIcons, escapeHtml } from './utils.js';

export function initProjectsView() {
  populateFilterDropdowns();
  bindFilterEvents();
}

export function populateFilterDropdowns() {
  const stateSelect = document.getElementById('filter-state');
  const sectorSelect = document.getElementById('filter-sector');
  const riskSelect = document.getElementById('filter-risk');

  if (stateSelect && state.availableStates) {
    const current = state.filters.state;
    stateSelect.innerHTML = `<option value="ALL">All States (${state.availableStates.length})</option>` +
      state.availableStates.map(s => `<option value="${escapeHtml(s)}" ${s === current ? 'selected' : ''}>${escapeHtml(s)}</option>`).join('');
  }

  if (sectorSelect && state.availableSectors) {
    const current = state.filters.sector;
    sectorSelect.innerHTML = `<option value="ALL">All Sectors (${state.availableSectors.length})</option>` +
      state.availableSectors.map(s => `<option value="${escapeHtml(s)}" ${s === current ? 'selected' : ''}>${escapeHtml(s)}</option>`).join('');
  }
}

export function bindFilterEvents() {
  const searchInput = document.getElementById('filter-search');
  const stateSelect = document.getElementById('filter-state');
  const sectorSelect = document.getElementById('filter-sector');
  const riskSelect = document.getElementById('filter-risk');
  const sortSelect = document.getElementById('filter-sort');
  const resetBtn = document.getElementById('btn-reset-filters');

  let debounceTimer = null;
  searchInput?.addEventListener('input', (e) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      state.filters.search = e.target.value.trim();
      state.pagination.page = 1;
      applyFiltersAndRender();
    }, 250);
  });

  stateSelect?.addEventListener('change', (e) => {
    state.filters.state = e.target.value;
    state.pagination.page = 1;
    applyFiltersAndRender();
  });

  sectorSelect?.addEventListener('change', (e) => {
    state.filters.sector = e.target.value;
    state.pagination.page = 1;
    applyFiltersAndRender();
  });

  riskSelect?.addEventListener('change', (e) => {
    state.filters.riskTier = e.target.value;
    state.pagination.page = 1;
    applyFiltersAndRender();
  });

  sortSelect?.addEventListener('change', (e) => {
    const val = e.target.value;
    if (val === 'riskScore-desc') {
      state.filters.sortBy = 'riskScore';
      state.filters.sortDirection = 'desc';
    } else if (val === 'riskScore-asc') {
      state.filters.sortBy = 'riskScore';
      state.filters.sortDirection = 'asc';
    } else if (val === 'priorityScore-desc') {
      state.filters.sortBy = 'priorityScore';
      state.filters.sortDirection = 'desc';
    } else if (val === 'cost-desc') {
      state.filters.sortBy = 'cost';
      state.filters.sortDirection = 'desc';
    } else if (val === 'delay-desc') {
      state.filters.sortBy = 'delay';
      state.filters.sortDirection = 'desc';
    } else {
      state.filters.sortBy = 'id';
      state.filters.sortDirection = 'asc';
    }
    state.pagination.page = 1;
    applyFiltersAndRender();
  });

  resetBtn?.addEventListener('click', () => {
    state.filters = {
      search: '',
      sector: 'ALL',
      state: 'ALL',
      riskTier: 'ALL',
      minCost: 0,
      maxCost: 200000,
      sortBy: 'id',
      sortDirection: 'asc'
    };
    if (searchInput) searchInput.value = '';
    if (stateSelect) stateSelect.value = 'ALL';
    if (sectorSelect) sectorSelect.value = 'ALL';
    if (riskSelect) riskSelect.value = 'ALL';
    if (sortSelect) sortSelect.value = 'id-asc';
    state.pagination.page = 1;
    applyFiltersAndRender();
  });
}

export function applyFiltersAndRender() {
  const all = state.allProjects || [];
  const { search, sector, state: filterState, riskTier, sortBy, sortDirection } = state.filters;

  let filtered = all.filter(p => {
    if (sector !== 'ALL' && p.sector !== sector && p.derivedSector !== sector) return false;
    if (filterState !== 'ALL' && p.state !== filterState) return false;
    if (riskTier !== 'ALL' && p.riskTier !== riskTier) return false;
    if (search) {
      const q = search.toLowerCase();
      const matchName = (p.name || '').toLowerCase().includes(q);
      const matchId = (p.id || '').toLowerCase().includes(q);
      const matchAgency = (p.implementingAgency || '').toLowerCase().includes(q);
      const matchState = (p.state || '').toLowerCase().includes(q);
      if (!matchName && !matchId && !matchAgency && !matchState) return false;
    }
    return true;
  });

  // Sorting
  filtered.sort((a, b) => {
    let diff = 0;
    if (sortBy === 'riskScore') {
      diff = (b.riskScore ?? -1) - (a.riskScore ?? -1);
    } else if (sortBy === 'priorityScore') {
      diff = (b.priorityScore ?? -1) - (a.priorityScore ?? -1);
    } else if (sortBy === 'cost') {
      diff = (b.revisedCostCr || b.originalCostCr || 0) - (a.revisedCostCr || a.originalCostCr || 0);
    } else if (sortBy === 'delay') {
      diff = (b.timeOverrunMonths || 0) - (a.timeOverrunMonths || 0);
    } else {
      diff = a.id.localeCompare(b.id);
    }
    if (sortDirection === 'asc') diff = -diff;
    if (diff !== 0) return diff;
    return a.id.localeCompare(b.id);
  });

  state.filteredProjects = filtered;
  renderProjectsTable();
}

export function renderProjectsTable() {
  const container = document.getElementById('projects-table-body');
  const countEl = document.getElementById('projects-matching-count');
  const paginationContainer = document.getElementById('projects-pagination');
  if (!container) return;

  const list = state.filteredProjects || [];
  if (countEl) countEl.textContent = `${list.length.toLocaleString()} matching projects`;

  const { page, pageSize } = state.pagination;
  const totalPages = Math.max(1, Math.ceil(list.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  state.pagination.page = currentPage;

  const startIdx = (currentPage - 1) * pageSize;
  const pageItems = list.slice(startIdx, startIdx + pageSize);

  if (pageItems.length === 0) {
    container.innerHTML = `
      <tr>
        <td colspan="7" class="py-12 text-center text-slate-500">
          <i data-lucide="folder-search" class="w-8 h-8 mx-auto mb-2 text-slate-400"></i>
          <div class="font-medium">No projects matched the selected filters.</div>
          <div class="text-xs text-slate-400 mt-1">Try resetting the state, sector, or risk tier filters.</div>
        </td>
      </tr>
    `;
    if (paginationContainer) paginationContainer.innerHTML = '';
    renderIcons();
    return;
  }

  container.innerHTML = pageItems.map(p => `
    <tr class="hover:bg-slate-50/80 transition-colors cursor-pointer project-row" data-project-id="${escapeHtml(p.id)}">
      <td class="py-3 px-4">
        <div class="font-semibold text-slate-900">${escapeHtml(p.name)}</div>
        <div class="text-xs font-mono text-slate-400 mt-0.5">ID: ${escapeHtml(p.id)}</div>
      </td>
      <td class="py-3 px-3 text-xs">
        <div class="font-medium text-slate-800">${escapeHtml(p.sector)}</div>
        <div class="text-slate-400">${escapeHtml(p.state)}</div>
      </td>
      <td class="py-3 px-3">
        ${getRiskBadgeHtml(p.riskTier, p.riskScore)}
      </td>
      <td class="py-3 px-3">
        ${getPriorityBadgeHtml(p.priorityTier, p.priorityScore)}
      </td>
      <td class="py-3 px-3 text-xs">
        <div class="font-semibold text-slate-800">${formatCurrencyCr(p.revisedCostCr || p.originalCostCr)}</div>
        <div class="text-slate-500">Exp: ${formatCurrencyCr(p.cumulativeExpenditureCr)}</div>
      </td>
      <td class="py-3 px-3">
        <div class="flex items-center gap-2">
          <div class="progress-bar-bg w-16 bg-slate-100">
            <div class="progress-bar-fill bg-blue-600" style="width: ${Math.min(100, Math.max(0, p.physicalProgressPercent || 0))}%"></div>
          </div>
          <span class="text-xs font-semibold text-slate-700">${formatPercent(p.physicalProgressPercent)}</span>
        </div>
      </td>
      <td class="py-3 px-4 text-right">
        <div class="flex items-center justify-end gap-1.5" onclick="event.stopPropagation()">
          <button class="btn btn-secondary py-1 px-2 text-xs btn-open-copilot" data-project-id="${escapeHtml(p.id)}" title="Ask AI Copilot">
            <i data-lucide="sparkles" class="w-3.5 h-3.5 text-indigo-600"></i>
          </button>
          <button class="btn btn-secondary py-1 px-2.5 text-xs btn-inspect-project" data-project-id="${escapeHtml(p.id)}">
            View
          </button>
        </div>
      </td>
    </tr>
  `).join('');

  // Row click
  container.querySelectorAll('.project-row').forEach(row => {
    row.addEventListener('click', () => {
      const pid = row.getAttribute('data-project-id');
      if (pid) notify('OPEN_PROJECT_DETAIL', pid);
    });
  });

  // Copilot button click
  container.querySelectorAll('.btn-open-copilot').forEach(btn => {
    btn.addEventListener('click', () => {
      const pid = btn.getAttribute('data-project-id');
      const proj = (state.allProjects || []).find(x => x.id === pid);
      if (proj) notify('OPEN_COPILOT_WITH_PROJECT', proj);
    });
  });

  // Inspect button click
  container.querySelectorAll('.btn-inspect-project').forEach(btn => {
    btn.addEventListener('click', () => {
      const pid = btn.getAttribute('data-project-id');
      if (pid) notify('OPEN_PROJECT_DETAIL', pid);
    });
  });

  // Render pagination
  if (paginationContainer) {
    paginationContainer.innerHTML = `
      <div class="flex items-center justify-between text-xs text-slate-600 py-3 px-4 border-t border-slate-200">
        <div>
          Showing <strong>${startIdx + 1}</strong> to <strong>${Math.min(startIdx + pageSize, list.length)}</strong> of <strong>${list.length.toLocaleString()}</strong> projects
        </div>
        <div class="flex items-center gap-1.5">
          <button id="btn-page-prev" class="btn btn-secondary py-1 px-2.5 text-xs" ${currentPage <= 1 ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>
            Previous
          </button>
          <span class="px-2 font-medium">Page ${currentPage} of ${totalPages}</span>
          <button id="btn-page-next" class="btn btn-secondary py-1 px-2.5 text-xs" ${currentPage >= totalPages ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>
            Next
          </button>
        </div>
      </div>
    `;

    document.getElementById('btn-page-prev')?.addEventListener('click', () => {
      if (state.pagination.page > 1) {
        state.pagination.page--;
        renderProjectsTable();
      }
    });

    document.getElementById('btn-page-next')?.addEventListener('click', () => {
      if (state.pagination.page < totalPages) {
        state.pagination.page++;
        renderProjectsTable();
      }
    });
  }

  renderIcons();
}
