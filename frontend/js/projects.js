/**
 * ============================================================================
 * PRISM — Projects Directory Module
 * Filter controls, search, multi-column sorting, and paginated table.
 * ============================================================================
 */

import { state, notify, getRoleScopedProjects } from './state.js';
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

  // Mobile Quick Filter Chips (Screen 4)
  const chips = document.querySelectorAll('.project-filter-chip');
  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      chips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      const risk = chip.getAttribute('data-risk') || 'ALL';
      state.filters.riskTier = risk;
      if (riskSelect) riskSelect.value = risk;
      state.pagination.page = 1;
      applyFiltersAndRender();
    });
  });

  resetBtn?.addEventListener('click', () => {
    const roleSector = state.currentRole?.sectorFilter;
    state.filters = {
      search: '',
      sector: roleSector || 'ALL',
      state: 'ALL',
      riskTier: 'ALL',
      minCost: 0,
      maxCost: 200000,
      sortBy: 'id',
      sortDirection: 'asc'
    };
    chips.forEach(c => {
      if (c.getAttribute('data-risk') === 'ALL') c.classList.add('active');
      else c.classList.remove('active');
    });
    if (searchInput) searchInput.value = '';
    if (stateSelect) stateSelect.value = 'ALL';
    if (sectorSelect) sectorSelect.value = roleSector || 'ALL';
    if (riskSelect) riskSelect.value = 'ALL';
    if (sortSelect) sortSelect.value = 'id-asc';
    state.pagination.page = 1;
    applyFiltersAndRender();
  });
}

export function applyFiltersAndRender() {
  const all = getRoleScopedProjects();
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
        <div class="text-slate-500" title="Cumulative Expenditure (₹ Cr)">Expenditure: ${formatCurrencyCr(p.cumulativeExpenditureCr)}</div>
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
          <button class="btn btn-secondary py-1 px-2 text-xs btn-open-copilot" data-project-id="${escapeHtml(p.id)}" title="Ask AI Copilot about this project" aria-label="Ask AI Copilot about project ${escapeHtml(p.id)}">
            <i data-lucide="sparkles" class="w-3.5 h-3.5 text-indigo-600"></i>
          </button>
          <button class="btn btn-secondary py-1 px-2.5 text-xs btn-inspect-project" data-project-id="${escapeHtml(p.id)}" title="View Project Dossier" aria-label="View dossier for project ${escapeHtml(p.id)}">
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

  // Render Mobile Projects Feed (Screen 4)
  renderMobileProjectsFeed(pageItems, list.length, currentPage, totalPages);

  renderIcons();
}

