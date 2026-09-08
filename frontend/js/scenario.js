/**
 * ============================================================================
 * PRISM — Intervention Lab & Scenario Simulation Module
 * Parametric policy lever simulation calling authoritative Python scenario engine.
 * "Illustrative Policy Scenario — Not an Observed Forecast"
 * ============================================================================
 */

import { api } from './api.js';
import { formatCurrencyCr, getRiskBadgeHtml, getPriorityBadgeHtml, renderIcons, escapeHtml } from './utils.js';

export function initScenarioLab(project) {
  const container = document.getElementById('intervention-lab-container');
  if (!container) return;

  container.innerHTML = `
    <div>
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <div>
          <h3 class="text-base font-bold text-slate-900 flex items-center gap-2">
            <i data-lucide="sliders" class="w-4 h-4 text-blue-600"></i>
            PRISM Intervention Lab — Parametric Scenario Simulator
          </h3>
          <p class="text-xs text-slate-500 mt-0.5">Model the impact of targeted statutory unblocking and liquidity injections</p>
        </div>
        <div class="text-[11px] font-semibold text-amber-800 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200">
          Illustrative Policy Scenario &mdash; Not an Observed Forecast
        </div>
      </div>

      <!-- Policy Sliders Panel -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
        <!-- Lever 1: Land Clearance -->
        <div>
          <div class="flex justify-between text-xs font-semibold text-slate-700 mb-1.5">
            <span class="flex items-center gap-1.5"><i data-lucide="compass" class="w-3.5 h-3.5 text-blue-600"></i> Land Clearance Acceleration</span>
            <span id="label-land-clearance" class="font-bold text-blue-700 font-mono">0 weeks</span>
          </div>
          <input type="range" id="slider-land" class="slider-control" min="0" max="24" value="0" step="2">
          <div class="flex justify-between text-[10px] text-slate-400 mt-1">
            <span>Status Quo (0w)</span>
            <span>Fast-Track (12w)</span>
            <span>Emergency (24w)</span>
          </div>
        </div>

        <!-- Lever 2: Working Capital -->
        <div>
          <div class="flex justify-between text-xs font-semibold text-slate-700 mb-1.5">
            <span class="flex items-center gap-1.5"><i data-lucide="wallet" class="w-3.5 h-3.5 text-blue-600"></i> Contractor Working Capital Advance</span>
            <span id="label-working-capital" class="font-bold text-blue-700 font-mono">0%</span>
          </div>
          <input type="range" id="slider-capital" class="slider-control" min="0" max="30" value="0" step="5">
          <div class="flex justify-between text-[10px] text-slate-400 mt-1">
            <span>Standard (0%)</span>
            <span>Support (15%)</span>
            <span>Maximum (30%)</span>
          </div>
        </div>

        <!-- Lever 3: Geotechnical Buffer -->
        <div>
          <div class="flex justify-between text-xs font-semibold text-slate-700 mb-1.5">
            <span class="flex items-center gap-1.5"><i data-lucide="mountain" class="w-3.5 h-3.5 text-blue-600"></i> Geotechnical & Weather Buffer</span>
            <span id="label-geo-buffer" class="font-bold text-blue-700 font-mono">0%</span>
          </div>
          <input type="range" id="slider-geo" class="slider-control" min="0" max="100" value="0" step="10">
          <div class="flex justify-between text-[10px] text-slate-400 mt-1">
            <span>Baseline (0%)</span>
            <span>Engineered (50%)</span>
            <span>Hardened (100%)</span>
          </div>
        </div>

        <!-- Lever 4: HPC Committee Toggle -->
        <div class="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200">
          <div>
            <div class="text-xs font-bold text-slate-800">Chief Secretary High-Power Committee</div>
            <div class="text-[11px] text-slate-500">Convene fast-track inter-departmental dispute panel</div>
          </div>
          <label class="switch">
            <input type="checkbox" id="toggle-hpc">
            <span class="slider-toggle"></span>
          </label>
        </div>
      </div>

      <!-- Simulation Results Surface -->
      <div id="simulation-results-panel" class="mt-4 p-4 rounded-xl border border-blue-100 bg-blue-50/30">
        <!-- Injected after simulation call -->
      </div>
    </div>
  `;

  renderIcons();
  bindScenarioEvents(project);
  runSimulation(project); // Run initial simulation with baseline levers
}

function bindScenarioEvents(project) {
  const landSlider = document.getElementById('slider-land');
  const capitalSlider = document.getElementById('slider-capital');
  const geoSlider = document.getElementById('slider-geo');
  const hpcToggle = document.getElementById('toggle-hpc');

  const landLabel = document.getElementById('label-land-clearance');
  const capitalLabel = document.getElementById('label-working-capital');
  const geoLabel = document.getElementById('label-geo-buffer');

  let debounceTimer = null;
  const triggerSimulation = () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      runSimulation(project);
    }, 150);
  };

  landSlider?.addEventListener('input', (e) => {
    if (landLabel) landLabel.textContent = `${e.target.value} weeks`;
    triggerSimulation();
  });

  capitalSlider?.addEventListener('input', (e) => {
    if (capitalLabel) capitalLabel.textContent = `${e.target.value}%`;
    triggerSimulation();
  });

  geoSlider?.addEventListener('input', (e) => {
    if (geoLabel) geoLabel.textContent = `${e.target.value}%`;
    triggerSimulation();
  });

  hpcToggle?.addEventListener('change', () => {
    triggerSimulation();
  });
}

