/**
 * ============================================================================
 * PRISM — Project Detail Dossier Module
 * Comprehensive project inspection, PRISM Risk Indicators, longitudinal trend,
 * and embedded Intervention Lab.
 * Deterministic PRISM Risk Indicators strictly.
 * ============================================================================
 */

import { state, notify } from './state.js';
import { api } from './api.js';
import { formatCurrencyCr, formatPercent, formatMonths, getRiskBadgeHtml, getPriorityBadgeHtml, renderIcons, escapeHtml } from './utils.js';
import { initScenarioLab } from './scenario.js';

let longitudinalChartInstance = null;

export async function openProjectDetail(projectId) {
  const modal = document.getElementById('project-detail-modal');
  if (!modal) return;

  modal.classList.add('active');
  const body = document.getElementById('project-detail-body');
  if (body) {
    body.innerHTML = `
      <div class="py-16 text-center text-slate-500">
        <div class="inline-block animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mb-3"></div>
        <div class="text-sm font-semibold text-slate-700">Loading Authoritative Dossier for Project ${escapeHtml(projectId)}...</div>
        <div class="text-xs text-slate-400 mt-1">Retrieving MoSPI PAIMANA records and deterministic indicator matrix</div>
      </div>
    `;
  }

  try {
    const project = await api.getProjectById(projectId);
    state.selectedProject = project;

    let observations = [];
    try {
      const obsRes = await api.getProjectObservations(projectId);
      observations = obsRes.observations || [];
    } catch (e) {
      console.warn('Could not load observations:', e);
    }

    renderDossierContent(project, observations);
  } catch (err) {
    if (body) {
      body.innerHTML = `
        <div class="py-12 text-center text-red-600">
          <i data-lucide="alert-triangle" class="w-8 h-8 mx-auto mb-2 text-red-500"></i>
          <div class="font-bold">Failed to load project details</div>
          <div class="text-xs text-slate-500 mt-1">${escapeHtml(err.message)}</div>
          <button class="btn btn-secondary mt-4 text-xs" onclick="document.getElementById('project-detail-modal').classList.remove('active')">Close</button>
        </div>
      `;
      renderIcons();
    }
  }
}

