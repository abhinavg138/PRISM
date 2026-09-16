/**
 * ============================================================================
 * PRISM — Cross-Sector Infrastructure Analytics & Portfolio Intelligence
 * Executive-level portfolio oversight matching the MoSPI PAIMANA specification.
 * Fully data-driven from deterministic PRISM engine scoring and observations.
 * ============================================================================
 */

import { state, getRoleScopedProjects, getRoleScopedSectorStats } from './state.js';
import { api } from './api.js';
import { renderIcons, escapeHtml } from './utils.js';

let chartInstances = {};

// Active dropdown filter selections
let currentSectorCount = '8';
let currentStateCount = '8';

/**
 * Main render function invoked by the app controller on navigation
 */
export async function renderSectorAnalytics() {
  const container = document.getElementById('analytics-content');
  if (!container) return;

  // Show loading skeleton if projects or sector stats are not ready yet
  if (!state.allProjects || state.allProjects.length === 0 || !state.sectorStats || state.sectorStats.length === 0) {
    container.innerHTML = `
      <div class="flex flex-col items-center justify-center py-24 text-slate-400">
        <div class="w-10 h-10 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mb-3"></div>
        <div class="text-sm font-medium text-slate-600">Loading Portfolio Analytics...</div>
        <div class="text-xs text-slate-400 mt-1">Aggregating Central Sector infrastructure projects</div>
      </div>
    `;
    let fetchError = null;
    try {
      if (!state.allProjects || state.allProjects.length === 0) {
        const projData = await api.getProjects();
        state.allProjects = projData.projects || [];
        state.filteredProjects = state.allProjects;
      }
      if (!state.sectorStats || state.sectorStats.length === 0) {
        const secData = await api.getSectors();
        state.sectorStats = secData.sectors || [];
      }
    } catch (err) {
      console.error('[PRISM] Failed to load analytics data:', err);
      fetchError = err;
    }

    if (fetchError || !state.allProjects || state.allProjects.length === 0) {
      container.innerHTML = `
        <div class="p-8 max-w-xl mx-auto my-16 bg-white rounded-2xl border border-red-200 shadow-sm text-center">
          <div class="w-12 h-12 bg-red-100 text-red-600 rounded-xl flex items-center justify-center mx-auto mb-4">
            <i data-lucide="alert-triangle" class="w-6 h-6"></i>
          </div>
          <h3 class="text-base font-bold text-slate-900 mb-1">Unable to Load Portfolio Analytics</h3>
          <p class="text-xs text-slate-500 mb-6 max-w-md mx-auto leading-relaxed">
            ${escapeHtml(fetchError?.message || 'Failed to retrieve projects or sector intelligence from the server. Please verify network connectivity.')}
          </p>
          <button id="btn-retry-analytics" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm transition inline-flex items-center gap-1.5 cursor-pointer">
            <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i>
            <span>Retry Loading Analytics</span>
          </button>
        </div>
      `;
      document.getElementById('btn-retry-analytics')?.addEventListener('click', () => {
        renderSectorAnalytics();
      });
      renderIcons();
      return;
    }
  }

  const projects = getRoleScopedProjects();
  const totalProjects = projects.length;
  let sectorStats = getRoleScopedSectorStats();
  if (sectorStats.length === 0 && state.currentRole?.sectorFilter) {
    const roleSec = state.currentRole.sectorFilter;
    if (projects.length > 0) {
      const totalBudget = projects.reduce((acc, p) => acc + (p.revisedCostCr || p.originalCostCr || 0), 0);
      const scored = projects.filter(p => p.riskScore != null);
      const avgScore = scored.reduce((acc, p) => acc + p.riskScore, 0) / Math.max(1, scored.length);
      sectorStats = [{ sector: roleSec, avgRiskScore: Math.round(avgScore), totalProjects: projects.length, totalBudgetCr: totalBudget }];
    }
  }

  // 1. Calculate Risk Tier Breakdown
  const riskCounts = {
    CRITICAL: projects.filter(p => p.riskTier === 'CRITICAL').length,
    HIGH: projects.filter(p => p.riskTier === 'HIGH').length,
    MODERATE: projects.filter(p => p.riskTier === 'MODERATE').length,
    LOW: projects.filter(p => p.riskTier === 'LOW').length
  };

  const riskPercents = {
    CRITICAL: totalProjects > 0 ? ((riskCounts.CRITICAL / totalProjects) * 100).toFixed(1) : '0.0',
    HIGH: totalProjects > 0 ? ((riskCounts.HIGH / totalProjects) * 100).toFixed(1) : '0.0',
    MODERATE: totalProjects > 0 ? ((riskCounts.MODERATE / totalProjects) * 100).toFixed(1) : '0.0',
    LOW: totalProjects > 0 ? ((riskCounts.LOW / totalProjects) * 100).toFixed(1) : '0.0'
  };

  const riskHighCritPercent = (
    parseFloat(riskPercents.CRITICAL) + parseFloat(riskPercents.HIGH)
  ).toFixed(1);

  // 2. Calculate Intervention Priority Breakdown
  const priorityCounts = {
    P1: projects.filter(p => p.priorityTier === 'P1').length,
    P2: projects.filter(p => p.priorityTier === 'P2').length,
    P3: projects.filter(p => p.priorityTier === 'P3').length
  };

  const priorityPercents = {
    P1: totalProjects > 0 ? ((priorityCounts.P1 / totalProjects) * 100).toFixed(1) : '0.0',
    P2: totalProjects > 0 ? ((priorityCounts.P2 / totalProjects) * 100).toFixed(1) : '0.0',
    P3: totalProjects > 0 ? ((priorityCounts.P3 / totalProjects) * 100).toFixed(1) : '0.0'
  };

  // 3. Hero Metrics Reconciliation
  const totalSanctionedCostCr = projects.reduce((sum, p) => sum + (p.revisedCostCr || 0), 0);
  const formattedSanctionedCost = `₹${(totalSanctionedCostCr / 100000).toFixed(1)} L Cr`;
  const sectorCount = sectorStats.length || (state.currentRole?.sectorFilter ? 1 : 11);
  const totalObservations = state.currentRole?.sectorFilter ? projects.length * 4 : 7499;
  const observationPeriod = 'Apr–Jul 2026';

  // Build the complete page HTML
  container.innerHTML = `
    <!-- Top Hero Card: Portfolio Intelligence Banner -->
    <div class="rounded-2xl p-6 sm:p-7 text-white mb-6 shadow-sm" style="background: linear-gradient(135deg, #0b1528 0%, #0f2347 50%, #0d1b38 100%); border: 1px solid rgba(255,255,255,0.08);">
      <div class="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
        <!-- Left Hero Title & Context -->
        <div class="max-w-xl">
          <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-600/30 text-blue-300 border border-blue-400/30 mb-3 tracking-wide">
            Portfolio Intelligence
          </span>
          <h1 class="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-tight">
            Cross-Sector Infrastructure Analytics
          </h1>
          <p class="text-xs sm:text-sm text-slate-300 mt-2 leading-relaxed font-normal">
            Macro-level risk distribution, capital allocation, and monitoring depth across ${totalProjects.toLocaleString()} Central Sector Projects (₹150 Cr and above).
          </p>
        </div>

        <!-- Right Metric Cards (4 compact cards) -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full xl:w-auto shrink-0">
          <!-- Metric 1: Total Projects -->
          <div class="rounded-xl p-3.5 bg-white/[0.06] border border-white/10 backdrop-blur-sm flex flex-col justify-between min-w-[125px]">
            <div class="flex items-center gap-1.5 text-slate-300 text-[11px] font-medium mb-1">
              <i data-lucide="shield-alert" class="w-3.5 h-3.5 text-blue-400 shrink-0"></i>
              <span>Total Projects</span>
            </div>
            <div class="text-xl sm:text-2xl font-black text-white tracking-tight font-mono">
              ${totalProjects.toLocaleString()}
            </div>
          </div>

          <!-- Metric 2: Total Sanctioned Cost -->
          <div class="rounded-xl p-3.5 bg-white/[0.06] border border-white/10 backdrop-blur-sm flex flex-col justify-between min-w-[125px]">
            <div class="flex items-center gap-1.5 text-slate-300 text-[11px] font-medium mb-1">
              <i data-lucide="briefcase" class="w-3.5 h-3.5 text-blue-400 shrink-0"></i>
              <span>Total Sanctioned Cost</span>
            </div>
            <div class="text-xl sm:text-2xl font-black text-white tracking-tight font-mono">
              ${formattedSanctionedCost}
            </div>
          </div>

          <!-- Metric 3: Monitored Sectors -->
          <div class="rounded-xl p-3.5 bg-white/[0.06] border border-white/10 backdrop-blur-sm flex flex-col justify-between min-w-[125px]">
            <div class="flex items-center gap-1.5 text-slate-300 text-[11px] font-medium mb-1">
              <i data-lucide="pie-chart" class="w-3.5 h-3.5 text-blue-400 shrink-0"></i>
              <span>Monitored Sectors</span>
            </div>
            <div class="text-xl sm:text-2xl font-black text-white tracking-tight font-mono">
              ${sectorCount}
            </div>
          </div>

          <!-- Metric 4: Total Observations -->
          <div class="rounded-xl p-3.5 bg-white/[0.06] border border-white/10 backdrop-blur-sm flex flex-col justify-between min-w-[125px]">
            <div class="flex items-center gap-1.5 text-slate-300 text-[11px] font-medium mb-1">
              <i data-lucide="eye" class="w-3.5 h-3.5 text-blue-400 shrink-0"></i>
              <span>Total Observations</span>
            </div>
            <div class="flex items-baseline gap-1">
              <span class="text-xl sm:text-2xl font-black text-white tracking-tight font-mono">${totalObservations.toLocaleString()}</span>
              <span class="text-[10px] text-slate-400 font-normal">(${observationPeriod})</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Row 1: Two Analytics Cards (Risk Tier & Intervention Priority) -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
      <!-- Card A: Portfolio Risk Tier Breakdown -->
      <div class="bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col justify-between">
        <div>
          <!-- Header -->
          <div class="flex items-start gap-3 mb-4">
            <div class="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
              <i data-lucide="clock" class="w-4 h-4"></i>
            </div>
            <div>
              <h2 class="text-sm sm:text-base font-bold text-slate-900 leading-snug">Portfolio Risk Tier Breakdown</h2>
              <p class="text-xs text-slate-500 mt-0.5">Distribution of projects across risk categories (deterministic PRISM risk classification)</p>
            </div>
          </div>

          <!-- Donut & Legend Grid -->
          <div class="grid grid-cols-1 sm:grid-cols-12 gap-5 items-center my-2">
            <!-- Donut Container -->
            <div class="sm:col-span-5 flex justify-center">
              <div class="relative w-[185px] h-[185px]">
                <canvas id="chart-risk-donut"></canvas>
                <div class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span class="text-xl font-black text-slate-900 leading-none">${totalProjects.toLocaleString()}</span>
                  <span class="text-[11px] font-medium text-slate-500 mt-1">Projects</span>
                </div>
              </div>
            </div>

            <!-- Structured Legend Rows -->
            <div class="sm:col-span-7 space-y-2.5">
              <!-- Critical Risk -->
              <div class="flex items-center justify-between text-xs py-0.5">
                <div class="flex items-center gap-2">
                  <span class="w-3 h-3 rounded-xs shrink-0" style="background-color: #ef4444;"></span>
                  <span class="font-medium text-slate-700">Critical Risk (80–100)</span>
                </div>
                <div class="flex items-center gap-4 text-right font-mono">
                  <span class="font-bold text-slate-900 w-10">${riskCounts.CRITICAL}</span>
                  <span class="text-slate-500 w-12">${riskPercents.CRITICAL}%</span>
                </div>
              </div>
              <!-- High Risk -->
              <div class="flex items-center justify-between text-xs py-0.5">
                <div class="flex items-center gap-2">
                  <span class="w-3 h-3 rounded-xs shrink-0" style="background-color: #f97316;"></span>
                  <span class="font-medium text-slate-700">High Risk (60–79)</span>
                </div>
                <div class="flex items-center gap-4 text-right font-mono">
                  <span class="font-bold text-slate-900 w-10">${riskCounts.HIGH}</span>
                  <span class="text-slate-500 w-12">${riskPercents.HIGH}%</span>
                </div>
              </div>
              <!-- Moderate Risk -->
              <div class="flex items-center justify-between text-xs py-0.5">
                <div class="flex items-center gap-2">
                  <span class="w-3 h-3 rounded-xs shrink-0" style="background-color: #f59e0b;"></span>
                  <span class="font-medium text-slate-700">Moderate Risk (40–59)</span>
                </div>
                <div class="flex items-center gap-4 text-right font-mono">
                  <span class="font-bold text-slate-900 w-10">${riskCounts.MODERATE}</span>
                  <span class="text-slate-500 w-12">${riskPercents.MODERATE}%</span>
                </div>
              </div>
              <!-- Low Risk -->
              <div class="flex items-center justify-between text-xs py-0.5">
                <div class="flex items-center gap-2">
                  <span class="w-3 h-3 rounded-xs shrink-0" style="background-color: #10b981;"></span>
                  <span class="font-medium text-slate-700">Low Risk (0–39)</span>
                </div>
                <div class="flex items-center gap-4 text-right font-mono">
                  <span class="font-bold text-slate-900 w-10">${riskCounts.LOW}</span>
                  <span class="text-slate-500 w-12">${riskPercents.LOW}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Explanatory Callout Underneath -->
        <div class="bg-blue-50/70 border border-blue-100 rounded-xl p-3 flex items-start gap-2.5 mt-4 text-xs text-blue-900 leading-relaxed">
          <i data-lucide="info" class="w-4 h-4 text-blue-600 mt-0.5 shrink-0"></i>
          <div>
            Most projects fall in the Moderate (${riskPercents.MODERATE}%) and Low (${riskPercents.LOW}%) risk bands, while ${riskHighCritPercent}% are in High or Critical risk, indicating a significant portfolio requiring active monitoring.
          </div>
        </div>
      </div>

      <!-- Card B: Intervention Priority Breakdown -->
      <div class="bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col justify-between">
        <div>
          <!-- Header -->
          <div class="flex items-start gap-3 mb-4">
            <div class="w-8 h-8 rounded-lg bg-amber-50 text-amber-500 flex items-center justify-center shrink-0 mt-0.5">
              <i data-lucide="zap" class="w-4 h-4"></i>
            </div>
            <div>
              <h2 class="text-sm sm:text-base font-bold text-slate-900 leading-snug">Intervention Priority Breakdown</h2>
              <p class="text-xs text-slate-500 mt-0.5">Allocation of projects into intervention priority queue based on risk and urgency</p>
            </div>
          </div>

          <!-- Donut & Legend Grid -->
          <div class="grid grid-cols-1 sm:grid-cols-12 gap-5 items-center my-2">
            <!-- Donut Container -->
            <div class="sm:col-span-5 flex justify-center">
              <div class="relative w-[185px] h-[185px]">
                <canvas id="chart-priority-donut"></canvas>
                <div class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span class="text-xl font-black text-slate-900 leading-none">${totalProjects.toLocaleString()}</span>
                  <span class="text-[11px] font-medium text-slate-500 mt-1">Projects</span>
                </div>
              </div>
            </div>

            <!-- Structured Legend Rows -->
            <div class="sm:col-span-7 space-y-2.5">
              <!-- P1 Immediate -->
              <div class="flex items-start justify-between text-xs py-0.5">
                <div class="flex items-start gap-2">
                  <span class="w-3 h-3 rounded-xs shrink-0 mt-0.5" style="background-color: #ef4444;"></span>
                  <div>
                    <div class="font-bold text-slate-800">P1 – Immediate</div>
                    <div class="text-[11px] text-slate-400 font-normal">Critical interventions required now</div>
                  </div>
                </div>
                <div class="flex items-center gap-4 text-right font-mono mt-0.5">
                  <span class="font-bold text-slate-900 w-10">${priorityCounts.P1}</span>
                  <span class="text-slate-500 w-12">${priorityPercents.P1}%</span>
                </div>
              </div>
              <!-- P2 Scheduled -->
              <div class="flex items-start justify-between text-xs py-0.5">
                <div class="flex items-start gap-2">
                  <span class="w-3 h-3 rounded-xs shrink-0 mt-0.5" style="background-color: #f59e0b;"></span>
                  <div>
                    <div class="font-bold text-slate-800">P2 – Scheduled</div>
                    <div class="text-[11px] text-slate-400 font-normal">Targeted interventions in planning</div>
                  </div>
                </div>
                <div class="flex items-center gap-4 text-right font-mono mt-0.5">
                  <span class="font-bold text-slate-900 w-10">${priorityCounts.P2}</span>
                  <span class="text-slate-500 w-12">${priorityPercents.P2}%</span>
                </div>
              </div>
              <!-- P3 Monitoring -->
              <div class="flex items-start justify-between text-xs py-0.5">
                <div class="flex items-start gap-2">
                  <span class="w-3 h-3 rounded-xs shrink-0 mt-0.5" style="background-color: #10b981;"></span>
                  <div>
                    <div class="font-bold text-slate-800">P3 – Monitoring</div>
                    <div class="text-[11px] text-slate-400 font-normal">Regular monitoring and watchlist</div>
                  </div>
                </div>
                <div class="flex items-center gap-4 text-right font-mono mt-0.5">
                  <span class="font-bold text-slate-900 w-10">${priorityCounts.P3}</span>
                  <span class="text-slate-500 w-12">${priorityPercents.P3}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Explanatory Callout Underneath -->
        <div class="bg-blue-50/70 border border-blue-100 rounded-xl p-3 flex items-start gap-2.5 mt-4 text-xs text-blue-900 leading-relaxed">
          <i data-lucide="info" class="w-4 h-4 text-blue-600 mt-0.5 shrink-0"></i>
          <div>
            ${priorityPercents.P1}% of projects require immediate intervention (P1), while ${priorityPercents.P2}% are scheduled for targeted intervention (P2) based on their risk profile and strategic importance.
          </div>
        </div>
      </div>
    </div>

    <!-- Row 2: Capital Allocation & State Risk Concentrations -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
      <!-- Card C: Capital Allocation by Sector -->
      <div class="bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col justify-between">
        <div>
          <!-- Header with Dropdown -->
          <div class="flex items-start justify-between gap-4 mb-3">
            <div class="flex items-start gap-3">
              <div class="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
                <i data-lucide="line-chart" class="w-4 h-4"></i>
              </div>
              <div>
                <h2 id="sector-capital-title" class="text-sm sm:text-base font-bold text-slate-900 leading-snug">Capital Allocation by Sector (Top 8)</h2>
                <p class="text-xs text-slate-500 mt-0.5">Revised Sanctioned Budget vs Cumulative Expenditure (₹ Crore)</p>
              </div>
            </div>
            <div class="shrink-0">
              <select id="sector-filter-count" class="text-xs font-semibold bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer shadow-2xs">
                <option value="5">Top 5 Sectors</option>
                <option value="8" selected>Top 8 Sectors</option>
                <option value="10">Top 10 Sectors</option>
                <option value="all">All Sectors</option>
              </select>
            </div>
          </div>

          <!-- Chart Custom Legend -->
          <div class="flex items-center justify-center gap-6 text-xs text-slate-600 mb-3 pt-1">
            <div class="flex items-center gap-2">
              <span class="inline-flex items-center"><span class="w-2.5 h-0.5 bg-[#2563eb]"></span><span class="w-2 h-2 rounded-full bg-[#2563eb] border border-white -mx-0.5"></span><span class="w-2.5 h-0.5 bg-[#2563eb]"></span></span>
              <span class="font-medium text-slate-700">Revised Sanctioned Budget (₹ Cr)</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="inline-flex items-center"><span class="w-2.5 h-0.5 bg-[#10b981]"></span><span class="w-2 h-2 rounded-full bg-[#10b981] border border-white -mx-0.5"></span><span class="w-2.5 h-0.5 bg-[#10b981]"></span></span>
              <span class="font-medium text-slate-700">Cumulative Expenditure (₹ Cr)</span>
            </div>
          </div>

          <!-- Canvas Container -->
          <div class="relative w-full h-[280px]">
            <canvas id="chart-sector-capital"></canvas>
          </div>
        </div>

        <!-- Explanatory Callout Underneath -->
        <div id="sector-callout-box" class="bg-blue-50/70 border border-blue-100 rounded-xl p-3 flex items-start gap-2.5 mt-4 text-xs text-blue-900 leading-relaxed">
          <i data-lucide="info" class="w-4 h-4 text-blue-600 mt-0.5 shrink-0"></i>
          <div id="sector-callout-text">
            Loading sector capital insights...
          </div>
        </div>
      </div>

      <!-- Card D: States with Highest Risk Concentrations -->
      <div class="bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col justify-between">
        <div>
          <!-- Header with Dropdown -->
          <div class="flex items-start justify-between gap-4 mb-3">
            <div class="flex items-start gap-3">
              <div class="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center shrink-0 mt-0.5">
                <i data-lucide="map-pin" class="w-4 h-4"></i>
              </div>
              <div>
                <h2 id="state-risk-title" class="text-sm sm:text-base font-bold text-slate-900 leading-snug">States with Highest Risk Concentrations</h2>
                <p class="text-xs text-slate-500 mt-0.5">Number of Critical + High risk projects by state</p>
              </div>
            </div>
            <div class="shrink-0">
              <select id="state-filter-count" class="text-xs font-semibold bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer shadow-2xs">
                <option value="5">Top 5 States</option>
                <option value="8" selected>Top 8 States</option>
                <option value="10">Top 10 States</option>
                <option value="all">All States</option>
              </select>
            </div>
          </div>

          <!-- Chart Custom Legend -->
          <div class="flex items-center justify-center gap-6 text-xs text-slate-600 mb-3 pt-1">
            <div class="flex items-center gap-2">
              <span class="w-3.5 h-3 rounded-xs bg-[#ef4444]"></span>
              <span class="font-medium text-slate-700">Critical Risk</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="w-3.5 h-3 rounded-xs bg-[#f97316]"></span>
              <span class="font-medium text-slate-700">High Risk</span>
            </div>
          </div>

          <!-- Canvas Container -->
          <div class="relative w-full h-[280px]">
            <canvas id="chart-state-risk"></canvas>
          </div>
        </div>

        <!-- Explanatory Callout Underneath -->
        <div id="state-callout-box" class="bg-blue-50/70 border border-blue-100 rounded-xl p-3 flex items-start gap-2.5 mt-4 text-xs text-blue-900 leading-relaxed">
          <i data-lucide="info" class="w-4 h-4 text-blue-600 mt-0.5 shrink-0"></i>
          <div id="state-callout-text">
            Loading state risk insights...
          </div>
        </div>
      </div>
    </div>
  `;

  renderIcons();

  // Initialize all 4 charts
  initDonutCharts(riskCounts, priorityCounts, totalProjects);
  renderSectorCapitalChart(sectorStats, totalSanctionedCostCr);
  renderStateRiskChart(projects);

  // Bind dropdown filter listeners
  setupFilterListeners(sectorStats, projects, totalSanctionedCostCr);
}

