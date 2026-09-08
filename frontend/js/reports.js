/**
 * ============================================================================
 * PRISM — Executive Flash Report Module
 * Secretary-level portfolio summary and printable briefing dossier.
 * ============================================================================
 */

import { state } from './state.js';
import { formatCurrencyCr, getRiskBadgeHtml, getPriorityBadgeHtml, renderIcons, escapeHtml } from './utils.js';

export function initReports() {
  const closeBtn = document.getElementById('btn-close-report-modal');
  closeBtn?.addEventListener('click', closeFlashReport);

  const printBtn = document.getElementById('btn-print-flash-report');
  printBtn?.addEventListener('click', () => window.print());
}

export function openFlashReport() {
  const modal = document.getElementById('flash-report-modal');
  const body = document.getElementById('flash-report-body');
  if (!modal || !body) return;

  modal.classList.add('active');

  const projects = state.allProjects || [];
  const critical = projects.filter(p => p.riskTier === 'CRITICAL');
  const p1 = projects.filter(p => p.priorityTier === 'P1');
  const totalCost = projects.reduce((acc, p) => acc + (p.revisedCostCr || p.originalCostCr || 0), 0);
  const totalExp = projects.reduce((acc, p) => acc + (p.cumulativeExpenditureCr || 0), 0);

  body.innerHTML = `
    <div class="printable-area">
      <!-- Report Header -->
      <div class="border-b-2 border-slate-900 pb-4 mb-4 flex justify-between items-start">
        <div>
          <div class="text-xs font-bold text-blue-700 uppercase tracking-widest">Government of India &bull; MoSPI &bull; SIH 2026</div>
          <h1 class="text-xl font-black text-slate-900 mt-1">PRISM National Infrastructure Executive Flash Report</h1>
          <div class="text-xs text-slate-500 mt-0.5">Automated Portfolio Risk Assessment & Intervention Directives</div>
        </div>
        <div class="text-right text-xs">
          <div class="font-mono font-bold text-slate-800">CYCLE: JUL-2026</div>
          <div class="text-slate-500">Generated: ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
        </div>
      </div>

      <!-- Executive KPIs Summary -->
      <div class="grid grid-cols-4 gap-3 mb-5 p-3 rounded-lg bg-slate-50 border border-slate-200">
        <div>
          <div class="text-[10px] uppercase font-bold text-slate-500">Monitored Portfolio</div>
          <div class="text-base font-bold text-slate-900 mt-0.5">${projects.length.toLocaleString()} Projects</div>
        </div>
        <div>
          <div class="text-[10px] uppercase font-bold text-slate-500">Total Sanctioned</div>
          <div class="text-base font-bold text-slate-900 mt-0.5">${formatCurrencyCr(totalCost)}</div>
        </div>
        <div>
          <div class="text-[10px] uppercase font-bold text-slate-500">Critical Projects</div>
          <div class="text-base font-bold text-red-600 mt-0.5">${critical.length} Projects</div>
        </div>
        <div>
          <div class="text-[10px] uppercase font-bold text-slate-500">P1 Interventions</div>
          <div class="text-base font-bold text-amber-600 mt-0.5">${p1.length} Required</div>
        </div>
      </div>

      <!-- Critical Projects Table -->
      <div class="mb-5">
        <h3 class="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2 border-b border-slate-200 pb-1">
          Top Critical Infrastructure Projects Requiring Inter-Departmental Clearance
        </h3>
        <table class="w-full text-left text-xs">
          <thead>
            <tr class="border-b border-slate-200 bg-slate-100/80 text-slate-600 font-semibold">
              <th class="py-1.5 px-2">Project</th>
              <th class="py-1.5 px-2">State & Sector</th>
              <th class="py-1.5 px-2">Outlay</th>
              <th class="py-1.5 px-2">Risk</th>
              <th class="py-1.5 px-2">Priority</th>
              <th class="py-1.5 px-2">Primary Bottleneck</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-200">
            ${critical.slice(0, 8).map(p => `
              <tr>
                <td class="py-2 px-2 font-semibold text-slate-900">
                  ${escapeHtml(p.name)}
                  <span class="block text-[10px] font-mono text-slate-400 font-normal">ID: ${escapeHtml(p.id)}</span>
                </td>
                <td class="py-2 px-2 text-slate-700">
                  <div>${escapeHtml(p.state)}</div>
                  <div class="text-[10px] text-slate-400">${escapeHtml(p.sector)}</div>
                </td>
                <td class="py-2 px-2 font-mono">${formatCurrencyCr(p.revisedCostCr || p.originalCostCr)}</td>
                <td class="py-2 px-2">${getRiskBadgeHtml(p.riskTier, p.riskScore)}</td>
                <td class="py-2 px-2">${getPriorityBadgeHtml(p.priorityTier, p.priorityScore)}</td>
                <td class="py-2 px-2 text-[11px] text-slate-600 max-w-xs">${escapeHtml(p.priorityReason || p.primaryRiskDriver || 'Progress stagnation')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <!-- Provenance & Disclaimer -->
      <div class="p-3 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-600 leading-relaxed">
        <strong>Governance & Provenance:</strong> Derived strictly from MoSPI PAIMANA monthly monitoring reports and computed deterministically by the PRISM Risk and Priority Engines. No synthetic or unverified projections are included in this executive record.
      </div>
    </div>
  `;

  renderIcons();
}

export function closeFlashReport() {
  const modal = document.getElementById('flash-report-modal');
  if (modal) modal.classList.remove('active');
}