export function renderMobileProjectsFeed(pageItems, totalCount, currentPage, totalPages) {
  const container = document.getElementById('projects-mobile-feed');
  if (!container) return;

  if (pageItems.length === 0) {
    container.innerHTML = `
      <div class="card p-8 text-center text-slate-500">
        <i data-lucide="folder-search" class="w-8 h-8 mx-auto mb-2 text-slate-400"></i>
        <div class="font-bold text-slate-800">No matching projects found</div>
        <div class="text-xs text-slate-400 mt-1">Try selecting a different risk tier or resetting filters.</div>
      </div>
    `;
    renderIcons();
    return;
  }

  container.innerHTML = `
    <div class="space-y-3">
      ${pageItems.map(p => `
        <div class="mobile-project-card project-card-tap cursor-pointer p-4 rounded-xl border border-slate-200 bg-white shadow-xs hover:border-blue-300 transition-colors" data-project-id="${escapeHtml(p.id)}">
          <div class="flex items-center justify-between gap-2 mb-2">
            <div class="flex items-center gap-1.5 flex-wrap">
              <span class="font-mono text-[11px] font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                ${escapeHtml(p.code || p.id)}
              </span>
              ${getRiskBadgeHtml(p.riskTier, p.riskScore)}
            </div>
            ${getPriorityBadgeHtml(p.priorityTier, p.priorityScore)}
          </div>
          
          <h3 class="text-sm font-bold text-slate-900 leading-snug mb-1">
            ${escapeHtml(p.name)}
          </h3>
          
          <div class="text-[11px] text-slate-500 font-medium mb-3 flex items-center gap-1.5 flex-wrap">
            <span>${escapeHtml(p.sector)}</span>
            <span>&bull;</span>
            <span>${escapeHtml(p.state)}</span>
            ${p.implementingAgency ? `<span>&bull;</span><span>${escapeHtml(p.implementingAgency)}</span>` : ''}
          </div>

          <div class="space-y-1.5 bg-slate-50 p-2.5 rounded-lg border border-slate-100 mb-3">
            <div class="flex items-center justify-between text-xs">
              <span class="text-slate-500 font-medium">Physical Progress</span>
              <span class="font-bold text-slate-800">${formatPercent(p.physicalProgressPercent)}</span>
            </div>
            <div class="progress-bar-bg bg-slate-200 w-full h-2 rounded-full overflow-hidden">
              <div class="progress-bar-fill bg-blue-600 h-full rounded-full" style="width: ${Math.min(100, Math.max(0, p.physicalProgressPercent || 0))}%"></div>
            </div>
            <div class="flex items-center justify-between text-[11px] text-slate-500 pt-1">
              <span>Outlay: <strong class="text-slate-700">${formatCurrencyCr(p.revisedCostCr || p.originalCostCr)}</strong></span>
              <span>Exp: <strong class="text-slate-700">${formatCurrencyCr(p.cumulativeExpenditureCr)}</strong></span>
            </div>
          </div>

          <div class="flex items-center justify-between gap-2 pt-1 border-t border-slate-100" onclick="event.stopPropagation()">
            <button class="btn-mobile-copilot-card flex-1 py-2 px-3 rounded-lg text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/60 flex items-center justify-center gap-1.5 cursor-pointer min-h-[44px]" data-project-id="${escapeHtml(p.id)}">
              <i data-lucide="sparkles" class="w-3.5 h-3.5 text-indigo-600"></i>
              <span>Ask Copilot</span>
            </button>
            <button class="btn-mobile-view-card flex-1 py-2 px-3 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 flex items-center justify-center gap-1.5 cursor-pointer shadow-xs min-h-[44px]" data-project-id="${escapeHtml(p.id)}">
              <span>View Dossier</span>
              <i data-lucide="arrow-right" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        </div>
      `).join('')}

      <!-- Mobile Pagination -->
      <div class="flex items-center justify-between text-xs text-slate-600 py-3 px-2">
        <button id="btn-mobile-page-prev" class="btn btn-secondary py-1.5 px-3 text-xs min-h-[44px] flex items-center justify-center" ${currentPage <= 1 ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>
          Previous
        </button>
        <span class="font-medium text-slate-700">Page ${currentPage} of ${totalPages}</span>
        <button id="btn-mobile-page-next" class="btn btn-secondary py-1.5 px-3 text-xs min-h-[44px] flex items-center justify-center" ${currentPage >= totalPages ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>
          Next
        </button>
      </div>
    </div>
  `;

  // Bind Card taps
  container.querySelectorAll('.mobile-project-card').forEach(card => {
    card.addEventListener('click', () => {
      const pid = card.getAttribute('data-project-id');
      if (pid) notify('OPEN_PROJECT_DETAIL', pid);
    });
  });

  // Bind View Dossier buttons
  container.querySelectorAll('.btn-mobile-view-card').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const pid = btn.getAttribute('data-project-id');
      if (pid) notify('OPEN_PROJECT_DETAIL', pid);
    });
  });

  // Bind Ask Copilot buttons
  container.querySelectorAll('.btn-mobile-copilot-card').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const pid = btn.getAttribute('data-project-id');
      const proj = (state.allProjects || []).find(x => x.id === pid);
      if (proj) notify('OPEN_COPILOT_WITH_PROJECT', proj);
    });
  });

  // Bind Mobile Pagination buttons
  document.getElementById('btn-mobile-page-prev')?.addEventListener('click', () => {
    if (state.pagination.page > 1) {
      state.pagination.page--;
      renderProjectsTable();
    }
  });

  document.getElementById('btn-mobile-page-next')?.addEventListener('click', () => {
    if (state.pagination.page < totalPages) {
      state.pagination.page++;
      renderProjectsTable();
    }
  });

  renderIcons();
}

