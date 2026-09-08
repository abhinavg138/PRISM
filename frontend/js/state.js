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

export const state = {
  // Navigation
  activeView: 'dashboard', // 'dashboard' | 'projects' | 'gis' | 'analytics'
  currentRole: DEMO_USER_ROLES[0],

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
