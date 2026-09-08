/**
 * ============================================================================
 * PRISM — Main Application Controller
 * Initializes lifecycle, coordinates view routing, event bindings, and API sync.
 * ============================================================================
 */

import { state, subscribe, notify, DEMO_USER_ROLES } from './state.js';
import { api } from './api.js';
import { renderIcons } from './utils.js';
import { renderDashboard } from './dashboard.js';
import { initProjectsView, applyFiltersAndRender } from './projects.js';
import { openProjectDetail } from './project-detail.js';
import { initCopilot, openCopilot, closeCopilot } from './copilot.js';
import { renderSectorAnalytics } from './analytics.js';
import { renderGISMap } from './map.js';
import { initAlertsModal, openAlertsModal } from './alerts.js';
import { initReports, openFlashReport } from './reports.js';

// Expose public API methods for inline triggers
window.prismApp = {
  openProjectDetail,
  openCopilot
};

document.addEventListener('DOMContentLoaded', async () => {
  initNavbar();
  initSubscribers();
  initProjectsView();
  initCopilot();
  initAlertsModal();
  initReports();
  initGlobalModalHandlers();

  await loadInitialData();
});

function initNavbar() {
  // Navigation tabs
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      e.preventDefault();
      const view = tab.getAttribute('data-view');
      if (view) switchView(view);
    });
  });

  // Copilot drawer toggle
  document.getElementById('nav-btn-copilot')?.addEventListener('click', () => {
    openCopilot();
  });

  // Alerts modal toggle
  document.getElementById('nav-btn-alerts')?.addEventListener('click', () => {
    openAlertsModal();
  });

  // Flash report toggle
  document.getElementById('nav-btn-report')?.addEventListener('click', () => {
    openFlashReport();
  });

  // Data trust & provenance modal toggle
  document.getElementById('nav-btn-provenance')?.addEventListener('click', () => {
    openProvenanceModal();
  });
  document.getElementById('btn-close-provenance-modal')?.addEventListener('click', () => {
    document.getElementById('provenance-modal')?.classList.remove('active');
  });

  // Role selector
  const roleSelect = document.getElementById('user-role-select');
  if (roleSelect) {
    roleSelect.innerHTML = DEMO_USER_ROLES.map(r => `
      <option value="${r.id}">${r.name} (${r.accessLevel})</option>
    `).join('');

    roleSelect.addEventListener('change', (e) => {
      const selected = DEMO_USER_ROLES.find(r => r.id === e.target.value);
      if (selected) {
        state.currentRole = selected;
        const roleLabel = document.getElementById('current-role-label');
        if (roleLabel) roleLabel.textContent = selected.department;
      }
    });
  }
}

function switchView(viewName) {
  state.activeView = viewName;

  // Update tabs UI
  document.querySelectorAll('.nav-tab').forEach(tab => {
    const isCurrent = tab.getAttribute('data-view') === viewName;
    if (isCurrent) {
      tab.classList.add('bg-blue-50', 'text-blue-700', 'font-bold');
      tab.classList.remove('text-slate-600', 'font-medium');
    } else {
      tab.classList.remove('bg-blue-50', 'text-blue-700', 'font-bold');
      tab.classList.add('text-slate-600', 'font-medium');
    }
  });

  // Toggle view containers
  document.querySelectorAll('.view-section').forEach(sec => {
    sec.classList.remove('active');
  });

  const activeSection = document.getElementById(`view-${viewName}`);
  if (activeSection) {
    activeSection.classList.add('active');
  }

  // Trigger view renderers
  if (viewName === 'dashboard') {
    renderDashboard();
  } else if (viewName === 'projects') {
    applyFiltersAndRender();
  } else if (viewName === 'gis') {
    renderGISMap();
  } else if (viewName === 'analytics') {
    renderSectorAnalytics();
  }

  renderIcons();
}

function initSubscribers() {
  subscribe('NAVIGATE', (view) => switchView(view));
  subscribe('OPEN_PROJECT_DETAIL', (id) => openProjectDetail(id));
  subscribe('OPEN_COPILOT_WITH_PROJECT', (p) => openCopilot(p));
  subscribe('OPEN_ALERTS_MODAL', () => openAlertsModal());
  subscribe('FILTER_BY_SECTOR', (sector) => {
    state.filters.sector = sector;
    const sectorSelect = document.getElementById('filter-sector');
    if (sectorSelect) sectorSelect.value = sector;
    switchView('projects');
  });
}

function initGlobalModalHandlers() {
  // ESC key to close all modals & drawers
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-backdrop.active, .drawer-backdrop.active').forEach(el => {
        el.classList.remove('active');
      });
    }
  });

  // Clicking backdrop outside modal container closes it
  document.querySelectorAll('.modal-backdrop').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.remove('active');
      }
    });
  });

  // Close buttons inside modals
  document.querySelectorAll('.modal-close-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const modal = btn.closest('.modal-backdrop');
      if (modal) modal.classList.remove('active');
    });
  });
}

async function loadInitialData() {
  const loadingBanner = document.getElementById('app-loading-banner');
  if (loadingBanner) loadingBanner.style.display = 'flex';

  try {
    // 1. Metadata
    try {
      const meta = await api.getMetadata();
      state.availableStates = meta.states || [];
      state.availableSectors = meta.sectors || [];
      state.dataSource = meta.dataSource || 'PAIMANA';
    } catch (e) {
      console.warn('Metadata load failed:', e);
    }

    // 2. All Projects (for Dashboard & Analytics)
    try {
      const projData = await api.getProjects();
      state.allProjects = projData.projects || [];
      state.filteredProjects = state.allProjects;
    } catch (e) {
      console.warn('Projects load failed:', e);
    }

    // 3. Sectors stats
    try {
      const secData = await api.getSectors();
      state.sectorStats = secData.sectors || [];
    } catch (e) {
      console.warn('Sector stats load failed:', e);
    }

    // 4. Alerts
    try {
      const alertData = await api.getAlerts();
      state.alerts = alertData.alerts || [];
      const badge = document.getElementById('nav-alerts-badge');
      if (badge && state.alerts.length > 0) {
        badge.textContent = state.alerts.length;
        badge.classList.remove('hidden');
      }
    } catch (e) {
      console.warn('Alerts load failed:', e);
    }

    // Initialize initial active view
    switchView('dashboard');
  } catch (err) {
    console.error('Initial data initialization error:', err);
  } finally {
    if (loadingBanner) loadingBanner.style.display = 'none';
  }
}

export function openProvenanceModal() {
  const modal = document.getElementById('provenance-modal');
  if (modal) modal.classList.add('active');
}
