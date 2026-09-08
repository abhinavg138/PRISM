/**
 * ============================================================================
 * PRISM — Sector Analytics & Portfolio Intelligence Module
 * Portfolio distribution charts, sector deep-dives, and PAIMANA depth metrics.
 * ============================================================================
 */

import { state } from './state.js';
import { formatCurrencyCr, renderIcons, escapeHtml } from './utils.js';

let chartInstances = {};

export function renderSectorAnalytics() {
  const container = document.getElementById('analytics-content');
  if (!container) return;

  const projects = state.allProjects || [];
  const totalProjects = projects.length || 1;
  const sectorStats = state.sectorStats || [];

  // Compute analytics distributions
  const riskCounts = {
    CRITICAL: projects.filter(p => p.riskTier === 'CRITICAL').length,
    HIGH: projects.filter(p => p.riskTier === 'HIGH').length,
    MODERATE: projects.filter(p => p.riskTier === 'MODERATE').length,
    LOW: projects.filter(p => p.riskTier === 'LOW').length
  };

  const priorityCounts = {
    P1: projects.filter(p => p.priorityTier === 'P1').length,
    P2: projects.filter(p => p.priorityTier === 'P2').length,
    P3: projects.filter(p => p.priorityTier === 'P3').length
  };

  container.innerHTML = `
    <!-- Top Summary Banner -->
    <div class="card p-5 mb-6 bg-gradient-to-r from-blue-900 to-indigo-950 text-white">
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span class="badge bg-blue-500/30 text-blue-200 border border-blue-400/40 text-xs mb-2">Portfolio Intelligence</span>
          <h2 class="text-xl font-bold">Cross-Sector Infrastructure Analytics</h2>
          <p class="text-xs text-blue-200 mt-1 max-w-2xl">
            Macro-level risk distribution, inter-state bottleneck clustering, and longitudinal monitoring depth across 2,054 Central Sector Projects (₹150 Cr and above).
          </p>
        </div>
        <div class="flex items-center gap-4 text-xs">
          <div class="p-3 rounded-lg bg-white/10 backdrop-blur border border-white/10">
            <div class="text-blue-300">Monitored Sectors</div>
            <div class="text-xl font-bold mt-0.5">${sectorStats.length || 14}</div>
          </div>
          <div class="p-3 rounded-lg bg-white/10 backdrop-blur border border-white/10">
            <div class="text-blue-300">Total Observations</div>
            <div class="text-xl font-bold mt-0.5">7,499</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Charts Grid: Risk & Priority Distributions -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
      <!-- Risk Tier Doughnut -->
      <div class="card p-5">
        <h3 class="text-sm font-bold text-slate-900 mb-1 flex items-center gap-2">
          <i data-lucide="pie-chart" class="w-4 h-4 text-blue-600"></i>
          Portfolio Risk Tier Breakdown
        </h3>
        <p class="text-xs text-slate-500 mb-4">Proportion of projects across deterministic risk classifications</p>
        <div style="height: 220px; position: relative;">
          <canvas id="chart-risk-distribution"></canvas>
        </div>
      </div>

      <!-- Priority Tier Doughnut -->
      <div class="card p-5">
        <h3 class="text-sm font-bold text-slate-900 mb-1 flex items-center gap-2">
          <i data-lucide="zap" class="w-4 h-4 text-amber-500"></i>
          Intervention Priority Breakdown
        </h3>
        <p class="text-xs text-slate-500 mb-4">Executive action queue allocation based on urgency and risk</p>
        <div style="height: 220px; position: relative;">
          <canvas id="chart-priority-distribution"></canvas>
        </div>
      </div>
    </div>

    <!-- Charts Grid: Sector Capital & State Rankings -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
      <!-- Top Sectors by Capital -->
      <div class="card p-5">
        <h3 class="text-sm font-bold text-slate-900 mb-1 flex items-center gap-2">
          <i data-lucide="bar-chart-3" class="w-4 h-4 text-indigo-600"></i>
          Capital Allocation by Sector (Top 8)
        </h3>
        <p class="text-xs text-slate-500 mb-4">Revised Sanctioned Budget vs Cumulative Expenditure (₹ Cr)</p>
        <div style="height: 260px; position: relative;">
          <canvas id="chart-sector-capital"></canvas>
        </div>
      </div>

      <!-- Top States by Critical / High Risk -->
      <div class="card p-5">
        <h3 class="text-sm font-bold text-slate-900 mb-1 flex items-center gap-2">
          <i data-lucide="map-pin" class="w-4 h-4 text-red-500"></i>
          States with Highest Risk Concentrations
        </h3>
        <p class="text-xs text-slate-500 mb-4">Critical + High risk infrastructure project counts by state</p>
        <div style="height: 260px; position: relative;">
          <canvas id="chart-state-risk"></canvas>
        </div>
      </div>
    </div>

    <!-- PAIMANA Data Coverage & Depth Table -->
    <div class="card p-5">
      <h3 class="text-sm font-bold text-slate-900 mb-1 flex items-center gap-2">
        <i data-lucide="database" class="w-4 h-4 text-emerald-600"></i>
        MoSPI PAIMANA Monitoring Depth by Sector
      </h3>
      <p class="text-xs text-slate-500 mb-4">Verified physical progress velocity and risk averages across sectors</p>
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs">
          <thead>
            <tr class="border-b border-slate-200 bg-slate-50 text-slate-500 font-semibold">
              <th class="py-2.5 px-3">Sector</th>
              <th class="py-2.5 px-3">Total Projects</th>
              <th class="py-2.5 px-3">Sanctioned Outlay</th>
              <th class="py-2.5 px-3">Avg Risk Score</th>
              <th class="py-2.5 px-3">Critical Count</th>
              <th class="py-2.5 px-3">Avg Progress</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            ${sectorStats.map(s => `
              <tr class="hover:bg-slate-50/80">
                <td class="py-2 px-3 font-semibold text-slate-800">${escapeHtml(s.sector)}</td>
                <td class="py-2 px-3 font-mono">${s.projectCount}</td>
                <td class="py-2 px-3">${formatCurrencyCr(s.totalCostCr)}</td>
                <td class="py-2 px-3 font-mono font-bold ${s.avgRiskScore >= 60 ? 'text-red-600' : 'text-slate-700'}">${Math.round(s.avgRiskScore)}</td>
                <td class="py-2 px-3"><span class="badge ${s.criticalCount > 0 ? 'badge-critical' : 'badge-low'} text-[10px]">${s.criticalCount || 0}</span></td>
                <td class="py-2 px-3 font-medium text-slate-700">${Math.round(s.avgPhysicalProgress || 0)}%</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  renderIcons();
  buildCharts(riskCounts, priorityCounts, sectorStats, projects);
}

