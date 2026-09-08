/**
 * ============================================================================
 * PRISM — Dashboard Module
 * Renders KPIs, Sector Cards, Priority Action Queue, and Risk Tier Summaries.
 * ============================================================================
 */

import { state, notify } from './state.js';
import { formatCurrencyCr, formatPercent, getRiskBadgeHtml, getPriorityBadgeHtml, renderIcons, escapeHtml } from './utils.js';

export function renderDashboard() {
  renderKPIs();
  renderEarlyWarningWidget();
  renderSectorCards();
  renderPriorityQueue();
  renderPortfolioRiskInsights();
  renderIcons();
}

export function renderKPIs() {
  const container = document.getElementById('dashboard-kpis');
  if (!container) return;

  const projects = state.allProjects || [];
  const totalProjects = projects.length;
  
  let totalCost = 0;
  let totalExpenditure = 0;
  let criticalCount = 0;
  let highCount = 0;
  let p1Count = 0;
  let ratedCount = 0;
  let riskScoreSum = 0;

  for (const p of projects) {
    totalCost += (p.revisedCostCr || p.originalCostCr || 0);
    totalExpenditure += (p.cumulativeExpenditureCr || 0);
    if (p.riskTier === 'CRITICAL') criticalCount++;
    if (p.riskTier === 'HIGH') highCount++;
    if (p.priorityTier === 'P1') p1Count++;
    if (p.riskScore != null) {
      riskScoreSum += p.riskScore;
      ratedCount++;
    }
  }

  const avgRisk = ratedCount > 0 ? (riskScoreSum / ratedCount).toFixed(1) : '0';

  container.innerHTML = `
    <div class="card p-5 border-l-4 border-l-blue-600">
      <div class="flex items-center justify-between">
        <span class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Monitored Portfolio</span>
        <div class="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
          <i data-lucide="building-2" class="w-4 h-4"></i>
        </div>
      </div>
      <div class="mt-3 flex items-baseline gap-2">
        <span class="text-2xl font-bold text-slate-900">${totalProjects.toLocaleString()}</span>
        <span class="text-xs text-slate-500 font-medium">Major Infrastructure Projects</span>
      </div>
      <div class="mt-2 text-xs text-slate-500">
        Source: MoSPI PAIMANA (Apr–Jul 2026)
      </div>
    </div>

    <div class="card p-5 border-l-4 border-l-indigo-600">
      <div class="flex items-center justify-between">
        <span class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Portfolio Capital</span>
        <div class="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
          <i data-lucide="wallet" class="w-4 h-4"></i>
        </div>
      </div>
      <div class="mt-3 flex items-baseline gap-2">
        <span class="text-2xl font-bold text-slate-900">${formatCurrencyCr(totalCost)}</span>
        <span class="text-xs text-slate-500 font-medium">Sanctioned</span>
      </div>
      <div class="mt-2 text-xs text-slate-500">
        Cum. Outlay: ${formatCurrencyCr(totalExpenditure)}
      </div>
    </div>

    <div class="card p-5 border-l-4 border-l-red-500">
      <div class="flex items-center justify-between">
        <span class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Critical Risk Projects</span>
        <div class="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center text-red-600">
          <i data-lucide="shield-alert" class="w-4 h-4"></i>
        </div>
      </div>
      <div class="mt-3 flex items-baseline gap-2">
        <span class="text-2xl font-bold text-red-600">${criticalCount}</span>
        <span class="text-xs text-slate-500 font-medium">Risk Score &ge; 80 / 100</span>
      </div>
      <div class="mt-2 text-xs text-slate-500">
        High Risk: <strong class="text-orange-600 font-semibold">${highCount}</strong> projects
      </div>
    </div>

    <div class="card p-5 border-l-4 border-l-amber-500">
      <div class="flex items-center justify-between">
        <span class="text-xs font-semibold text-slate-500 uppercase tracking-wider">P1 Action Priority</span>
        <div class="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
          <i data-lucide="zap" class="w-4 h-4"></i>
        </div>
      </div>
      <div class="mt-3 flex items-baseline gap-2">
        <span class="text-2xl font-bold text-amber-600">${p1Count}</span>
        <span class="text-xs text-slate-500 font-medium">Immediate Interventions</span>
      </div>
      <div class="mt-2 text-xs text-slate-500">
        Avg Risk Score: <strong>${avgRisk}</strong> / 100
      </div>
    </div>
  `;
}