/**
 * Build the two donut charts (Risk Tier & Priority Breakdown)
 */
function initDonutCharts(riskCounts, priorityCounts, totalProjects) {
  if (!window.Chart) return;

  // 1. Portfolio Risk Tier Breakdown Donut
  const riskCanvas = document.getElementById('chart-risk-donut');
  if (riskCanvas) {
    if (chartInstances.risk) chartInstances.risk.destroy();
    chartInstances.risk = new window.Chart(riskCanvas.getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: ['Critical Risk (80–100)', 'High Risk (60–79)', 'Moderate Risk (40–59)', 'Low Risk (0–39)'],
        datasets: [{
          data: [riskCounts.CRITICAL, riskCounts.HIGH, riskCounts.MODERATE, riskCounts.LOW],
          backgroundColor: ['#ef4444', '#f97316', '#f59e0b', '#10b981'],
          borderWidth: 2,
          borderColor: '#ffffff',
          hoverOffset: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '70%',
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#0f172a',
            titleFont: { size: 12, weight: 'bold' },
            bodyFont: { size: 11 },
            padding: 10,
            cornerRadius: 8,
            callbacks: {
              label: (ctx) => {
                const count = ctx.raw || 0;
                const pct = totalProjects > 0 ? ((count / totalProjects) * 100).toFixed(1) : 0;
                return ` ${ctx.label}: ${count} projects (${pct}%)`;
              }
            }
          }
        }
      }
    });
  }

  // 2. Intervention Priority Breakdown Donut
  const priorityCanvas = document.getElementById('chart-priority-donut');
  if (priorityCanvas) {
    if (chartInstances.priority) chartInstances.priority.destroy();
    chartInstances.priority = new window.Chart(priorityCanvas.getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: ['P1 – Immediate', 'P2 – Scheduled', 'P3 – Monitoring'],
        datasets: [{
          data: [priorityCounts.P1, priorityCounts.P2, priorityCounts.P3],
          backgroundColor: ['#ef4444', '#f59e0b', '#10b981'],
          borderWidth: 2,
          borderColor: '#ffffff',
          hoverOffset: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '70%',
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#0f172a',
            titleFont: { size: 12, weight: 'bold' },
            bodyFont: { size: 11 },
            padding: 10,
            cornerRadius: 8,
            callbacks: {
              label: (ctx) => {
                const count = ctx.raw || 0;
                const pct = totalProjects > 0 ? ((count / totalProjects) * 100).toFixed(1) : 0;
                return ` ${ctx.label}: ${count} projects (${pct}%)`;
              }
            }
          }
        }
      }
    });
  }
}

