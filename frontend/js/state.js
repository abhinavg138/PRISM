/**
 * ============================================================================
 * PRISM — Application State
 * Centralized state store and subscriber dispatcher.
 * ============================================================================
 */

export const DEMO_USER_ROLES = [
  { id: 'role-mospi', name: 'MoSPI National Oversight', department: 'Infrastructure Monitoring Division', accessLevel: 'Executive', sectorFilter: null },
  { id: 'role-railways', name: 'Ministry of Railways (MoR)', department: 'Projects & Planning Wing', accessLevel: 'Ministry', sectorFilter: 'Railways' },
  { id: 'role-road', name: 'MoRTH / NHAI', department: 'Highway Operations & EPC Contracts', accessLevel: 'Agency', sectorFilter: 'Road Transport & Highways' },
  { id: 'role-finance', name: 'Ministry of Finance (DEA)', department: 'Public Investment Board', accessLevel: 'Financial', sectorFilter: null },
  // Known limitation: State Task Force persona is state-scoped; without a configured home state, defaults to portfolio oversight.
  { id: 'role-state', name: 'Chief Secretary (State Task Force)', department: 'State Infrastructure Coordination', accessLevel: 'State', sectorFilter: null }
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

/**
 * Returns projects scoped by the currently active role's sector or state oversight.
 */
export function getRoleScopedProjects() {
  let list = state.allProjects || [];
  const roleSector = state.currentRole?.sectorFilter;
  if (roleSector) {
    list = list.filter(p => p.sector === roleSector || p.derivedSector === roleSector);
  }
  const roleState = state.roleScopedState;
  if (roleState) {
    const s = roleState.trim().toLowerCase();
    list = list.filter(p => (p.state || '').trim().toLowerCase() === s);
  }
  return list;
}

/**
 * Returns sector stats scoped by the currently active role.
 */
export function getRoleScopedSectorStats() {
  const roleState = state.roleScopedState;
  const roleSector = state.currentRole?.sectorFilter;

  if (roleState) {
    const projs = getRoleScopedProjects();
    const sectorMap = new Map();
    for (const p of projs) {
      const sec = p.sector || p.derivedSector || 'Other';
      if (!sectorMap.has(sec)) {
        sectorMap.set(sec, { sector: sec, totalProjects: 0, totalBudgetCr: 0, scoredCount: 0, riskScoreSum: 0 });
      }
      const item = sectorMap.get(sec);
      item.totalProjects++;
      item.totalBudgetCr += (p.revisedCostCr || p.originalCostCr || 0);
      if (p.riskScore != null) {
        item.riskScoreSum += p.riskScore;
        item.scoredCount++;
      }
    }
    const result = [];
    for (const item of sectorMap.values()) {
      result.push({
        sector: item.sector,
        totalProjects: item.totalProjects,
        totalBudgetCr: item.totalBudgetCr,
        avgRiskScore: item.scoredCount > 0 ? Math.round(item.riskScoreSum / item.scoredCount) : 0
      });
    }
    return result;
  }

  if (roleSector) {
    return (state.sectorStats || []).filter(s => s.sector === roleSector || s.derivedSector === roleSector);
  }

  return state.sectorStats || [];
}

/**
 * Returns alerts scoped by the currently active role's projects.
 */
export function getRoleScopedAlerts() {
  const roleSector = state.currentRole?.sectorFilter;
  const roleState = state.roleScopedState;
  if (!roleSector && !roleState) return state.alerts || [];
  const scopedProjectIds = new Set(getRoleScopedProjects().map(p => p.id));
  return (state.alerts || []).filter(a => scopedProjectIds.has(a.projectId || a.id));
}

export const state = {
  // Navigation
  activeView: 'dashboard', // 'dashboard' | 'projects' | 'gis' | 'analytics'
  currentRole: getInitialRole(),
  roleScopedState: null, // Scoped state when role-state is active

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

