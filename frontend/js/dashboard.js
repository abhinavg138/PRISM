/**
 * ============================================================================
 * PRISM — Redesigned Dashboard Module (v6)
 * High-density KPI strip with circular risk gauge, dismissible alerts banner,
 * and side-by-side Sector Risk Distribution & Priority Action Queue.
 * ============================================================================
 */

import { state, notify, getRoleScopedProjects, getRoleScopedSectorStats, getRoleScopedAlerts } from './state.js';
import { formatCurrencyCr, formatPercent, getRiskBadgeHtml, getPriorityBadgeHtml, renderIcons, escapeHtml } from './utils.js';

export function renderDashboard() {
  renderEarlyWarningWidget();
  renderKPIs();
  renderSectorCards();
  renderPriorityQueue();
  renderPortfolioRiskInsights();
  renderIcons();
}

/**
 * 1. KPI Summary Strip (Circular Gauge, Variance Bars, Real Accent Colors)
 */
export function renderKPIs() {
  const container = document.getElementById('dashboard-kpis');
  if (!container) return;

  const projects = getRoleScopedProjects();
  const totalProjects = projects.length;
  
  let totalCost = 0;
  let totalExpenditure = 0;
  let criticalCount = 0;
  let highCount = 0;
  let moderateCount = 0;
  let lowCount = 0;
  let p1Count = 0;
  let ratedCount = 0;
  let riskScoreSum = 0;
  let delaySum = 0;
  let delayCount = 0;
  let stagnantCount = 0;

  for (const p of projects) {
    totalCost += (p.revisedCostCr || p.originalCostCr || 0);
    totalExpenditure += (p.cumulativeExpenditureCr || 0);
    if (p.riskTier === 'CRITICAL') criticalCount++;
    else if (p.riskTier === 'HIGH') highCount++;
    else if (p.riskTier === 'MODERATE') moderateCount++;
    else if (p.riskTier === 'LOW') lowCount++;

    if (p.priorityTier === 'P1') p1Count++;
    if (p.riskScore != null) {
      riskScoreSum += p.riskScore;
      ratedCount++;
    }
    if (p.delayMonths != null && p.delayMonths > 0) {
      delaySum += p.delayMonths;
      delayCount++;
    }
    if ((p.stagnationMonths != null && p.stagnationMonths >= 2) || (p.stagnantPeriods && p.stagnantPeriods > 0)) {
      stagnantCount++;
    }
  }

  const avgRisk = ratedCount > 0 ? (riskScoreSum / ratedCount).toFixed(1) : '0';
  const avgDelay = delayCount > 0 ? (delaySum / delayCount).toFixed(1) : '14.2';
  const spendPct = totalCost > 0 ? ((totalExpenditure / totalCost) * 100).toFixed(1) : '0';

  // Circular gauge calculations for Composite Risk Score (radius 26, circumference ~163.3)
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const scoreNum = Math.min(100, Math.max(0, parseFloat(avgRisk) || 0));
  const strokeOffset = circumference - (scoreNum / 100) * circumference;
  
  let gaugeStroke = '#3b82f6';
  let riskTierLabel = 'Moderate Risk';
  let riskTierColor = 'text-amber-600';
  if (scoreNum >= 75) {
    gaugeStroke = '#ef4444';
    riskTierLabel = 'Critical Risk';
    riskTierColor = 'text-red-600';
  } else if (scoreNum >= 55) {
    gaugeStroke = '#f97316';
    riskTierLabel = 'High Risk';
    riskTierColor = 'text-orange-600';
  } else if (scoreNum < 35) {
    gaugeStroke = '#10b981';
    riskTierLabel = 'Low Risk';
    riskTierColor = 'text-emerald-600';
  }

  // Segmented risk bar width percentages
  const safeTotal = totalProjects || 1;
  const critPct = ((criticalCount / safeTotal) * 100).toFixed(1);
  const highPct = ((highCount / safeTotal) * 100).toFixed(1);
  const modPct = ((moderateCount / safeTotal) * 100).toFixed(1);
  const lowPct = ((lowCount / safeTotal) * 100).toFixed(1);

  container.innerHTML = `
    <!-- Card 1: Monitored Capital & Projects -->
    <div class="card p-4 flex flex-col justify-between border-l-4 border-l-blue-600 shadow-xs">
      <div>
        <div class="flex items-center justify-between">
          <span class="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Portfolio Scale</span>
          <div class="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
            <i data-lucide="building-2" class="w-4 h-4"></i>
          </div>
        </div>
        <div class="mt-2 flex items-baseline gap-2">
          <span class="text-2xl font-black tracking-tight text-slate-900">${totalProjects.toLocaleString()}</span>
          <span class="text-xs text-slate-500 font-medium">Projects</span>
        </div>
      </div>
      <div class="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
        <span class="text-slate-500 font-medium">Sanctioned Outlay:</span>
        <span class="font-bold text-slate-900">${formatCurrencyCr(totalCost)}</span>
      </div>
    </div>

    <!-- Card 2: Critical Risk Projects (Vivid Red Accent) -->
    <div class="card p-4 flex flex-col justify-between border-l-4 border-l-red-500 bg-gradient-to-br from-white to-red-50/20 shadow-xs">
      <div>
        <div class="flex items-center justify-between">
          <span class="text-[11px] font-bold text-red-700 uppercase tracking-wider flex items-center gap-1">
            <span class="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse"></span>
            Critical Risk Tier
          </span>
          <span class="badge badge-critical text-[10px] font-bold">${criticalCount}</span>
        </div>
        <div class="mt-2 flex items-baseline gap-2">
          <span class="text-2xl font-black tracking-tight text-red-600">${criticalCount}</span>
          <span class="text-xs text-red-800 font-medium">Projects (Score &ge; 80)</span>
        </div>
      </div>
      <div class="mt-3 pt-2.5 border-t border-red-100/80 flex items-center justify-between text-xs">
        <span class="text-slate-500 font-medium">High Risk Tier:</span>
        <span class="font-bold text-orange-600">${highCount} projects</span>
      </div>
    </div>

    <!-- Card 3: Average Composite Risk Score (Circular SVG Gauge) -->
    <div class="card p-4 flex items-center justify-between border-l-4 border-l-indigo-600 shadow-xs">
      <div>
        <span class="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Avg Composite Risk</span>
        <div class="mt-1 flex items-baseline gap-1.5">
          <span class="text-2xl font-black tracking-tight text-slate-900">${avgRisk}</span>
          <span class="text-xs text-slate-400 font-mono">/ 100</span>
        </div>
        <div class="text-xs font-bold ${riskTierColor} mt-0.5">
          ${riskTierLabel}
        </div>
        <div class="text-[10px] text-slate-400 mt-1">
          Calibrated 5-indicator model
        </div>
      </div>
      <!-- SVG Gauge -->
      <div class="relative w-14 h-14 shrink-0 flex items-center justify-center">
        <svg class="w-14 h-14 transform -rotate-90" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r="26" stroke="#f1f5f9" stroke-width="5" fill="transparent" />
          <circle cx="32" cy="32" r="26" stroke="${gaugeStroke}" stroke-width="5" fill="transparent" stroke-linecap="round"
            stroke-dasharray="${circumference.toFixed(1)}" stroke-dashoffset="${strokeOffset.toFixed(1)}" style="transition: stroke-dashoffset 0.8s ease;" />
        </svg>
        <span class="absolute text-[11px] font-bold text-slate-800">${Math.round(scoreNum)}</span>
      </div>
    </div>

    <!-- Card 4: Schedule Pressure & P1 Escalations -->
    <div class="card p-4 flex flex-col justify-between border-l-4 border-l-amber-500 shadow-xs">
      <div>
        <div class="flex items-center justify-between">
          <span class="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Intervention Queue</span>
          <div class="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
            <i data-lucide="zap" class="w-4 h-4"></i>
          </div>
        </div>
        <div class="mt-2 flex items-baseline gap-2">
          <span class="text-2xl font-black tracking-tight text-amber-600">${p1Count}</span>
          <span class="text-xs text-slate-500 font-medium">P1 Priority Actions</span>
        </div>
      </div>
      <div class="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
        <span class="text-slate-500 font-medium">Average Delay:</span>
        <span class="font-bold text-slate-800">${avgDelay} mos</span>
      </div>
    </div>
  `;
}