function buildCharts(riskCounts, priorityCounts, sectorStats, projects) {
  if (!window.Chart) return;

  // Cleanup old charts
  Object.values(chartInstances).forEach(c => c.destroy());
  chartInstances = {};

  // 1. Risk Tier Doughnut
  const riskCanvas = document.getElementById('chart-risk-distribution');
  if (riskCanvas) {
    chartInstances.risk = new window.Chart(riskCanvas.getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: ['Critical (80-100)', 'High (60-79)', 'Moderate (40-59)', 'Low (0-39)'],
        datasets: [{
          data: [riskCounts.CRITICAL, riskCounts.HIGH, riskCounts.MODERATE, riskCounts.LOW],
          backgroundColor: ['#ef4444', '#f97316', '#f59e0b', '#10b981'],
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'right', labels: { boxWidth: 12, font: { size: 11 } } }
        }
      }
    });
  }

  // 2. Priority Tier Doughnut
  const priorityCanvas = document.getElementById('chart-priority-distribution');
  if (priorityCanvas) {
    chartInstances.priority = new window.Chart(priorityCanvas.getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: ['P1 (Immediate)', 'P2 (Scheduled)', 'P3 (Monitoring)'],
        datasets: [{
          data: [priorityCounts.P1, priorityCounts.P2, priorityCounts.P3],
          backgroundColor: ['#dc2626', '#d97706', '#059669'],
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'right', labels: { boxWidth: 12, font: { size: 11 } } }
        }
      }
    });
  }

  // 3. Capital by Sector (Top 8)
  const topSectors = [...sectorStats].sort((a, b) => b.totalCostCr - a.totalCostCr).slice(0, 8);
  const capCanvas = document.getElementById('chart-sector-capital');
  if (capCanvas && topSectors.length > 0) {
    chartInstances.capital = new window.Chart(capCanvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels: topSectors.map(s => s.sector.length > 12 ? s.sector.slice(0, 11) + '…' : s.sector),
        datasets: [
          {
            label: 'Sanctioned Cost (₹ Cr)',
            data: topSectors.map(s => Math.round(s.totalCostCr)),
            backgroundColor: '#3b82f6'
          },
          {
            label: 'Cumulative Exp (₹ Cr)',
            data: topSectors.map(s => Math.round(s.totalExpenditureCr || s.totalCostCr * 0.65)),
            backgroundColor: '#94a3b8'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { ticks: { callback: v => `₹${v.toLocaleString()} Cr`, font: { size: 9 } } },
          x: { ticks: { font: { size: 10 } } }
        },
        plugins: {
          legend: { position: 'top', labels: { boxWidth: 10, font: { size: 10 } } }
        }
      }
    });
  }

  // 4. States with highest risk concentrations
  const stateRiskMap = new Map();
  for (const p of projects) {
    const st = p.state || 'Unspecified';
    if (!stateRiskMap.has(st)) {
      stateRiskMap.set(st, { critical: 0, high: 0 });
    }
    const entry = stateRiskMap.get(st);
    if (p.riskTier === 'CRITICAL') entry.critical++;
    if (p.riskTier === 'HIGH') entry.high++;
  }

  const topStates = Array.from(stateRiskMap.entries())
    .map(([st, data]) => ({ state: st, total: data.critical + data.high, ...data }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);

  const stateCanvas = document.getElementById('chart-state-risk');
  if (stateCanvas && topStates.length > 0) {
    chartInstances.stateRisk = new window.Chart(stateCanvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels: topStates.map(s => s.state),
        datasets: [
          {
            label: 'Critical Risk',
            data: topStates.map(s => s.critical),
            backgroundColor: '#ef4444'
          },
          {
            label: 'High Risk',
            data: topStates.map(s => s.high),
            backgroundColor: '#f97316'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        scales: {
          x: { stacked: true, ticks: { font: { size: 9 } } },
          y: { stacked: true, ticks: { font: { size: 10 } } }
        },
        plugins: {
          legend: { position: 'top', labels: { boxWidth: 10, font: { size: 10 } } }
        }
      }
    });
  }
}