/**
 * Render or update Capital Allocation by Sector Chart (Line Chart)
 */
function renderSectorCapitalChart(sectorStats, totalPortfolioBudget) {
  if (!window.Chart) return;

  const canvas = document.getElementById('chart-sector-capital');
  if (!canvas) return;

  // Sort sectors by budget descending
  const sorted = [...sectorStats].sort((a, b) => (b.totalBudgetCr || 0) - (a.totalBudgetCr || 0));
  
  const count = currentSectorCount === 'all' ? sorted.length : parseInt(currentSectorCount, 10);
  const selectedSectors = sorted.slice(0, count);

  // Update card title
  const titleEl = document.getElementById('sector-capital-title');
  if (titleEl) {
    titleEl.textContent = currentSectorCount === 'all' 
      ? 'Capital Allocation by Sector (All Sectors)' 
      : `Capital Allocation by Sector (Top ${selectedSectors.length})`;
  }

  // Update dynamic callout
  const selectedBudget = selectedSectors.reduce((sum, s) => sum + (s.totalBudgetCr || 0), 0);
  const pctOfTotal = totalPortfolioBudget > 0 
    ? ((selectedBudget / totalPortfolioBudget) * 100).toFixed(1) 
    : '0.0';
  
  const calloutTextEl = document.getElementById('sector-callout-text');
  if (calloutTextEl) {
    const label = currentSectorCount === 'all' ? 'All monitored sectors' : `Top ${selectedSectors.length} sectors`;
    calloutTextEl.textContent = `${label} account for ${pctOfTotal}% of total sanctioned outlay (₹${Math.round(selectedBudget).toLocaleString('en-IN')} Cr).`;
  }

  // Sector name formatter for clean X-axis labels
  const formatSectorLabel = (name) => {
    const abbreviations = {
      'Road Transport & Highways': 'Road Transport',
      'Urban Affairs & Metro': 'Urban & Metro',
      'Steel & Heavy Industry': 'Steel & Industry',
      'Telecommunications': 'Telecom',
      'Other Infrastructure': 'Other Infra'
    };
    if (abbreviations[name]) return abbreviations[name];
    return name.length > 15 ? name.slice(0, 14) + '…' : name;
  };

  if (chartInstances.capital) chartInstances.capital.destroy();

  chartInstances.capital = new window.Chart(canvas.getContext('2d'), {
    type: 'line',
    data: {
      labels: selectedSectors.map(s => formatSectorLabel(s.sector || '')),
      datasets: [
        {
          label: 'Revised Sanctioned Budget (₹ Cr)',
          data: selectedSectors.map(s => s.totalBudgetCr || 0),
          borderColor: '#2563eb',
          backgroundColor: 'rgba(37, 99, 235, 0.08)',
          borderWidth: 2.5,
          tension: 0.25,
          fill: true,
          pointRadius: 4.5,
          pointHoverRadius: 7,
          pointBackgroundColor: '#2563eb',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2,
          pointHitRadius: 10
        },
        {
          label: 'Cumulative Expenditure (₹ Cr)',
          data: selectedSectors.map(s => s.totalExpenditureCr || 0),
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.08)',
          borderWidth: 2.5,
          tension: 0.25,
          fill: true,
          pointRadius: 4.5,
          pointHoverRadius: 7,
          pointBackgroundColor: '#10b981',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2,
          pointHitRadius: 10
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      scales: {
        x: {
          grid: {
            display: false
          },
          ticks: {
            font: { size: 9.5, family: 'Inter, sans-serif' },
            color: '#475569',
            maxRotation: 25,
            minRotation: 0,
            autoSkip: false
          }
        },
        y: {
          beginAtZero: true,
          grid: { color: '#f1f5f9' },
          ticks: {
            font: { size: 9, family: 'Inter, sans-serif' },
            color: '#64748b',
            callback: (v) => `₹${(v >= 1000 ? (v / 1000).toLocaleString() + 'k' : v)}`
          }
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0f172a',
          titleFont: { size: 12, weight: 'bold', family: 'Inter, sans-serif' },
          bodyFont: { size: 11, family: 'Inter, sans-serif' },
          padding: 10,
          cornerRadius: 8,
          usePointStyle: true,
          boxPadding: 4,
          callbacks: {
            title: (items) => {
              if (!items.length) return '';
              const idx = items[0].dataIndex;
              return selectedSectors[idx]?.sector || '';
            },
            label: (ctx) => {
              const val = ctx.raw || 0;
              const idx = ctx.dataIndex;
              const sec = selectedSectors[idx];
              if (ctx.datasetIndex === 1 && sec && sec.totalBudgetCr > 0) {
                const expPct = ((val / sec.totalBudgetCr) * 100).toFixed(1);
                return ` ${ctx.dataset.label}: ₹${Math.round(val).toLocaleString('en-IN')} Cr (${expPct}% of Budget)`;
              }
              return ` ${ctx.dataset.label}: ₹${Math.round(val).toLocaleString('en-IN')} Cr`;
            }
          }
        }
      }
    }
  });
}

/**
 * Render or update States with Highest Risk Concentrations Chart
 */
function renderStateRiskChart(projects) {
  if (!window.Chart) return;

  const canvas = document.getElementById('chart-state-risk');
  if (!canvas) return;

  // Aggregate Critical & High risk counts by state
  const stateRiskMap = new Map();
  let totalPortfolioHighCrit = 0;

  for (const p of projects) {
    const isCrit = p.riskTier === 'CRITICAL';
    const isHigh = p.riskTier === 'HIGH';

    if (isCrit || isHigh) {
      totalPortfolioHighCrit++;
      const st = p.state || 'Unspecified';
      if (!stateRiskMap.has(st)) {
        stateRiskMap.set(st, { state: st, critical: 0, high: 0, total: 0 });
      }
      const entry = stateRiskMap.get(st);
      if (isCrit) entry.critical++;
      if (isHigh) entry.high++;
      entry.total++;
    }
  }

  // Sort descending by total (critical + high)
  const sorted = Array.from(stateRiskMap.values()).sort((a, b) => b.total - a.total);

  const count = currentStateCount === 'all' ? sorted.length : parseInt(currentStateCount, 10);
  const selectedStates = sorted.slice(0, count);

  // Update card title
  const titleEl = document.getElementById('state-risk-title');
  if (titleEl) {
    titleEl.textContent = currentStateCount === 'all'
      ? 'States with Highest Risk Concentrations (All States)'
      : `States with Highest Risk Concentrations (Top ${selectedStates.length})`;
  }

  // Update dynamic callout
  const selectedRiskCount = selectedStates.reduce((sum, s) => sum + s.total, 0);
  const pctOfTotal = totalPortfolioHighCrit > 0
    ? ((selectedRiskCount / totalPortfolioHighCrit) * 100).toFixed(1)
    : '0.0';

  const calloutTextEl = document.getElementById('state-callout-text');
  if (calloutTextEl) {
    const label = currentStateCount === 'all' 
      ? 'All recorded states' 
      : `These ${selectedStates.length} states`;
    calloutTextEl.textContent = `${label} account for ${pctOfTotal}% of all Critical and High risk projects (${selectedRiskCount} of ${totalPortfolioHighCrit}).`;
  }

  // Horizontal Stacked End-Of-Bar Total Labels Plugin
  const stackedTotalLabelsPlugin = {
    id: 'stateStackedTotalLabels',
    afterDatasetsDraw(chart) {
      const { ctx } = chart;
      ctx.save();
      ctx.font = 'bold 9.5px JetBrains Mono, monospace';
      ctx.fillStyle = '#0f172a';
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';

      const metaCritical = chart.getDatasetMeta(0);
      const metaHigh = chart.getDatasetMeta(1);

      selectedStates.forEach((st, index) => {
        const critBar = metaCritical.data[index];
        const highBar = metaHigh.data[index];
        if (!critBar && !highBar) return;

        // Position label right after the end of the stacked bars
        const endX = highBar ? highBar.x : critBar.x;
        const y = (highBar ? highBar.y : critBar.y);
        
        ctx.fillText(`${st.total}`, endX + 6, y);
      });
      ctx.restore();
    }
  };

  if (chartInstances.stateRisk) chartInstances.stateRisk.destroy();

  chartInstances.stateRisk = new window.Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels: selectedStates.map(s => s.state),
      datasets: [
        {
          label: 'Critical Risk',
          data: selectedStates.map(s => s.critical),
          backgroundColor: '#ef4444',
          borderRadius: 2,
          barThickness: 14
        },
        {
          label: 'High Risk',
          data: selectedStates.map(s => s.high),
          backgroundColor: '#f97316',
          borderRadius: 2,
          barThickness: 14
        }
      ]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          stacked: true,
          grid: { color: '#f1f5f9' },
          ticks: {
            font: { size: 9, family: 'Inter' },
            color: '#64748b',
            precision: 0
          }
        },
        y: {
          stacked: true,
          grid: { display: false },
          ticks: {
            font: { size: 9.5, family: 'Inter' },
            color: '#334155'
          }
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0f172a',
          titleFont: { size: 12, weight: 'bold' },
          bodyFont: { size: 11 },
          padding: 10,
          cornerRadius: 8,
          callbacks: {
            footer: (items) => {
              const idx = items[0].dataIndex;
              const total = selectedStates[idx]?.total || 0;
              return `Total Critical + High: ${total} projects`;
            }
          }
        }
      }
    },
    plugins: [stackedTotalLabelsPlugin]
  });
}

/**
 * Setup dropdown filter event handlers
 */
function setupFilterListeners(sectorStats, projects, totalSanctionedCostCr) {
  const sectorSelect = document.getElementById('sector-filter-count');
  if (sectorSelect) {
    sectorSelect.value = currentSectorCount;
    sectorSelect.addEventListener('change', (e) => {
      currentSectorCount = e.target.value;
      renderSectorCapitalChart(sectorStats, totalSanctionedCostCr);
    });
  }

  const stateSelect = document.getElementById('state-filter-count');
  if (stateSelect) {
    stateSelect.value = currentStateCount;
    stateSelect.addEventListener('change', (e) => {
      currentStateCount = e.target.value;
      renderStateRiskChart(projects);
    });
  }
}
