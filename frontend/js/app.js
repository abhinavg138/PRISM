/**
 * ============================================================================
 * PRISM — Main Application Controller
 * Initializes lifecycle, coordinates view routing, event bindings, and API sync.
 * ============================================================================
 */

import { state, subscribe, notify, DEMO_USER_ROLES, isDemoLoggedIn, clearDemoLogin, getDemoUser } from './state.js';
import { api } from './api.js';
import { renderIcons } from './utils.js';
import { renderDashboard } from './dashboard.js';
import { initProjectsView, applyFiltersAndRender } from './projects.js';
import { openProjectDetail } from './project-detail.js';
import { initCopilot, openCopilot, closeCopilot } from './copilot.js';
import { renderSectorAnalytics } from './analytics.js?v=portfolio-v2';
import { renderGISMap } from './map.js';
import { initAlertsModal, openAlertsModal } from './alerts.js';
import { initReports, openFlashReport } from './reports.js';

// Expose public API methods for inline triggers
window.prismApp = {
  openProjectDetail,
  openCopilot
};

document.addEventListener('DOMContentLoaded', async () => {
  // Lightweight client-side gate for simulated demo portal
  if (!isDemoLoggedIn() && !window.location.search.includes('guest=true') && !window.location.search.includes('bypass_login=true')) {
    window.location.href = '/login';
    return;
  }

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
  // 1. Navigation items (supports .sidebar-nav-item and .nav-tab)
  document.querySelectorAll('.sidebar-nav-item, .nav-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      e.preventDefault();
      const view = tab.getAttribute('data-view');
      if (view) {
        switchView(view);
        closeMobileSidebar();
      }
    });
  });

  // 2. Sidebar Collapse / Expand Persistence & Toggle
  const collapseBtn = document.getElementById('sidebar-collapse-btn');
  const collapseIcon = document.getElementById('sidebar-collapse-icon');
  
  // Restore saved collapse state from localStorage
  const savedCollapsed = localStorage.getItem('prism_sidebar_collapsed') === 'true';
  if (savedCollapsed) {
    document.body.classList.add('sidebar-collapsed');
    if (collapseIcon) collapseIcon.setAttribute('data-lucide', 'panel-left-open');
  }

  function toggleSidebarCollapse() {
    const isCollapsed = document.body.classList.toggle('sidebar-collapsed');
    localStorage.setItem('prism_sidebar_collapsed', isCollapsed ? 'true' : 'false');
    if (collapseIcon) {
      collapseIcon.setAttribute('data-lucide', isCollapsed ? 'panel-left-open' : 'panel-left-close');
    }
    renderIcons();
  }

  collapseBtn?.addEventListener('click', toggleSidebarCollapse);

  // Keyboard shortcut Ctrl+B / Cmd+B for sidebar toggle
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
      e.preventDefault();
      toggleSidebarCollapse();
    }
  });

  // 3. Mobile Off-Canvas Drawer Toggles
  const hamburgerBtn = document.getElementById('btn-sidebar-hamburger');
  const mobileCloseBtn = document.getElementById('btn-sidebar-mobile-close');
  const backdrop = document.getElementById('sidebar-backdrop');
  const sidebar = document.getElementById('app-sidebar');

  function openMobileSidebar() {
    sidebar?.classList.add('open');
    backdrop?.classList.add('active');
  }

  function closeMobileSidebar() {
    sidebar?.classList.remove('open');
    backdrop?.classList.remove('active');
  }

  hamburgerBtn?.addEventListener('click', openMobileSidebar);
  mobileCloseBtn?.addEventListener('click', closeMobileSidebar);
  backdrop?.addEventListener('click', closeMobileSidebar);

  // 4. Copilot drawer toggle
  document.getElementById('nav-btn-copilot')?.addEventListener('click', () => {
    closeMobileSidebar();
    openCopilot();
  });

  // 5. Alerts modal toggle
  document.getElementById('nav-btn-alerts')?.addEventListener('click', () => {
    closeMobileSidebar();
    openAlertsModal();
  });

  // 6. Flash report toggle
  document.getElementById('nav-btn-report')?.addEventListener('click', () => {
    closeMobileSidebar();
    openFlashReport();
  });

  // 7. Data trust & provenance modal toggle
  document.getElementById('nav-btn-provenance')?.addEventListener('click', () => {
    closeMobileSidebar();
    openProvenanceModal();
  });
  document.getElementById('btn-close-provenance-modal')?.addEventListener('click', () => {
    document.getElementById('provenance-modal')?.classList.remove('active');
  });

  // 8. Role selector & session identity
  const roleSelect = document.getElementById('user-role-select');
  if (roleSelect) {
    roleSelect.innerHTML = DEMO_USER_ROLES.map(r => `
      <option value="${r.id}">${r.name} (${r.accessLevel})</option>
    `).join('');

    if (state.currentRole && state.currentRole.id) {
      roleSelect.value = state.currentRole.id;
    }

    roleSelect.addEventListener('change', (e) => {
      const selected = DEMO_USER_ROLES.find(r => r.id === e.target.value);
      if (selected) {
        state.currentRole = selected;
        const roleLabel = document.getElementById('current-role-label');
        if (roleLabel) roleLabel.textContent = selected.department;
      }
    });
  }

  // 9. Simulated Session Sign Out
  document.getElementById('btn-demo-signout')?.addEventListener('click', () => {
    clearDemoLogin();
    window.location.href = '/';
  });

  // 10. Back to Home Orientation Navigation (Brand wordmark & dedicated nav button)
  function navigateToHome(e) {
    if (e) e.preventDefault();
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      window.location.href = '/home';
      return;
    }
    document.body.classList.add('page-navigating');
    setTimeout(() => {
      window.location.href = '/home';
    }, 180);
  }

  document.getElementById('sidebar-brand-home-link')?.addEventListener('click', navigateToHome);
  document.getElementById('nav-btn-home')?.addEventListener('click', navigateToHome);
}

