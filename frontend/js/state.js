/**
 * ============================================================================
 * PRISM — Application State
 * Centralized state store and subscriber dispatcher.
 * ============================================================================
 */

export const DEMO_USER_ROLES = [
  { id: 'role-mospi', name: 'MoSPI National Oversight', department: 'Infrastructure Monitoring Division', accessLevel: 'Executive' },
  { id: 'role-railways', name: 'Ministry of Railways (MoR)', department: 'Projects & Planning Wing', accessLevel: 'Ministry' },
  { id: 'role-road', name: 'MoRTH / NHAI', department: 'Highway Operations & EPC Contracts', accessLevel: 'Agency' },
  { id: 'role-finance', name: 'Ministry of Finance (DEA)', department: 'Public Investment Board', accessLevel: 'Financial' },
  { id: 'role-state', name: 'Chief Secretary (State Task Force)', department: 'State Infrastructure Coordination', accessLevel: 'State' }
];

// Retrieve any previously saved demo session
function getInitialRole() {
  try {
    const raw = localStorage.getItem('prism_demo_user');
    if (raw) {
      const data = JSON.parse(raw);
      if (data.roleId) {
        const found = DEMO_USER_ROLES.find(r => r.id === data.roleId);
        if (found) return found;
      }
    }
  } catch (e) {
    // Ignore storage parse error
  }
  return DEMO_USER_ROLES[0];
}

export const state = {
  // Navigation
  activeView: 'dashboard', // 'dashboard' | 'projects' | 'gis' | 'analytics'
  currentRole: getInitialRole(),

  // Datasets
  allProjects: [],
  filteredProjects: [],
  dataSource: 'PAIMANA',
  availableStates: [],
  availableSectors: [],
  sectorStats: [],
  alerts: [],

  // UI Selection & Modals
  selectedProject: null,
  copilotProject: null,
  isCopilotOpen: false,
  isReportOpen: false,
  isAlertsModalOpen: false,

  // Table Filters & Pagination
  filters: {
    search: '',
    sector: 'ALL',
    state: 'ALL',
    riskTier: 'ALL',
    minCost: 0,
    maxCost: 200000,
    sortBy: 'id',
    sortDirection: 'asc'
  },
  pagination: {
    page: 1,
    pageSize: 15
  },

  // Loading flags
  isLoadingProjects: false,
  isLoadingSectors: false,

  // Copilot Chat History
  copilotMessages: []
};

// Simple event listener / subscription system
const listeners = new Map();

export function subscribe(event, callback) {
  if (!listeners.has(event)) {
    listeners.set(event, new Set());
  }
  listeners.get(event).add(callback);
  return () => listeners.get(event).delete(callback);
}

export function notify(event, payload) {
  if (listeners.has(event)) {
    for (const callback of listeners.get(event)) {
      try {
        callback(payload);
      } catch (err) {
        console.error(`Error in subscriber for ${event}:`, err);
      }
    }
  }
}

/**
 * Demo Session Management Helpers
 */
export function isDemoLoggedIn() {
  return localStorage.getItem('prism_logged_in') === 'true';
}

export function getDemoUser() {
  try {
    const raw = localStorage.getItem('prism_demo_user');
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export function setDemoLogin(username, roleId) {
  const role = DEMO_USER_ROLES.find(r => r.id === roleId) || DEMO_USER_ROLES[0];
  state.currentRole = role;
  localStorage.setItem('prism_logged_in', 'true');
  localStorage.setItem('prism_demo_user', JSON.stringify({
    username: username || 'demo_user',
    roleId: role.id,
    roleName: role.name,
    timestamp: Date.now()
  }));
}

export function clearDemoLogin() {
  localStorage.removeItem('prism_logged_in');
  localStorage.removeItem('prism_demo_user');
}

