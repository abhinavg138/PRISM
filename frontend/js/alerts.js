/**
 * ============================================================================
 * PRISM — Early Warning Radar / Alerts Module
 * Proactive detection of progress stagnation, cost escalation & schedule compression.
 * ============================================================================
 */

import { state, notify } from './state.js';
import { renderIcons, escapeHtml } from './utils.js';

let activeSeverityFilter = 'ALL';

export function initAlertsModal() {
  const modal = document.getElementById('alerts-modal');
  const closeBtn = document.getElementById('btn-close-alerts-modal');

  closeBtn?.addEventListener('click', () => {
    modal?.classList.remove('active');
  });

  document.querySelectorAll('.alert-filter-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.alert-filter-btn').forEach(b => b.classList.remove('active', 'bg-blue-600', 'text-white'));
      btn.classList.add('active', 'bg-blue-600', 'text-white');
      activeSeverityFilter = btn.getAttribute('data-severity');
      renderAlertsList();
    });
  });
}

export function openAlertsModal() {
  const modal = document.getElementById('alerts-modal');
  if (!modal) return;
  modal.classList.add('active');
  renderAlertsList();
}

export function renderAlertsList() {
  const container = document.getElementById('alerts-list-container');
  const countEl = document.getElementById('alerts-total-count');
  if (!container) return;

  const alerts = state.alerts || [];
  const filtered = activeSeverityFilter === 'ALL'
    ? alerts
    : alerts.filter(a => a.severity === activeSeverityFilter);

  if (countEl) countEl.textContent = `${filtered.length} Active Radar Alerts`;

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="py-12 text-center text-slate-500">
        <i data-lucide="check-circle-2" class="w-8 h-8 mx-auto mb-2 text-emerald-500"></i>
        <div class="font-bold">No active alerts for the selected criteria</div>
        <div class="text-xs text-slate-400 mt-1">All monitored parameters are within acceptable tolerance envelopes.</div>
      </div>
    `;
    renderIcons();
    return;
  }

  container.innerHTML = filtered.map(a => {
    let badgeClass = 'badge-moderate';
    if (a.severity === 'CRITICAL') badgeClass = 'badge-critical';
    else if (a.severity === 'HIGH') badgeClass = 'badge-high';

    return `
      <div class="p-3.5 rounded-lg border border-slate-200 bg-white hover:border-blue-300 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 alert-item-card" data-project-id="${escapeHtml(a.projectId)}">
        <div class="flex-1">
          <div class="flex items-center gap-2 mb-1">
            <span class="badge ${badgeClass} text-[10px]">${a.severity}</span>
            <span class="text-xs font-bold text-slate-500 uppercase tracking-wider">${escapeHtml(a.alertType || a.category || 'Early Warning')}</span>
            <span class="text-xs font-mono text-slate-400">ID: ${escapeHtml(a.projectId)}</span>
          </div>
          <div class="font-semibold text-slate-900 text-sm">${escapeHtml(a.projectName)}</div>
          <div class="text-xs text-slate-600 mt-1">${escapeHtml(a.message || a.reason || a.description)}</div>
          <div class="flex items-center gap-3 text-[11px] text-slate-400 mt-2">
            <span>Sector: <strong class="text-slate-600">${escapeHtml(a.sector || 'N/A')}</strong></span>
            <span>State: <strong class="text-slate-600">${escapeHtml(a.state || 'N/A')}</strong></span>
          </div>
        </div>
        <div class="flex sm:flex-col items-end justify-between gap-2 shrink-0">
          <button class="btn btn-secondary text-xs py-1 px-3 btn-inspect-alert-project" data-project-id="${escapeHtml(a.projectId)}">
            Inspect Project
          </button>
        </div>
      </div>
    `;
  }).join('');

  renderIcons();

  container.querySelectorAll('.btn-inspect-alert-project, .alert-item-card').forEach(el => {
    el.addEventListener('click', (e) => {
      const pid = el.getAttribute('data-project-id');
      if (pid) {
        document.getElementById('alerts-modal')?.classList.remove('active');
        notify('OPEN_PROJECT_DETAIL', pid);
      }
    });
  });
}