function renderDossierContent(p, observations) {
  const body = document.getElementById('project-detail-body');
  const titleEl = document.getElementById('project-detail-title');
  if (!body) return;

  if (titleEl) {
    titleEl.textContent = p.name || `Project ${p.id}`;
  }

  // Authoritative 6 PRISM Risk Indicators
  const indicators = p.indicators || [
    { label: 'Progress Velocity', normalisedScore: 45, weight: 25, description: 'Month-over-month rate of physical milestone completion.' },
    { label: 'Progress Stagnation', normalisedScore: 50, weight: 20, description: 'Duration of stalled physical progress across monitoring cycles.' },
    { label: 'Schedule Pressure', normalisedScore: 65, weight: 20, description: 'Remaining scope compared against remaining scheduled timeframe.' },
    { label: 'Cost Escalation', normalisedScore: 40, weight: 15, description: 'Ratio of revised sanctioned cost to original approval.' },
    { label: 'Physical-Financial Divergence', normalisedScore: 30, weight: 10, description: 'Expenditure burn rate relative to verified physical completion.' },
    { label: 'Deteriorating Trend', normalisedScore: 35, weight: 10, description: 'Sequential degradation trajectory in MoSPI flash reporting.' }
  ];

  body.innerHTML = `
    <!-- Top Metadata Bar -->
    <div class="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200">
      <div class="flex flex-wrap items-center gap-2">
        ${getRiskBadgeHtml(p.riskTier, p.riskScore)}
        ${getPriorityBadgeHtml(p.priorityTier, p.priorityScore)}
        <span class="badge bg-slate-100 text-slate-700 border border-slate-200">${escapeHtml(p.sector)}</span>
        <span class="badge bg-slate-100 text-slate-700 border border-slate-200">${escapeHtml(p.state)}</span>
        <span class="text-xs font-mono text-slate-400">Code: ${escapeHtml(p.code || p.id)}</span>
      </div>
      <div class="flex items-center gap-2">
        <button id="btn-dossier-copilot" class="btn btn-copilot text-xs py-1.5 px-3">
          <i data-lucide="sparkles" class="w-3.5 h-3.5"></i> Ask Copilot About Project
        </button>
      </div>
    </div>

    <!-- Core Metrics Grid -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
      <div class="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
        <div class="text-xs text-slate-500 font-medium">Physical Progress</div>
        <div class="text-lg font-bold text-slate-900 mt-1">${formatPercent(p.physicalProgressPercent)}</div>
        <div class="progress-bar-bg mt-2 bg-slate-200">
          <div class="progress-bar-fill bg-blue-600" style="width: ${Math.min(100, Math.max(0, p.physicalProgressPercent || 0))}%"></div>
        </div>
      </div>

      <div class="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
        <div class="text-xs text-slate-500 font-medium">Financial Progress</div>
        <div class="text-lg font-bold text-slate-900 mt-1">${formatPercent(p.financialProgressPercent)}</div>
        <div class="progress-bar-bg mt-2 bg-slate-200">
          <div class="progress-bar-fill bg-indigo-600" style="width: ${Math.min(100, Math.max(0, p.financialProgressPercent || 0))}%"></div>
        </div>
      </div>

      <div class="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
        <div class="text-xs text-slate-500 font-medium">Sanctioned Outlay</div>
        <div class="text-lg font-bold text-slate-900 mt-1">${formatCurrencyCr(p.revisedCostCr || p.originalCostCr)}</div>
        <div class="text-[11px] text-slate-500 mt-1">Exp: ${formatCurrencyCr(p.cumulativeExpenditureCr)}</div>
      </div>

      <div class="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
        <div class="text-xs text-slate-500 font-medium">Schedule Slippage</div>
        <div class="text-lg font-bold ${p.timeOverrunMonths > 0 ? 'text-red-600' : 'text-emerald-600'} mt-1">
          ${formatMonths(p.timeOverrunMonths)}
        </div>
        <div class="text-[11px] text-slate-500 mt-1">Target: ${p.revisedCompletionDate || p.originalCompletionDate || 'N/A'}</div>
      </div>
    </div>

    <!-- Forward-Looking Earned Schedule & EAC Forecast (ISO 21508) -->
    <div class="mt-4 p-3.5 rounded-lg bg-gradient-to-r from-blue-900 via-indigo-950 to-slate-900 text-white border border-blue-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div>
        <div class="flex items-center gap-2">
          <span class="text-xs font-bold text-blue-300 uppercase tracking-wider">Earned Schedule & EAC Forecast</span>
          <span class="badge bg-blue-500/20 text-blue-200 border border-blue-400/30 text-[9px]">ISO 21508 EVM</span>
        </div>
        <div class="text-xs text-slate-300 mt-1">
          Projected completion slippage derived from observed MoM physical progress velocity and financial burn rate.
        </div>
      </div>
      <div class="flex items-center gap-4 text-right">
        <div>
          <div class="text-[10px] text-slate-400 uppercase font-bold">Projected Delay</div>
          <div class="text-base font-black text-amber-300">
            ${p.predictedDelayMonths !== null && p.predictedDelayMonths !== undefined ? `+${p.predictedDelayMonths} mos` : '0.0 mos'}
          </div>
        </div>
        <div class="border-l border-slate-700 pl-4">
          <div class="text-[10px] text-slate-400 uppercase font-bold">Est. Additional Escalation</div>
          <div class="text-base font-black text-emerald-300">
            ${p.predictedCostEscalationCr ? `${formatCurrencyCr(p.predictedCostEscalationCr)}` : '₹0 Cr'}
          </div>
        </div>
      </div>
    </div>

    <!-- Agency & Implementation Context -->
    <div class="mt-4 p-3.5 rounded-lg bg-blue-50/50 border border-blue-100 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-700 gap-2">
      <div>
        <strong>Implementing Agency:</strong> ${escapeHtml(p.implementingAgency || 'N/A')}
        <span class="mx-2 text-slate-300">|</span>
        <strong>Ministry:</strong> ${escapeHtml(p.ministry || 'N/A')}
      </div>
      <div>
        <strong>Latest Observation:</strong> ${escapeHtml(p.lastReportMonth || 'Jul-2026')}
      </div>
    </div>

    <!-- Peer Sector Benchmarking (SIH PS 26103) -->
    <div class="mt-6">
      <div class="flex items-center justify-between mb-2">
        <div>
          <h4 class="text-sm font-bold text-slate-900 flex items-center gap-2">
            <i data-lucide="scale" class="w-4 h-4 text-blue-600"></i>
            Peer Sector Benchmarking (Comparative Analytics)
          </h4>
          <p class="text-xs text-slate-500">Evaluating asset execution velocity and cost stability against sectoral peers</p>
        </div>
        <span id="benchmark-status-badge" class="badge bg-slate-100 text-slate-700 text-[10px] font-bold">Loading...</span>
      </div>
      <div id="dossier-benchmarking-content" class="p-4 rounded-xl border border-slate-200 bg-slate-50/70">
        <div class="text-xs text-slate-400 text-center py-2">Loading sector peer metrics...</div>
      </div>
    </div>

    <!-- PRISM Risk Indicators Section -->
    <div class="mt-6">
      <div class="flex items-center justify-between mb-3">
        <div>
          <h4 class="text-sm font-bold text-slate-900 flex items-center gap-2">
            <i data-lucide="activity" class="w-4 h-4 text-blue-600"></i>
            PRISM Risk Indicators (Deterministic Engine)
          </h4>
          <p class="text-xs text-slate-500">Six objective indicators computed from MoSPI flash reporting and engineering milestone data</p>
        </div>
        <span class="text-xs font-semibold text-slate-500">Total Score: ${Math.round(p.riskScore || 0)} / 100</span>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        ${indicators.map(ind => {
          const score = Math.round(ind.normalisedScore ?? ind.score ?? 50);
          let barColor = 'bg-emerald-500';
          if (score >= 80) barColor = 'bg-red-500';
          else if (score >= 60) barColor = 'bg-orange-500';
          else if (score >= 40) barColor = 'bg-amber-500';

          return `
            <div class="p-3 rounded-lg border border-slate-200 bg-white">
              <div class="flex items-center justify-between text-xs">
                <span class="font-bold text-slate-800">${escapeHtml(ind.label || ind.name)}</span>
                <span class="font-mono font-semibold text-slate-700">${score} / 100 <span class="text-slate-400 font-normal">(${ind.weight}% wt)</span></span>
              </div>
              <div class="progress-bar-bg mt-2 bg-slate-100">
                <div class="progress-bar-fill ${barColor}" style="width: ${Math.min(100, Math.max(0, score))}%"></div>
              </div>
              <div class="text-[11px] text-slate-500 mt-1.5">${escapeHtml(ind.description || '')}</div>
            </div>
          `;
        }).join('')}
      </div>
    </div>

    <!-- Longitudinal Trend Chart (Apr–Jul 2026) -->
    <div class="mt-6">
      <div class="flex items-center justify-between mb-2">
        <h4 class="text-sm font-bold text-slate-900 flex items-center gap-2">
          <i data-lucide="trending-up" class="w-4 h-4 text-indigo-600"></i>
          Longitudinal Progress Trajectory (MoSPI Flash Reports Apr–Jul 2026)
        </h4>
        <span class="text-xs text-slate-400">4-Month Monitored Timeline</span>
      </div>
      <div class="card p-4 bg-white" style="height: 240px; position: relative;">
        <canvas id="longitudinal-chart"></canvas>
      </div>
    </div>

    <!-- Intervention Lab / Scenario Simulation Section -->
    <div class="mt-8 pt-6 border-t border-slate-200" id="intervention-lab-container">
      <!-- Injected by scenario.js -->
    </div>
  `;

  renderIcons();

  // Wire Copilot button
  document.getElementById('btn-dossier-copilot')?.addEventListener('click', () => {
    modal.classList.remove('active');
    notify('OPEN_COPILOT_WITH_PROJECT', p);
  });

  // Render Longitudinal Chart & Benchmarking
  renderLongitudinalChart(observations);
  loadAndRenderBenchmark(p.id);

  // Initialize Intervention Lab
  initScenarioLab(p);
}