export function renderEarlyWarningWidget() {
  const container = document.getElementById('dashboard-alerts-widget');
  if (!container) return;

  const alerts = state.alerts || [];
  if (alerts.length === 0) {
    container.innerHTML = `
      <div class="card p-4 flex items-center justify-between bg-slate-50/50">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <i data-lucide="check-circle-2" class="w-4 h-4"></i>
          </div>
          <div>
            <div class="text-sm font-semibold text-slate-800">Early Warning Alerts Clear</div>
            <div class="text-xs text-slate-500">All monitored indicators within nominal baseline tolerances</div>
          </div>
        </div>
      </div>
    `;
    return;
  }

  const criticalAlerts = alerts.filter(a => a.severity === 'CRITICAL');
  const previewAlerts = alerts.slice(0, 3);

  container.innerHTML = `
    <div class="card p-4 bg-gradient-to-r from-red-50/40 via-orange-50/30 to-amber-50/20 border-red-200/80">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-red-100">
        <div class="flex items-center gap-2.5">
          <div class="w-7 h-7 rounded-lg bg-red-100 text-red-700 flex items-center justify-center">
            <i data-lucide="bell-ring" class="w-4 h-4 animate-pulse"></i>
          </div>
          <div>
            <span class="text-xs font-bold text-red-900 uppercase tracking-wider">Early Warning Radar Active</span>
            <span class="text-xs text-red-700 ml-2">(${alerts.length} Triggered | ${criticalAlerts.length} Critical)</span>
          </div>
        </div>
        <button id="btn-view-all-alerts" class="text-xs font-semibold text-red-700 hover:text-red-900 flex items-center gap-1 self-start sm:self-auto">
          View All Alerts <i data-lucide="arrow-right" class="w-3.5 h-3.5"></i>
        </button>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
        ${previewAlerts.map(a => `
          <div class="bg-white/90 p-3 rounded-lg border border-red-100 hover:border-red-300 transition-colors cursor-pointer alert-preview-card" data-project-id="${escapeHtml(a.projectId)}">
            <div class="flex items-center justify-between gap-2">
              <span class="badge ${a.severity === 'CRITICAL' ? 'badge-critical' : 'badge-high'} text-[10px]">${a.severity}</span>
              <span class="text-[11px] font-mono text-slate-400">${escapeHtml(a.projectId)}</span>
            </div>
            <div class="text-xs font-semibold text-slate-900 mt-1 line-clamp-1">${escapeHtml(a.projectName)}</div>
            <div class="text-[11px] text-slate-600 mt-1 line-clamp-2">${escapeHtml(a.message || a.reason)}</div>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  document.getElementById('btn-view-all-alerts')?.addEventListener('click', () => {
    notify('OPEN_ALERTS_MODAL');
  });

  container.querySelectorAll('.alert-preview-card').forEach(el => {
    el.addEventListener('click', () => {
      const pid = el.getAttribute('data-project-id');
      if (pid) notify('OPEN_PROJECT_DETAIL', pid);
    });
  });
}

