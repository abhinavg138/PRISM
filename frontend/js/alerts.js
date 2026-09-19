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

let activeRadarSeverity = 'ALL';

export function renderRadarView() {
  const container = document.getElementById('radar-feed-container');
  if (!container) return;

  // Bind radar filter chips if not already bound
  const chips = document.querySelectorAll('.radar-filter-btn');
  chips.forEach(chip => {
    if (!chip.dataset.bound) {
      chip.dataset.bound = 'true';
      chip.addEventListener('click', () => {
        chips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        activeRadarSeverity = chip.getAttribute('data-severity') || 'ALL';
        renderRadarView();
      });
    }
  });

  const alerts = state.alerts || [];
  const filtered = activeRadarSeverity === 'ALL'
    ? alerts
    : alerts.filter(a => a.severity === activeRadarSeverity);

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="py-12 text-center text-slate-500 bg-white rounded-xl border border-slate-200">
        <i data-lucide="check-circle-2" class="w-8 h-8 mx-auto mb-2 text-emerald-500"></i>
        <div class="font-bold text-slate-800">No active alerts for this severity</div>
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
      <div class="radar-warning-card p-4 rounded-xl border border-slate-200 bg-white shadow-xs space-y-2.5 cursor-pointer hover:border-blue-300 transition-colors" data-project-id="${escapeHtml(a.projectId)}">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-1.5">
            <span class="badge ${badgeClass} text-[10px] font-bold">${a.severity}</span>
            <span class="font-mono text-[11px] font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
              ${escapeHtml(a.projectId)}
            </span>
          </div>
          <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            ${escapeHtml(a.alertType || a.category || 'Early Warning')}
          </span>
        </div>
        <div>
          <h3 class="text-sm font-bold text-slate-900 leading-snug">${escapeHtml(a.projectName)}</h3>
          <p class="text-xs text-slate-600 mt-1 leading-relaxed">${escapeHtml(a.message || a.reason || a.description)}</p>
        </div>
        <div class="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
          <div class="flex items-center gap-2">
            <span>Sector: <strong class="text-slate-700">${escapeHtml(a.sector || 'N/A')}</strong></span>
            <span>&bull;</span>
            <span>State: <strong class="text-slate-700">${escapeHtml(a.state || 'N/A')}</strong></span>
          </div>
          <span class="text-blue-600 font-semibold text-xs flex items-center gap-0.5">
            <span>Dossier</span>
            <i data-lucide="arrow-right" class="w-3 h-3"></i>
          </span>
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.radar-warning-card').forEach(card => {
    card.addEventListener('click', () => {
      const pid = card.getAttribute('data-project-id');
      if (pid) notify('OPEN_PROJECT_DETAIL', pid);
    });
  });

  renderIcons();
}