function switchView(viewName) {
  state.activeView = viewName;

  // View title label mapping
  const viewTitles = {
    dashboard: 'Dashboard',
    projects: 'Projects Directory',
    gis: 'GIS Map & States',
    analytics: 'Sector Analytics'
  };

  const headerTitle = document.getElementById('header-view-title');
  if (headerTitle && viewTitles[viewName]) {
    headerTitle.textContent = viewTitles[viewName];
  }

  // Update tabs & sidebar navigation UI
  document.querySelectorAll('.sidebar-nav-item, .nav-tab').forEach(tab => {
    const isCurrent = tab.getAttribute('data-view') === viewName;
    if (isCurrent) {
      tab.classList.add('active', 'bg-blue-50', 'text-blue-700', 'font-bold');
      tab.classList.remove('text-slate-600', 'font-medium');
    } else {
      tab.classList.remove('active', 'bg-blue-50', 'text-blue-700', 'font-bold');
      tab.classList.add('text-slate-600', 'font-medium');
    }
  });

  const targetSection = document.getElementById(`view-${viewName}`);
  const currentActive = document.querySelector('.view-section.active');
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function activateTarget() {
    document.querySelectorAll('.view-section').forEach(sec => {
      sec.classList.remove('active', 'view-leaving', 'view-entering');
    });

    if (targetSection) {
      targetSection.classList.add('active');
      if (!prefersReducedMotion) {
        targetSection.classList.add('view-entering');
        setTimeout(() => {
          targetSection.classList.remove('view-entering');
        }, 180);
      }
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

  if (currentActive && currentActive !== targetSection && !prefersReducedMotion) {
    currentActive.classList.add('view-leaving');
    setTimeout(() => {
      activateTarget();
    }, 140);
  } else {
    activateTarget();
  }
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
  if (modal) {
    modal.classList.add('active');
    renderIcons();
  }
}