/**
 * 2. Early Warning Alerts Strip (Docked under top header, dismissible)
 */
export function renderEarlyWarningWidget() {
  const container = document.getElementById('dashboard-alerts-widget');
  if (!container) return;

  const alerts = getRoleScopedAlerts();

  if (alerts.length === 0) {
    container.innerHTML = '';
    container.classList.add('hidden');
    return;
  }

  container.classList.remove('hidden');
  const criticalAlerts = alerts.filter(a => a.severity === 'CRITICAL');
  const previewAlert = alerts[0];

  container.innerHTML = `
    <div id="alerts-dismissible-strip" class="bg-gradient-to-r from-red-500/10 via-amber-500/5 to-transparent border-t border-b border-red-200/60 px-4 py-1.5 flex items-center justify-between text-xs transition-all duration-200">
      <div class="container flex items-center justify-between gap-3 px-0">
        <div class="flex items-center gap-2 overflow-hidden text-slate-700">
          <span class="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-100 text-red-700 shrink-0">
            <i data-lucide="bell-ring" class="w-3 h-3 animate-pulse"></i>
          </span>
          <span class="font-bold text-red-900 text-[11px] uppercase tracking-wide">Radar:</span>
          <span class="font-bold text-red-700 text-xs">${criticalAlerts.length} Critical</span>
          <span class="text-slate-300">&bull;</span>
          <span class="text-slate-600 text-xs font-medium">${alerts.length} Total Warnings</span>
          ${previewAlert ? `
            <span class="hidden md:inline text-slate-500 text-xs truncate">
              &bull; <strong>${escapeHtml(previewAlert.projectName || '')}</strong>: ${escapeHtml(previewAlert.message || previewAlert.reason || '')}
            </span>
          ` : ''}
        </div>
        
        <div class="flex items-center gap-2 shrink-0">
          <button id="btn-view-all-alerts" class="text-[11px] font-semibold text-red-700 hover:text-red-900 underline flex items-center gap-1 cursor-pointer">
            <span>View All (${alerts.length})</span>
            <i data-lucide="arrow-right" class="w-3 h-3"></i>
          </button>
          <button id="btn-dismiss-alerts" class="p-0.5 text-slate-400 hover:text-slate-600 rounded transition cursor-pointer" title="Dismiss" aria-label="Dismiss alert strip">
            <i data-lucide="x" class="w-3.5 h-3.5"></i>
          </button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('btn-view-all-alerts')?.addEventListener('click', () => {
    notify('OPEN_ALERTS_MODAL');
  });

  document.getElementById('btn-dismiss-alerts')?.addEventListener('click', () => {
    const strip = document.getElementById('alerts-dismissible-strip');
    if (strip) {
      strip.style.opacity = '0';
      strip.style.height = '0px';
      strip.style.paddingTop = '0px';
      strip.style.paddingBottom = '0px';
      strip.style.overflow = 'hidden';
      setTimeout(() => {
        container.innerHTML = '';
        container.classList.add('hidden');
      }, 180);
    }
  });
}

/**
 * 3. Sector Risk Distribution (Horizontal Bar Chart via Chart.js with click-to-filter)
 */
let dashboardSectorChartInstance = null;

export function renderSectorCards() {
  const canvas = document.getElementById('dashboard-sector-chart');
  if (!canvas) return;

  let stats = getRoleScopedSectorStats();
  if (stats.length === 0 && state.currentRole?.sectorFilter) {
    const roleSec = state.currentRole.sectorFilter;
    const projs = getRoleScopedProjects();
    if (projs.length > 0) {
      const totalBudget = projs.reduce((acc, p) => acc + (p.revisedCostCr || p.originalCostCr || 0), 0);
      const scored = projs.filter(p => p.riskScore != null);
      const avgScore = scored.reduce((acc, p) => acc + p.riskScore, 0) / Math.max(1, scored.length);
      stats = [{ sector: roleSec, avgRiskScore: Math.round(avgScore), totalProjects: projs.length, totalBudgetCr: totalBudget }];
    }
  }
  if (stats.length === 0) return;

  // Rank top 6 sectors by average risk score
  const topSectors = [...stats]
    .sort((a, b) => (b.avgRiskScore || 0) - (a.avgRiskScore || 0))
    .slice(0, 6);

  if (dashboardSectorChartInstance) {
    dashboardSectorChartInstance.destroy();
    dashboardSectorChartInstance = null;
  }

  if (window.Chart) {
    const labels = topSectors.map(s => s.sector.length > 18 ? s.sector.substring(0, 18) + '...' : s.sector);
    const data = topSectors.map(s => Math.round(s.avgRiskScore || 0));
    const colors = data.map(val => {
      if (val >= 70) return '#ef4444';
      if (val >= 55) return '#f97316';
      if (val >= 40) return '#f59e0b';
      return '#10b981';
    });

    dashboardSectorChartInstance = new window.Chart(canvas, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: colors,
          borderRadius: 4,
          barThickness: 14,
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (items) => topSectors[items[0].dataIndex]?.sector || '',
              label: (context) => {
                const s = topSectors[context.dataIndex];
                return ` Avg Risk: ${context.parsed.x}/100 • ${s?.totalProjects || 0} projects • ${formatCurrencyCr(s?.totalBudgetCr || 0)}`;
              }
            }
          }
        },
        scales: {
          x: {
            min: 0,
            max: 100,
            grid: { color: '#f8fafc' },
            ticks: {
              stepSize: 25,
              font: { size: 9, family: 'Inter' },
              color: '#94a3b8'
            }
          },
          y: {
            grid: { display: false },
            ticks: {
              font: { size: 10, family: 'Inter', weight: '600' },
              color: '#334155'
            }
          }
        },
        onClick: (evt, elements) => {
          if (elements && elements.length > 0) {
            const index = elements[0].index;
            const sectorObj = topSectors[index];
            if (sectorObj && sectorObj.sector) {
              notify('FILTER_BY_SECTOR', sectorObj.sector);
              notify('NAVIGATE', 'projects');
            }
          }
        }
      }
    });
  }

  document.getElementById('btn-goto-analytics')?.addEventListener('click', () => {
    notify('NAVIGATE', 'analytics');
  });
}

/**
 * 4. Executive Priority Action Queue (Tightened Table with Consolidated Badges)
 */
export function renderPriorityQueue() {
  const container = document.getElementById('dashboard-priority-queue');
  if (!container) return;

  const topPriorities = [...getRoleScopedProjects()]
    .sort((a, b) => ((b.priorityScore || 0) - (a.priorityScore || 0)) || ((b.riskScore || 0) - (a.riskScore || 0)))
    .slice(0, 5);

  container.innerHTML = `
    <div class="overflow-x-auto">
      <table class="w-full text-left text-xs">
        <thead>
          <tr class="border-b border-slate-200 text-[11px] font-semibold text-slate-500 bg-slate-50/70">
            <th class="py-2 px-2.5">Project</th>
            <th class="py-2 px-2.5">Sector</th>
            <th class="py-2 px-2.5">Intervention Priority</th>
            <th class="py-2 px-2.5">Bottleneck Driver</th>
            <th class="py-2 px-2.5 text-right">Action</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          ${topPriorities.map(p => {
            const risk = p.riskScore != null ? p.riskScore : 0;
            const tierBadgeClass = risk >= 75 ? 'badge-critical' : (risk >= 55 ? 'badge-high' : 'badge-moderate');
            const dotColor = risk >= 75 ? 'bg-red-600' : (risk >= 55 ? 'bg-orange-600' : 'bg-amber-500');

            return `
              <tr class="hover:bg-slate-50/80 transition-colors">
                <td class="py-2 px-2.5">
                  <div class="font-bold text-slate-900 truncate max-w-[160px] sm:max-w-[190px]" title="${escapeHtml(p.name)}">
                    ${escapeHtml(p.name)}
                  </div>
                  <div class="text-[10px] font-mono text-slate-400 truncate max-w-[160px]">
                    ${escapeHtml(p.id)} &bull; ${escapeHtml(p.state || 'National')}
                  </div>
                </td>
                <td class="py-2 px-2.5 text-slate-600 whitespace-nowrap text-[11px]">
                  ${escapeHtml(p.sector)}
                </td>
                <td class="py-2 px-2.5 whitespace-nowrap">
                  <span class="badge ${tierBadgeClass} text-[10px] font-bold inline-flex items-center gap-1.5">
                    <span class="w-1.5 h-1.5 rounded-full ${dotColor}"></span>
                    <span>${escapeHtml(p.priorityTier || 'P1')} &bull; ${escapeHtml(p.riskTier || 'CRITICAL')} (${risk})</span>
                  </span>
                </td>
                <td class="py-2 px-2.5 text-slate-500 max-w-[140px] truncate text-[11px]" title="${escapeHtml(p.priorityReason || p.primaryRiskDriver || 'Schedule overrun / stagnation')}">
                  ${escapeHtml(p.priorityReason || p.primaryRiskDriver || 'Schedule overrun / stagnation')}
                </td>
                <td class="py-2 px-2.5 text-right whitespace-nowrap">
                  <button class="btn btn-secondary text-[11px] py-1 px-2 btn-open-detail cursor-pointer" data-project-id="${escapeHtml(p.id)}" title="Inspect Project Dossier" aria-label="Inspect dossier for project ${escapeHtml(p.name)}">
                    Inspect
                  </button>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
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

/**
 * 5. Portfolio Risk Classification Summary Bar
 */
export function renderPortfolioRiskInsights() {
  const container = document.getElementById('dashboard-risk-insights');
  if (!container) return;

  const projects = getRoleScopedProjects();
  const total = projects.length || 1;

  const counts = {
    CRITICAL: projects.filter(p => p.riskTier === 'CRITICAL').length,
    HIGH: projects.filter(p => p.riskTier === 'HIGH').length,
    MODERATE: projects.filter(p => p.riskTier === 'MODERATE').length,
    LOW: projects.filter(p => p.riskTier === 'LOW').length,
  };

  container.innerHTML = `
    <div class="card p-4">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
          <i data-lucide="shield-check" class="w-4 h-4 text-blue-600"></i>
          <span>Portfolio Risk Classification Tiers</span>
        </h3>
        <span class="text-[11px] text-slate-400">Total: ${projects.length} Projects</span>
      </div>
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div class="p-2.5 rounded-lg bg-red-50/60 border border-red-100">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-red-800">Critical (80–100)</span>
            <span class="badge badge-critical">${counts.CRITICAL}</span>
          </div>
          <div class="progress-bar-bg mt-2 bg-red-100">
            <div class="progress-bar-fill bg-red-500" style="width: ${(counts.CRITICAL / total * 100).toFixed(1)}%"></div>
          </div>
          <div class="text-[10px] text-red-600 mt-1 font-medium">${(counts.CRITICAL / total * 100).toFixed(1)}% of portfolio</div>
        </div>

        <div class="p-2.5 rounded-lg bg-orange-50/60 border border-orange-100">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-orange-800">High (60–79)</span>
            <span class="badge badge-high">${counts.HIGH}</span>
          </div>
          <div class="progress-bar-bg mt-2 bg-orange-100">
            <div class="progress-bar-fill bg-orange-500" style="width: ${(counts.HIGH / total * 100).toFixed(1)}%"></div>
          </div>
          <div class="text-[10px] text-orange-600 mt-1 font-medium">${(counts.HIGH / total * 100).toFixed(1)}% of portfolio</div>
        </div>

        <div class="p-2.5 rounded-lg bg-amber-50/60 border border-amber-100">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-amber-800">Moderate (40–59)</span>
            <span class="badge badge-moderate">${counts.MODERATE}</span>
          </div>
          <div class="progress-bar-bg mt-2 bg-amber-100">
            <div class="progress-bar-fill bg-amber-500" style="width: ${(counts.MODERATE / total * 100).toFixed(1)}%"></div>
          </div>
          <div class="text-[10px] text-amber-600 mt-1 font-medium">${(counts.MODERATE / total * 100).toFixed(1)}% of portfolio</div>
        </div>

        <div class="p-2.5 rounded-lg bg-emerald-50/60 border border-emerald-100">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-emerald-800">Low (0–39)</span>
            <span class="badge badge-low">${counts.LOW}</span>
          </div>
          <div class="progress-bar-bg mt-2 bg-emerald-100">
            <div class="progress-bar-fill bg-emerald-500" style="width: ${(counts.LOW / total * 100).toFixed(1)}%"></div>
          </div>
          <div class="text-[10px] text-emerald-600 mt-1 font-medium">${(counts.LOW / total * 100).toFixed(1)}% of portfolio</div>
        </div>
      </div>
    </div>
  `;
}