async function runSimulation(project) {
  const landVal = Number(document.getElementById('slider-land')?.value || 0);
  const capitalVal = Number(document.getElementById('slider-capital')?.value || 0);
  const geoVal = Number(document.getElementById('slider-geo')?.value || 0);
  const hpcVal = Boolean(document.getElementById('toggle-hpc')?.checked);

  const resultsPanel = document.getElementById('simulation-results-panel');
  if (!resultsPanel) return;

  try {
    const payload = {
      projectId: project.id,
      landClearanceWeeksExpedited: landVal,
      workingCapitalAdvancePercent: capitalVal,
      geotechnicalMitigationLevel: geoVal,
      fastTrackHighPowerCommittee: hpcVal
    };

    const res = await api.simulateScenario(payload);
    renderSimulationResults(project, res);
  } catch (err) {
    resultsPanel.innerHTML = `
      <div class="text-xs text-red-600">Simulation error: ${escapeHtml(err.message)}</div>
    `;
  }
}

function renderSimulationResults(project, res) {
  const resultsPanel = document.getElementById('simulation-results-panel');
  if (!resultsPanel) return;

  const riskDelta = res.riskScoreDelta ?? 0;
  const priorityDelta = res.priorityScoreDelta ?? 0;
  const impacts = res.assumptionImpacts || [];

  resultsPanel.innerHTML = `
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <!-- Risk Outcome -->
      <div class="bg-white p-3.5 rounded-lg border border-slate-200">
        <div class="text-xs text-slate-500 font-medium">Simulated Risk Score</div>
        <div class="flex items-baseline gap-2 mt-1">
          <span class="text-2xl font-bold ${res.simulatedRiskScore >= 60 ? 'text-orange-600' : 'text-emerald-600'}">
            ${Math.round(res.simulatedRiskScore)} <span class="text-xs text-slate-400 font-normal">/ 100</span>
          </span>
          <span class="text-xs font-bold ${riskDelta < 0 ? 'text-emerald-700' : 'text-slate-600'}">
            (${riskDelta > 0 ? '+' : ''}${riskDelta} pts)
          </span>
        </div>
        <div class="mt-1 flex items-center gap-1.5 text-xs">
          ${getRiskBadgeHtml(res.simulatedRiskTier, res.simulatedRiskScore)}
        </div>
      </div>

      <!-- Priority Outcome -->
      <div class="bg-white p-3.5 rounded-lg border border-slate-200">
        <div class="text-xs text-slate-500 font-medium">Simulated Priority Score</div>
        <div class="flex items-baseline gap-2 mt-1">
          <span class="text-2xl font-bold text-slate-800">
            ${Math.round(res.simulatedPriorityScore)} <span class="text-xs text-slate-400 font-normal">/ 100</span>
          </span>
          <span class="text-xs font-bold ${priorityDelta < 0 ? 'text-emerald-700' : 'text-slate-600'}">
            (${priorityDelta > 0 ? '+' : ''}${priorityDelta} pts)
          </span>
        </div>
        <div class="mt-1 flex items-center gap-1.5 text-xs">
          ${getPriorityBadgeHtml(res.simulatedPriorityTier, res.simulatedPriorityScore)}
        </div>
      </div>

      <!-- Delay Recovery & Savings -->
      <div class="bg-white p-3.5 rounded-lg border border-slate-200">
        <div class="text-xs text-slate-500 font-medium">Projected Recovery</div>
        <div class="text-sm font-bold text-emerald-700 mt-1">
          ${res.delaySavedMonths ? `~${Number(res.delaySavedMonths).toFixed(1)} Months Recovered` : '0 mos recovered'}
        </div>
        <div class="text-xs font-semibold text-slate-700 mt-1">
          ${res.costSavedCr ? `Cost Protected: ${formatCurrencyCr(res.costSavedCr)}` : 'Cost protected: ₹0 Cr'}
        </div>
      </div>
    </div>

    <!-- Assumption Impacts & Policy Levers List -->
    <div class="mt-3 bg-white p-3 rounded-lg border border-slate-200">
      <div class="text-xs font-bold text-slate-800 mb-2">Policy Lever Sensitivity Attribution:</div>
      <div class="space-y-1.5">
        ${impacts.map(imp => `
          <div class="flex items-center justify-between text-xs py-1 px-2 rounded bg-slate-50 border border-slate-100">
            <div>
              <strong class="text-slate-700">${escapeHtml(imp.lever)}:</strong>
              <span class="text-slate-600 ml-1">${escapeHtml(imp.value)}</span>
              <span class="text-[11px] text-slate-400 ml-1.5 hidden sm:inline">&mdash; ${escapeHtml(imp.mechanism)}</span>
            </div>
            <span class="badge badge-low text-[10px] font-mono">-${Math.abs(imp.pointsReduced)} pts</span>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- Recommended Intervention -->
    <div class="mt-3 p-3 rounded-lg bg-emerald-50/60 border border-emerald-200 text-xs text-emerald-900 flex items-start gap-2">
      <i data-lucide="check-circle-2" class="w-4 h-4 text-emerald-600 shrink-0 mt-0.5"></i>
      <div>
        <strong class="font-semibold">Recommended Intervention Strategy:</strong>
        <span class="ml-1">${escapeHtml(res.recommendedIntervention || 'Standard monitoring progression active.')}</span>
      </div>
    </div>

    <!-- Action Buttons -->
    <div class="mt-3 flex justify-end gap-2">
      <button id="btn-print-officer-brief" class="btn btn-secondary text-xs py-1.5 px-3">
        <i data-lucide="printer" class="w-3.5 h-3.5"></i> Print Officer Brief
      </button>
    </div>
  `;

  renderIcons();

  document.getElementById('btn-print-officer-brief')?.addEventListener('click', () => {
    window.print();
  });
}
