/**
 * ============================================================================
 * PRISM — Main Application Controller
 * Initializes lifecycle, coordinates view routing, event bindings, and API sync.
 * ============================================================================
 */

import { state, subscribe, notify, DEMO_USER_ROLES, isDemoLoggedIn, clearDemoLogin, getDemoUser, getRoleScopedProjects, getRoleScopedSectorStats, getRoleScopedAlerts } from './state.js';
import { api } from './api.js';
import { renderIcons, escapeHtml } from './utils.js';
import { renderDashboard } from './dashboard.js';
import { initProjectsView, applyFiltersAndRender, populateFilterDropdowns } from './projects.js';
import { openProjectDetail } from './project-detail.js';
import { initCopilot, openCopilot, closeCopilot } from './copilot.js';
import { renderSectorAnalytics } from './analytics.js?v=portfolio-v2';
import { renderGISMap, invalidateMapSize } from './map.js';
import { initAlertsModal, openAlertsModal, renderRadarView } from './alerts.js';
import { initStandaloneInterventionLab } from './scenario.js';
import { initReports, openFlashReport } from './reports.js';
import { initStateDropdown, populateStateDropdown, setStateDropdownValue } from './state-dropdown.js';

// Expose public API methods for inline triggers
window.prismApp = {
  ...(window.prismApp || {}),
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
    updateRoleScopeUI();

    roleSelect.addEventListener('change', (e) => {
      const selected = DEMO_USER_ROLES.find(r => r.id === e.target.value);
      if (selected) {
        state.currentRole = selected;
        // When switching away from role-state, clear state.roleScopedState
        if (selected.id !== 'role-state') {
          state.roleScopedState = null;
          setStateDropdownValue(null);
        }
        localStorage.setItem('prism_demo_user', JSON.stringify({
          username: 'demo_user',
          roleId: selected.id,
          roleName: selected.name,
          timestamp: Date.now()
        }));
        updateRoleScopeUI();

        // Scope projects directory filters
        if (selected.sectorFilter) {
          state.filters.sector = selected.sectorFilter;
          const secSelect = document.getElementById('filter-sector');
          if (secSelect) secSelect.value = selected.sectorFilter;
        } else {
          state.filters.sector = 'ALL';
          const secSelect = document.getElementById('filter-sector');
          if (secSelect) secSelect.value = 'ALL';
        }
        state.pagination.page = 1;

        // Re-render views consistently according to role filter
        renderDashboard();
        applyFiltersAndRender();
        if (state.activeView === 'analytics') {
          renderSectorAnalytics();
        } else if (state.activeView === 'gis') {
          renderGISMap();
        }
      }
    });

    // Custom state dropdown initialization for Chief Secretary (State Task Force)
    initStateDropdown({
      onSelect: (val) => {
        state.roleScopedState = val || null;
        updateRoleScopeUI();

        // Re-render views consistently according to state filter
        renderDashboard();
        applyFiltersAndRender();
        if (state.activeView === 'analytics') {
          renderSectorAnalytics();
        } else if (state.activeView === 'gis') {
          renderGISMap();
        }
      }
    });

    // State selector fallback change listener
    const stateSelect = document.getElementById('user-state-select');
    stateSelect?.addEventListener('change', (e) => {
      state.roleScopedState = e.target.value || null;
      setStateDropdownValue(state.roleScopedState);
      updateRoleScopeUI();

      // Re-render views consistently according to state filter
      renderDashboard();
      applyFiltersAndRender();
      if (state.activeView === 'analytics') {
        renderSectorAnalytics();
      } else if (state.activeView === 'gis') {
        renderGISMap();
      }
    });

    document.getElementById('btn-reset-role-scope')?.addEventListener('click', () => {
      state.roleScopedState = null;
      setStateDropdownValue(null);
      const defaultRole = DEMO_USER_ROLES[0];
      roleSelect.value = defaultRole.id;
      roleSelect.dispatchEvent(new Event('change'));
    });
  }

  // 9. Simulated Session Sign Out (Desktop & Mobile Drawer)
  const handleSignOut = () => {
    clearDemoLogin();
    window.location.href = '/';
  };
  document.getElementById('btn-demo-signout')?.addEventListener('click', handleSignOut);
  document.getElementById('btn-mobile-drawer-signout')?.addEventListener('click', handleSignOut);

  // 10. Mobile Navigation & Drawer Handlers
  document.getElementById('btn-mobile-profile')?.addEventListener('click', openMobileSidebar);

  // Mobile Bottom Navigation Bar (Screens 3-9)
  document.querySelectorAll('#mobile-bottom-nav .mobile-nav-tab').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const view = btn.getAttribute('data-view');
      if (view === 'copilot') {
        openCopilot();
      } else if (view) {
        switchView(view);
      }
    });
  });

  // Mobile Back Buttons
  document.querySelectorAll('.btn-mobile-back').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const target = btn.getAttribute('data-back') || 'dashboard';
      switchView(target);
    });
  });

  // Event Delegation for Mobile Quick Actions, Details, and Back buttons
  document.addEventListener('click', (e) => {
    // 1. Mobile Quick Actions (.quick-action-card, [data-quick-action])
    const quickCard = e.target.closest('.quick-action-card, [data-quick-action]');
    if (quickCard) {
      e.preventDefault();
      const action = quickCard.getAttribute('data-quick-action') || quickCard.getAttribute('data-action');
      if (action) {
        switchView(action);
      }
      return;
    }

    // 2. Mobile Donut Details button (.btn-goto-analytics-mobile)
    const detailsBtn = e.target.closest('.btn-goto-analytics-mobile');
    if (detailsBtn) {
      e.preventDefault();
      switchView('analytics');
      return;
    }

    // 3. Mobile Back button fallback delegation
    const backBtn = e.target.closest('.btn-mobile-back');
    if (backBtn) {
      e.preventDefault();
      const target = backBtn.getAttribute('data-back') || 'dashboard';
      switchView(target);
      return;
    }
  });

  // Mobile Role Switcher in Drawer
  const mobileRoleSelect = document.getElementById('mobile-role-select');
  if (mobileRoleSelect) {
    mobileRoleSelect.innerHTML = DEMO_USER_ROLES.map(r => `
      <option value="${r.id}">${r.name} (${r.accessLevel})</option>
    `).join('');

    if (state.currentRole && state.currentRole.id) {
      mobileRoleSelect.value = state.currentRole.id;
    }

    mobileRoleSelect.addEventListener('change', (e) => {
      const selected = DEMO_USER_ROLES.find(r => r.id === e.target.value);
      if (selected && roleSelect) {
        roleSelect.value = selected.id;
        roleSelect.dispatchEvent(new Event('change'));
      }
    });
  }

  // 11. Back to Home Orientation Navigation (Brand wordmark & dedicated nav button)
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
    analytics: 'Sector Analytics',
    radar: 'Early Warnings',
    intervention: 'Intervention Lab'
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

  // Update mobile bottom nav tab active states
  document.querySelectorAll('#mobile-bottom-nav .mobile-nav-tab').forEach(tab => {
    const isCurrent = tab.getAttribute('data-view') === viewName;
    if (isCurrent) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
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
      setTimeout(() => {
        invalidateMapSize();
      }, 150);
    } else if (viewName === 'analytics') {
      renderSectorAnalytics();
    } else if (viewName === 'radar') {
      renderRadarView();
    } else if (viewName === 'intervention') {
      initStandaloneInterventionLab();
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

export function updateRoleScopeUI() {
  const indicator = document.getElementById('role-scope-indicator');
  const scopeText = document.getElementById('role-scope-text');
  const stateContainer = document.getElementById('user-state-container');
  const stateSelect = document.getElementById('user-state-select');
  const roleSector = state.currentRole?.sectorFilter;
  const roleState = state.roleScopedState;
  const isStateRole = state.currentRole?.id === 'role-state';

  // Toggle state dropdown container
  if (stateContainer) {
    if (isStateRole) {
      stateContainer.classList.remove('hidden');
      stateContainer.classList.add('inline-flex');
      renderIcons();
    } else {
      stateContainer.classList.add('hidden');
      stateContainer.classList.remove('inline-flex');
    }
  }

  if (stateSelect && isStateRole) {
    stateSelect.value = roleState || '';
  }
  setStateDropdownValue(roleState);

  if (roleSector) {
    if (indicator) {
      indicator.classList.remove('hidden');
      indicator.classList.add('inline-flex');
    }
    if (scopeText) scopeText.textContent = `${roleSector} only`;
  } else if (isStateRole && roleState) {
    if (indicator) {
      indicator.classList.remove('hidden');
      indicator.classList.add('inline-flex');
    }
    if (scopeText) scopeText.textContent = `${roleState} only`;
  } else {
    if (indicator) {
      indicator.classList.add('hidden');
      indicator.classList.remove('inline-flex');
    }
  }

  const roleLabel = document.getElementById('current-role-label');
  if (roleLabel && state.currentRole) {
    roleLabel.textContent = state.currentRole.department || '';
  }

  // Sync Mobile Role Select
  const mobileRoleSelect = document.getElementById('mobile-role-select');
  if (mobileRoleSelect && state.currentRole?.id) {
    mobileRoleSelect.value = state.currentRole.id;
  }

  // Update Mobile Profile Avatar Text (MO, RW, RT, FD, CS)
  const mobileAvatarText = document.getElementById('mobile-avatar-text');
  if (mobileAvatarText && state.currentRole) {
    const rid = state.currentRole.id;
    if (rid === 'role-mospi') mobileAvatarText.textContent = 'MO';
    else if (rid === 'role-railways') mobileAvatarText.textContent = 'RW';
    else if (rid === 'role-road') mobileAvatarText.textContent = 'RT';
    else if (rid === 'role-finance') mobileAvatarText.textContent = 'FD';
    else if (rid === 'role-state') mobileAvatarText.textContent = 'CS';
    else mobileAvatarText.textContent = 'PR';
  }
}

export function populateStateSelector() {
  populateStateDropdown(state.availableStates || [], state.roleScopedState);
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

    // Fallback if metadata arrays are empty
    if (!state.availableStates.length && state.allProjects.length) {
      state.availableStates = Array.from(new Set(state.allProjects.map(p => p.state).filter(Boolean))).sort();
    }
    if (!state.availableSectors.length && state.allProjects.length) {
      state.availableSectors = Array.from(new Set(state.allProjects.map(p => p.sector || p.derivedSector).filter(Boolean))).sort();
    }

    // Fix for broken filter dropdowns (Task 3): populate state & sector options once data is ready
    populateFilterDropdowns();
    populateStateSelector();

    // Role filtering initialization (Task 1): if initial role has a sector filter, apply it
    if (state.currentRole?.sectorFilter) {
      state.filters.sector = state.currentRole.sectorFilter;
      const secSelect = document.getElementById('filter-sector');
      if (secSelect) secSelect.value = state.currentRole.sectorFilter;
    }
    updateRoleScopeUI();

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