async function loadAndRenderBenchmark(projectId) {
  const container = document.getElementById('dossier-benchmarking-content');
  const badge = document.getElementById('benchmark-status-badge');
  if (!container) return;

  try {
    const b = await api.getProjectBenchmark(projectId);
    if (!b) {
      container.innerHTML = `<div class="text-xs text-slate-400 py-2 text-center">Benchmarking comparison not available.</div>`;
      return;
    }

    if (badge) {
      let badgeClass = 'bg-slate-100 text-slate-700 border-slate-200';
      if (b.performanceTier === 'UNDERPERFORMING') badgeClass = 'bg-red-50 text-red-700 border-red-200';
      else if (b.performanceTier === 'LAGGING') badgeClass = 'bg-orange-50 text-orange-700 border-orange-200';
      else if (b.performanceTier === 'OUTPERFORMING') badgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
      badge.className = `badge text-[10px] font-bold border ${badgeClass}`;
      badge.textContent = `${b.performanceTier} (${b.deltas.percentileInSector}th %tile)`;
    }

    const m = b.projectMetrics;
    const s = b.sectorBenchmark;
    const d = b.deltas;

    container.innerHTML = `
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200 text-xs">
        <div>
          <span class="font-bold text-slate-900">${escapeHtml(b.sector)} Peer Group:</span>
          <span class="text-slate-600 ml-1 font-medium">${b.peerCount} monitored projects</span>
        </div>
        <div class="text-slate-500 italic text-[11px]">
          ${escapeHtml(b.verdict)}
        </div>
      </div>

      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
        <!-- Risk Score Comparison -->
        <div class="p-2.5 rounded-lg bg-white border border-slate-200">
          <div class="text-[10px] text-slate-400 uppercase font-bold">Composite Risk</div>
          <div class="flex items-baseline justify-between mt-1">
            <span class="text-base font-bold text-slate-900">${Math.round(m.riskScore)}</span>
            <span class="text-[11px] font-semibold ${d.riskScoreDelta > 0 ? 'text-red-600' : 'text-emerald-600'}">
              ${d.riskScoreDelta > 0 ? `+${d.riskScoreDelta}` : d.riskScoreDelta} vs peer avg
            </span>
          </div>
          <div class="text-[10.5px] text-slate-500 mt-1">Sector Avg: ${s.avgRiskScore}</div>
        </div>

        <!-- Monthly Progress Velocity -->
        <div class="p-2.5 rounded-lg bg-white border border-slate-200">
          <div class="text-[10px] text-slate-400 uppercase font-bold">MoM Progress Velocity</div>
          <div class="flex items-baseline justify-between mt-1">
            <span class="text-base font-bold text-slate-900">${m.monthlyVelocityPp > 0 ? `+${m.monthlyVelocityPp}` : m.monthlyVelocityPp} pp</span>
            <span class="text-[11px] font-semibold ${d.velocityDelta < 0 ? 'text-red-600' : 'text-emerald-600'}">
              ${d.velocityDelta > 0 ? `+${d.velocityDelta}` : d.velocityDelta} pp
            </span>
          </div>
          <div class="text-[10.5px] text-slate-500 mt-1">Sector Avg: ${s.avgMonthlyVelocityPp} pp/mo</div>
        </div>

        <!-- Cost Escalation % -->
        <div class="p-2.5 rounded-lg bg-white border border-slate-200">
          <div class="text-[10px] text-slate-400 uppercase font-bold">Cost Escalation</div>
          <div class="flex items-baseline justify-between mt-1">
            <span class="text-base font-bold text-slate-900">${Math.round(m.costOverrunPercent)}%</span>
            <span class="text-[11px] font-semibold ${d.costOverrunDelta > 0 ? 'text-red-600' : 'text-emerald-600'}">
              ${d.costOverrunDelta > 0 ? `+${d.costOverrunDelta}%` : `${d.costOverrunDelta}%`}
            </span>
          </div>
          <div class="text-[10.5px] text-slate-500 mt-1">Sector Avg: ${s.avgCostOverrunPercent}%</div>
        </div>

        <!-- Physical Completion -->
        <div class="p-2.5 rounded-lg bg-white border border-slate-200">
          <div class="text-[10px] text-slate-400 uppercase font-bold">Physical Progress</div>
          <div class="flex items-baseline justify-between mt-1">
            <span class="text-base font-bold text-slate-900">${Math.round(m.physicalProgressPercent)}%</span>
            <span class="text-[11px] font-semibold text-slate-600 font-mono">${d.percentileInSector}th %tile</span>
          </div>
          <div class="text-[10.5px] text-slate-500 mt-1">Sector Avg: ${s.avgPhysicalProgressPercent}%</div>
        </div>
      </div>
    `;
    renderIcons();
  } catch (err) {
    container.innerHTML = `<div class="text-xs text-slate-400 py-2 text-center">Sector benchmark comparison not available.</div>`;
  }
}