export function renderSectorCards() {
  const container = document.getElementById('dashboard-sector-cards');
  if (!container) return;

  const stats = state.sectorStats || [];
  if (stats.length === 0) return;

  container.innerHTML = `
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      ${stats.slice(0, 4).map(sec => `
        <div class="card p-4 hover:border-blue-300 transition cursor-pointer sector-quick-filter" data-sector="${escapeHtml(sec.sector)}">
          <div class="flex items-center justify-between">
            <div class="text-xs font-bold text-slate-500 uppercase">${escapeHtml(sec.sector)}</div>
            <span class="badge ${sec.avgRiskScore >= 60 ? 'badge-high' : 'badge-moderate'} text-[11px]">Avg ${Math.round(sec.avgRiskScore)}</span>
          </div>
          <div class="mt-2 flex items-baseline justify-between">
            <span class="text-xl font-bold text-slate-900">${sec.projectCount} <span class="text-xs text-slate-400 font-normal">projects</span></span>
            <span class="text-xs font-semibold text-slate-600">${formatCurrencyCr(sec.totalCostCr)}</span>
          </div>
          <div class="mt-2 text-[11px] text-slate-500 flex justify-between">
            <span>Critical: <strong class="text-red-600">${sec.criticalCount || 0}</strong></span>
            <span>Avg Prog: <strong>${Math.round(sec.avgPhysicalProgress || 0)}%</strong></span>
          </div>
        </div>
      `).join('')}
    </div>
  `;

  container.querySelectorAll('.sector-quick-filter').forEach(el => {
    el.addEventListener('click', () => {
      const sec = el.getAttribute('data-sector');
      notify('FILTER_BY_SECTOR', sec);
    });
  });
}

export function renderPriorityQueue() {
  const container = document.getElementById('dashboard-priority-queue');
  if (!container) return;

  // Filter top projects by priorityScore DESC
  const topPriorities = [...(state.allProjects || [])]
    .sort((a, b) => ((b.priorityScore || 0) - (a.priorityScore || 0)) || ((b.riskScore || 0) - (a.riskScore || 0)))
    .slice(0, 5);

  container.innerHTML = `
    <div class="card p-5">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h3 class="text-base font-bold text-slate-900 flex items-center gap-2">
            <i data-lucide="zap" class="w-4 h-4 text-amber-500"></i>
            Executive Priority Action Queue (Top 5)
          </h3>
          <p class="text-xs text-slate-500 mt-0.5">Rank-ordered by deterministic Intervention Priority Score for immediate policy action</p>
        </div>
        <button id="btn-view-all-projects" class="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1">
          Full Directory <i data-lucide="chevron-right" class="w-3.5 h-3.5"></i>
        </button>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead>
            <tr class="border-b border-slate-200 text-xs font-semibold text-slate-500 bg-slate-50/75">
              <th class="py-2.5 px-3">Project</th>
              <th class="py-2.5 px-3">Sector & Agency</th>
              <th class="py-2.5 px-3">Priority Tier</th>
              <th class="py-2.5 px-3">Risk Assessment</th>
              <th class="py-2.5 px-3">Primary Concern</th>
              <th class="py-2.5 px-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            ${topPriorities.map(p => `
              <tr class="hover:bg-slate-50/80 transition-colors">
                <td class="py-3 px-3">
                  <div class="font-semibold text-slate-900">${escapeHtml(p.name)}</div>
                  <div class="text-xs font-mono text-slate-400">${escapeHtml(p.id)} | ${escapeHtml(p.state)}</div>
                </td>
                <td class="py-3 px-3 text-xs">
                  <div class="font-medium text-slate-700">${escapeHtml(p.sector)}</div>
                  <div class="text-slate-400">${escapeHtml(p.implementingAgency || p.ministry || 'N/A')}</div>
                </td>
                <td class="py-3 px-3">
                  ${getPriorityBadgeHtml(p.priorityTier, p.priorityScore)}
                </td>
                <td class="py-3 px-3">
                  ${getRiskBadgeHtml(p.riskTier, p.riskScore)}
                </td>
                <td class="py-3 px-3 text-xs text-slate-600 max-w-xs truncate">
                  ${escapeHtml(p.priorityReason || p.primaryRiskDriver || 'Progress stagnation / schedule pressure')}
                </td>
                <td class="py-3 px-3 text-right">
                  <button class="btn btn-secondary text-xs py-1 px-2.5 btn-open-detail" data-project-id="${escapeHtml(p.id)}">
                    Inspect
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  document.getElementById('btn-view-all-projects')?.addEventListener('click', () => {
    notify('NAVIGATE', 'projects');
  });

  container.querySelectorAll('.btn-open-detail').forEach(el => {
    el.addEventListener('click', () => {
      const pid = el.getAttribute('data-project-id');
      if (pid) notify('OPEN_PROJECT_DETAIL', pid);
    });
  });
}

