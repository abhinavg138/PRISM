import React from 'react';
import { X, Printer, Copy, Check, FileText, ShieldAlert } from 'lucide-react';
import { Project, PortfolioKPIs } from '../types/index';

interface ExecutiveFlashReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  kpis: PortfolioKPIs;
  criticalProjects: Project[];
}

export const ExecutiveFlashReportModal: React.FC<ExecutiveFlashReportModalProps> = ({
  isOpen,
  onClose,
  kpis,
  criticalProjects
}) => {
  const [copied, setCopied] = React.useState(false);

  if (!isOpen) return null;

  const today = new Date().toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  const handleCopy = () => {
    const rosterText = criticalProjects.length > 0
      ? criticalProjects.map(p => `- ${p.name} (${p.code}): Risk ${p.riskScore}/100. Overrun: +${p.costOverrunPercent}%, Delay: +${p.timeOverrunMonths} mo. Primary Cause: ${p.primaryDelayCause}`).join('\n')
      : '- No projects currently classified in Critical Tier (All monitored projects operating within acceptable or moderate deterministic thresholds)';

    const text = `PRISM EXECUTIVE FLASH REPORT - ${today}
MoSPI / Prime Minister's Project Monitoring Group (PMG)
Total Monitored Projects: ${kpis.totalProjects}
Committed Capital Outlay: ₹${kpis.totalBudgetCr.toLocaleString()} Cr
Budget at Risk: ₹${kpis.budgetAtRiskCr.toLocaleString()} Cr (${kpis.totalBudgetCr > 0 ? Math.round((kpis.budgetAtRiskCr/kpis.totalBudgetCr)*100) : 0}%)
Critical Risk Projects: ${kpis.criticalProjects}
Average Schedule Overrun: ${kpis.averageDelayMonths} Months
Average Cost Escalation: +${kpis.averageCostEscalationPercent}%

CRITICAL ESCALATION ROSTER:
${rosterText}
`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6">
      <div className="bg-white border border-slate-300 w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Modal Toolbar */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-600" />
            <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              MoSPI / PMG Executive Flash Memorandum
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy Text'}</span>
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Report</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Paper */}
        <div className="p-8 overflow-y-auto flex-1 bg-white text-slate-900 space-y-6 print:p-0 font-serif">
          
          {/* Memorandum Header */}
          <div className="text-center border-b-2 border-slate-200 pb-4">
            <h1 className="text-base font-bold tracking-wider uppercase text-slate-900">
              GOVERNMENT OF INDIA
            </h1>
            <h2 className="text-sm font-semibold tracking-wide uppercase text-slate-700 mt-0.5">
              Ministry of Statistics and Programme Implementation (MoSPI)
            </h2>
            <h3 className="text-xs font-semibold text-slate-600">
              Infrastructure and Project Monitoring Division (IPMD) • PRISM Intelligence System
            </h3>
            <div className="mt-3 flex justify-between text-[11px] font-mono text-slate-500 border-t border-slate-200 pt-2">
              <span>DOC REF: PRISM-FLASH/2026/03</span>
              <span>DATE OF REPORT: {today}</span>
              <span>CLASSIFICATION: EXECUTIVE BRIEF</span>
            </div>
          </div>

          {/* Executive Summary */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b border-slate-300 pb-1">
              1. Executive Overview & Portfolio Exposure
            </h4>
            <p className="text-xs text-slate-700 mt-2 leading-relaxed font-sans">
              Under the automated risk intelligence pipeline (PRISM), <strong>{kpis.totalProjects} national priority infrastructure projects</strong> representing a cumulative revised capital allocation of <strong>₹{kpis.totalBudgetCr.toLocaleString()} Crores</strong> have been assessed against PAIMANA operational features using the PRISM evidence-based risk engine.
            </p>

            <div className="grid grid-cols-4 gap-3 mt-3 font-sans">
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded text-center">
                <span className="text-[10px] text-slate-500 uppercase block">Total Capital</span>
                <span className="text-sm font-bold text-slate-900">₹{kpis.totalBudgetCr.toLocaleString()} Cr</span>
              </div>
              <div className="p-2.5 bg-red-50 border border-red-200 rounded text-center">
                <span className="text-[10px] text-red-700 uppercase block font-bold">Budget At Risk</span>
                <span className="text-sm font-bold text-red-700">₹{kpis.budgetAtRiskCr.toLocaleString()} Cr</span>
              </div>
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded text-center">
                <span className="text-[10px] text-slate-500 uppercase block">Critical Projects</span>
                <span className="text-sm font-bold text-slate-900">{kpis.criticalProjects} of {kpis.totalProjects}</span>
              </div>
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded text-center">
                <span className="text-[10px] text-slate-500 uppercase block">Avg Delay Overrun</span>
                <span className="text-sm font-bold text-slate-900">+{kpis.averageDelayMonths} Months</span>
              </div>
            </div>
          </div>

          {/* Critical Escalations */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b border-slate-300 pb-1">
              2. Priority Escalation Projects Requiring Cabinet Inter-Ministerial Orders
            </h4>
            <div className="mt-3 space-y-3 font-sans">
              {criticalProjects.length === 0 ? (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs text-center text-slate-600">
                  <p className="font-bold text-slate-800 uppercase tracking-wider">No Projects Currently Classified in Critical Risk Tier</p>
                  <p className="text-[11px] text-slate-500 mt-1 max-w-md mx-auto leading-relaxed">
                    Under the live PAIMANA dataset, zero projects currently meet the deterministic critical threshold (80-100). For a demonstration of the critical escalation roster, activate Judge Demo Mode.
                  </p>
                </div>
              ) : (
                criticalProjects.map((p, idx) => (
                  <div key={p.id} className="p-3 bg-slate-50 border border-slate-300 rounded text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">
                        {idx + 1}. {p.name} ({p.code})
                      </span>
                      <span className="font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded text-[10px]">
                        RISK SCORE: {p.riskScore} (CRITICAL)
                      </span>
                    </div>
                    <div className="mt-1 text-[11px] text-slate-600 flex gap-4">
                      <span>Agency: <strong>{p.ministry || p.implementingAgency}</strong></span>
                      <span>State: <strong>{p.state}</strong></span>
                      <span>Cost Overrun: <strong className="text-red-700">+{p.costOverrunPercent}%</strong></span>
                      <span>{p.predictedDelayMonths != null ? <>Anticipated Delay: <strong className="text-orange-700">+{p.predictedDelayMonths} mo</strong></> : <>Recorded Delay: <strong className="text-orange-700">+{p.timeOverrunMonths} mo</strong></>}</span>
                    </div>
                    <p className="mt-1.5 text-[11px] text-slate-700 bg-white p-2 rounded border border-slate-200">
                      <strong>Primary Bottleneck:</strong> {p.primaryDelayCause}
                    </p>
                    <p className="mt-1 text-[10px] text-slate-500">
                      <strong>Recommended Cabinet Action:</strong> {p.mitigationRoadmap[0]?.action || 'Cabinet inter-ministerial review'} [Lead: {p.mitigationRoadmap[0]?.responsibleParty || p.implementingAgency}]
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Signoff */}
          <div className="pt-6 border-t border-slate-300 flex justify-between items-end font-sans text-xs">
            <div>
              <p className="font-bold text-slate-800">Generated automatically by PRISM Risk Engine v2.1</p>
              <p className="text-slate-500 text-[10px]">Smart India Hackathon 2026 Demonstration Platform</p>
            </div>
            <div className="text-right">
              <div className="w-32 border-b border-slate-400 pb-1 mb-1 font-mono text-[10px] text-slate-600 text-center">
                [Digitally Certified]
              </div>
              <p className="font-bold text-slate-800">Chief Monitoring Officer</p>
              <p className="text-slate-500 text-[10px]">MoSPI Infrastructure Monitoring Directorate</p>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