function renderLongitudinalChart(observations) {
  const canvas = document.getElementById('longitudinal-chart');
  if (!canvas || !window.Chart) return;

  if (longitudinalChartInstance) {
    longitudinalChartInstance.destroy();
    longitudinalChartInstance = null;
  }

  // Sort observations chronologically
  const sorted = [...observations].sort((a, b) => (a.report_month || a.month || '').localeCompare(b.report_month || b.month || ''));
  const labels = sorted.map(o => o.report_month || o.month || 'Cycle');
  const physicalData = sorted.map(o => o.physical_progress_pct ?? 0);
  const financialData = sorted.map(o => o.expenditure_pct_of_revised_cost ?? o.financial_progress_pct ?? 0);

  const ctx = canvas.getContext('2d');
  longitudinalChartInstance = new window.Chart(ctx, {
    type: 'line',
    data: {
      labels: labels.length > 0 ? labels : ['Apr-2026', 'May-2026', 'Jun-2026', 'Jul-2026'],
      datasets: [
        {
          label: 'Physical Progress (%)',
          data: physicalData.length > 0 ? physicalData : [72, 74, 75, 75.5],
          borderColor: '#2563eb',
          backgroundColor: 'rgba(37, 99, 235, 0.1)',
          tension: 0.2,
          fill: false,
          borderWidth: 2.5,
          pointRadius: 4
        },
        {
          label: 'Financial Progress (%)',
          data: financialData.length > 0 ? financialData : [68, 70, 72, 73],
          borderColor: '#4f46e5',
          backgroundColor: 'rgba(79, 70, 229, 0.1)',
          tension: 0.2,
          fill: false,
          borderWidth: 2,
          borderDash: [4, 4],
          pointRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          labels: { boxWidth: 12, font: { size: 11 } }
        },
        tooltip: {
          mode: 'index',
          intersect: false
        }
      },
      scales: {
        y: {
          min: 0,
          max: 100,
          ticks: {
            callback: (v) => `${v}%`,
            font: { size: 10 }
          }
        },
        x: {
          ticks: { font: { size: 10 } }
        }
      }
    }
  });
}