export function renderPortfolioRiskInsights() {
  const container = document.getElementById('dashboard-risk-insights');
  if (!container) return;

  const projects = state.allProjects || [];
  const total = projects.length || 1;

  const counts = {
    CRITICAL: projects.filter(p => p.riskTier === 'CRITICAL').length,
    HIGH: projects.filter(p => p.riskTier === 'HIGH').length,
    MODERATE: projects.filter(p => p.riskTier === 'MODERATE').length,
    LOW: projects.filter(p => p.riskTier === 'LOW').length,
  };

  container.innerHTML = `
    <div class="card p-5">
      <h3 class="text-base font-bold text-slate-900 mb-3 flex items-center gap-2">
        <i data-lucide="shield-check" class="w-4 h-4 text-blue-600"></i>
        Portfolio Risk Classification
      </h3>
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div class="p-3 rounded-lg bg-red-50/60 border border-red-100">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-red-800">Critical (80–100)</span>
            <span class="badge badge-critical">${counts.CRITICAL}</span>
          </div>
          <div class="progress-bar-bg mt-2.5 bg-red-100">
            <div class="progress-bar-fill bg-red-500" style="width: ${(counts.CRITICAL / total * 100).toFixed(1)}%"></div>
          </div>
          <div class="text-[11px] text-red-600 mt-1.5 font-medium">${(counts.CRITICAL / total * 100).toFixed(1)}% of portfolio</div>
        </div>

        <div class="p-3 rounded-lg bg-orange-50/60 border border-orange-100">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-orange-800">High (60–79)</span>
            <span class="badge badge-high">${counts.HIGH}</span>
          </div>
          <div class="progress-bar-bg mt-2.5 bg-orange-100">
            <div class="progress-bar-fill bg-orange-500" style="width: ${(counts.HIGH / total * 100).toFixed(1)}%"></div>
          </div>
          <div class="text-[11px] text-orange-600 mt-1.5 font-medium">${(counts.HIGH / total * 100).toFixed(1)}% of portfolio</div>
        </div>

        <div class="p-3 rounded-lg bg-amber-50/60 border border-amber-100">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-amber-800">Moderate (40–59)</span>
            <span class="badge badge-moderate">${counts.MODERATE}</span>
          </div>
          <div class="progress-bar-bg mt-2.5 bg-amber-100">
            <div class="progress-bar-fill bg-amber-500" style="width: ${(counts.MODERATE / total * 100).toFixed(1)}%"></div>
          </div>
          <div class="text-[11px] text-amber-600 mt-1.5 font-medium">${(counts.MODERATE / total * 100).toFixed(1)}% of portfolio</div>
        </div>

        <div class="p-3 rounded-lg bg-emerald-50/60 border border-emerald-100">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-emerald-800">Low (0–39)</span>
            <span class="badge badge-low">${counts.LOW}</span>
          </div>
          <div class="progress-bar-bg mt-2.5 bg-emerald-100">
            <div class="progress-bar-fill bg-emerald-500" style="width: ${(counts.LOW / total * 100).toFixed(1)}%"></div>
          </div>
          <div class="text-[11px] text-emerald-600 mt-1.5 font-medium">${(counts.LOW / total * 100).toFixed(1)}% of portfolio</div>
        </div>
      </div>
    </div>
  `;
}
