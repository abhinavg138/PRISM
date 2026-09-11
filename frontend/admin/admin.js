/**
 * PRISM Admin Operations — Unified Client Controller & API Client
 */

export const adminApi = {
  async fetch(endpoint, options = {}) {
    try {
      const res = await fetch(endpoint, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        },
        ...options
      });

      if (res.status === 401) {
        if (!window.location.pathname.includes('/admin/login')) {
          window.location.href = '/admin/login';
        }
        throw new Error('Administrative session expired. Please log in.');
      }

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.detail || data.error || `HTTP ${res.status}`);
      }
      return data;
    } catch (err) {
      console.error(`[Admin API Error] ${endpoint}:`, err);
      throw err;
    }
  },

  login: (username, password) => adminApi.fetch('/api/admin/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password })
  }),

  logout: () => adminApi.fetch('/api/admin/auth/logout', {
    method: 'POST'
  }),

  getMe: () => adminApi.fetch('/api/admin/auth/me'),

  getOverview: () => adminApi.fetch('/api/admin/overview'),

  getProjects: (params = {}) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '' && v !== 'ALL') {
        qs.append(k, v);
      }
    }
    return adminApi.fetch(`/api/admin/projects?${qs.toString()}`);
  },

  getProject: (id) => adminApi.fetch(`/api/admin/projects/${encodeURIComponent(id)}`),

  createProject: (data) => adminApi.fetch('/api/admin/projects', {
    method: 'POST',
    body: JSON.stringify(data)
  }),

  updateProject: (id, data) => adminApi.fetch(`/api/admin/projects/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  }),

  archiveProject: (id, reason) => adminApi.fetch(`/api/admin/projects/${encodeURIComponent(id)}/archive`, {
    method: 'POST',
    body: JSON.stringify({ reason })
  }),

  unarchiveProject: (id, reason) => adminApi.fetch(`/api/admin/projects/${encodeURIComponent(id)}/unarchive`, {
    method: 'POST',
    body: JSON.stringify({ reason })
  }),

  getAuditLogs: (params = {}) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '' && v !== 'ALL') {
        qs.append(k, v);
      }
    }
    return adminApi.fetch(`/api/admin/audit-log?${qs.toString()}`);
  },

  getDataValidation: () => adminApi.fetch('/api/admin/data-validation'),

  getSystemInfo: () => adminApi.fetch('/api/admin/system')
};

export function showToast(message, type = 'success') {
  let toastContainer = document.getElementById('admin-toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'admin-toast-container';
    toastContainer.className = 'fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none';
    document.body.appendChild(toastContainer);
  }

  const toast = document.createElement('div');
  const bg = type === 'success' ? 'bg-emerald-700 text-white' : (type === 'error' ? 'bg-red-600 text-white' : 'bg-slate-800 text-white');
  toast.className = `${bg} px-4 py-3 rounded-xl shadow-lg text-xs font-medium flex items-center gap-2.5 pointer-events-auto transition-all transform translate-y-2 opacity-0`;
  toast.innerHTML = `
    <span>${escapeHtml(message)}</span>
    <button class="ml-2 text-white/70 hover:text-white" onclick="this.parentElement.remove()">✕</button>
  `;

  toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.classList.remove('translate-y-2', 'opacity-0');
  }, 10);

  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

export function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function formatCurrencyCr(val) {
  if (val == null || isNaN(val)) return '₹0 Cr';
  return `₹${Math.round(val).toLocaleString('en-IN')} Cr`;
}

export function formatPercent(val) {
  if (val == null || isNaN(val)) return '0%';
  return `${Number(val).toFixed(1)}%`;
}

export function getRiskBadge(tier, score) {
  const t = (tier || 'UNRATED').toUpperCase();
  let cls = 'badge-tier-low';
  if (t === 'CRITICAL') cls = 'badge-tier-critical';
  else if (t === 'HIGH') cls = 'badge-tier-high';
  else if (t === 'MODERATE') cls = 'badge-tier-moderate';

  const scoreText = score != null ? ` (${Math.round(score)})` : '';
  return `<span class="px-2 py-0.5 rounded-full text-[11px] font-bold ${cls}">${t}${scoreText}</span>`;
}

export function getPriorityBadge(tier, score) {
  const t = (tier || 'UNASSIGNED').toUpperCase();
  let cls = 'bg-emerald-50 text-emerald-700 border border-emerald-200';
  if (t === 'P1') cls = 'bg-red-50 text-red-700 border border-red-200';
  else if (t === 'P2') cls = 'bg-amber-50 text-amber-700 border border-amber-200';

  const scoreText = score != null ? ` (${Math.round(score)})` : '';
  return `<span class="px-2 py-0.5 rounded-md text-[11px] font-bold ${cls}">${t}${scoreText}</span>`;
}

export function getSourceBadge(recordType, isArchived) {
  if (isArchived) {
    return `<span class="px-2 py-0.5 rounded-md text-[10px] font-bold badge-source-archived">ARCHIVED</span>`;
  }
  const rt = (recordType || 'SOURCE').toUpperCase();
  if (rt === 'ADMIN_ADDED') {
    return `<span class="px-2 py-0.5 rounded-md text-[10px] font-bold badge-source-added">ADMIN ADDED</span>`;
  }
  if (rt === 'ADMIN_MODIFIED') {
    return `<span class="px-2 py-0.5 rounded-md text-[10px] font-bold badge-source-modified">MODIFIED</span>`;
  }
  return `<span class="px-2 py-0.5 rounded-md text-[10px] font-bold badge-source-source">PAIMANA</span>`;
}

export function renderNavbar(activeView) {
  const navEl = document.getElementById('admin-header-nav');
  if (!navEl) return;

  const links = [
    { id: 'overview', href: '/admin', label: 'Overview', icon: 'layout-dashboard' },
    { id: 'projects', href: '/admin/projects', label: 'Projects', icon: 'folder-kanban' },
    { id: 'validation', href: '/admin/validation', label: 'Data Validation', icon: 'shield-alert' },
    { id: 'audit', href: '/admin/audit', label: 'Audit Log', icon: 'history' },
    { id: 'system', href: '/admin/system', label: 'System', icon: 'server' }
  ];

  navEl.innerHTML = `
    <div class="flex items-center gap-1.5">
      ${links.map(l => `
        <a href="${l.href}" class="admin-nav-link ${l.id === activeView ? 'active' : ''}">
          <i data-lucide="${l.icon}" class="w-3.5 h-3.5"></i>
          <span>${l.label}</span>
        </a>
      `).join('')}
    </div>
  `;

  // Attach logout handler
  document.getElementById('btn-admin-logout')?.addEventListener('click', async (e) => {
    e.preventDefault();
    try {
      await adminApi.logout();
      window.location.href = '/admin/login';
    } catch (err) {
      window.location.href = '/admin/login';
    }
  });

  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}
