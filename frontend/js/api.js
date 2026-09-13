/**
 * ============================================================================
 * PRISM — API Client
 * Centralized REST API caller for Python/FastAPI backend endpoints.
 * Authoritative business logic, calculations, and data remain on the backend.
 * ============================================================================
 */

function getBaseUrl() {
  if (typeof window === 'undefined') return '';

  // 1. Explicit runtime configuration via global variable or meta tag
  if (window.__PRISM_API_BASE__ !== undefined) return window.__PRISM_API_BASE__;
  if (window.PRISM_API_URL !== undefined) return window.PRISM_API_URL;
  const metaApiBase = document.querySelector('meta[name="prism-api-base"]')?.getAttribute('content');
  if (metaApiBase) return metaApiBase;

  // 2. Local frontend dev server ports where static UI is served separately from backend
  const devPorts = ['3000', '5173', '8080', '4200'];
  if (devPorts.includes(window.location.port)) {
    return `http://${window.location.hostname || 'localhost'}:8000`;
  }

  // 3. Same-origin deployment (FastAPI serving frontend, custom port, reverse proxy, HTTPS)
  return '';
}

const BASE_URL = getBaseUrl();

async function fetchJson(endpoint, options = {}) {
  try {
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    });
    
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || errorData.detail || `Request failed with status ${res.status}`);
    }
    
    return await res.json();
  } catch (err) {
    console.error(`[PRISM API Error] ${endpoint}:`, err);
    throw err;
  }
}

export const api = {
  // Health & Metadata
  getHealth: () => fetchJson('/api/health'),
  getMetadata: () => fetchJson('/api/metadata'),

  // Projects
  getProjects: (params = {}) => {
    const searchParams = new URLSearchParams();
    if (params.sector && params.sector !== 'ALL') searchParams.append('sector', params.sector);
    if (params.state && params.state !== 'ALL') searchParams.append('state', params.state);
    if (params.riskTier && params.riskTier !== 'ALL') searchParams.append('riskTier', params.riskTier);
    if (params.search) searchParams.append('search', params.search);
    if (params.sortBy) searchParams.append('sortBy', params.sortBy);
    if (params.sortDirection) searchParams.append('sortDirection', params.sortDirection);
    
    const qs = searchParams.toString();
    return fetchJson(`/api/projects${qs ? `?${qs}` : ''}`);
  },

  getProjectById: (id) => fetchJson(`/api/projects/${encodeURIComponent(id)}`),
  getProjectBenchmark: (id) => fetchJson(`/api/projects/${encodeURIComponent(id)}/benchmark`),
  getProjectHistory: (id) => fetchJson(`/api/projects/${encodeURIComponent(id)}/history`),
  getProjectObservations: (id) => fetchJson(`/api/projects/${encodeURIComponent(id)}/observations`),
  getProjectRisk: (id) => fetchJson(`/api/projects/${encodeURIComponent(id)}/risk`),
  getProjectPriority: (id) => fetchJson(`/api/projects/${encodeURIComponent(id)}/priority`),

  // Priorities, Alerts, Sectors, Analytics
  getPriorities: (params = {}) => {
    const searchParams = new URLSearchParams();
    if (params.tier && params.tier !== 'ALL') searchParams.append('tier', params.tier);
    if (params.sector && params.sector !== 'ALL') searchParams.append('sector', params.sector);
    if (params.state && params.state !== 'ALL') searchParams.append('state', params.state);
    const qs = searchParams.toString();
    return fetchJson(`/api/priorities${qs ? `?${qs}` : ''}`);
  },

  getAlerts: () => fetchJson('/api/alerts'),
  getSectors: () => fetchJson('/api/sectors'),
  getAnalytics: () => fetchJson('/api/analytics'),

  // Scenario Simulation
  simulateScenario: (projectIdOrData, params = null) => {
    const payload = params !== null
      ? { projectId: projectIdOrData, params }
      : projectIdOrData;
    return fetchJson('/api/simulate', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  // AI Copilot
  askCopilot: (question, projectId = null, conversationHistory = []) => fetchJson('/api/copilot/chat', {
    method: 'POST',
    body: JSON.stringify({
      message: question,
      activeProjectId: projectId,
      projectId: projectId,
      project_id: projectId,
      conversationHistory
    })
  })
};
