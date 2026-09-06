import React, { useState, useEffect } from 'react';
import { 
  X, ShieldAlert, AlertTriangle, TrendingDown, Clock, 
  IndianRupee, Sliders, CheckCircle2, ChevronRight, Activity, 
  HelpCircle, ArrowRight, Sparkles, AlertCircle, FileText
} from 'lucide-react';
import { 
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, 
  Tooltip, CartesianGrid, Legend, BarChart, Bar, Cell 
} from 'recharts';
import { Project, RiskTier } from '../types/index';

interface ProjectDetailModalProps {
  project: Project | null;
  onClose: () => void;
  onAskCopilotAboutProject: (project: Project) => void;
}

export const ProjectDetailModal: React.FC<ProjectDetailModalProps> = ({
  project,
  onClose,
  onAskCopilotAboutProject
}) => {
  if (!project) return null;

  // What-If Simulation State
  const [landWeeks, setLandWeeks] = useState<number>(0);
  const [liquidityPercent, setLiquidityPercent] = useState<number>(0);
  const [geoBuffer, setGeoBuffer] = useState<number>(0);
  const [fastTrackHPC, setFastTrackHPC] = useState<boolean>(false);

  // Simulation Results
  const [simResult, setSimResult] = useState<any>(null);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'explainability' | 'simulation' | 'scurve' | 'roadmap'>('explainability');

  // Trigger Simulation via Backend API
  const runSimulation = async () => {
    setIsSimulating(true);
    try {
      const res = await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: project.id,
          params: {
            landClearanceAccelerationWeeks: landWeeks,
            contractorLiquidityInjectionPercent: liquidityPercent,
            weatherGeologicalMitigationLevel: geoBuffer,
            fastTrackHighPowerCommittee: fastTrackHPC
          }
        })
      });
      const data = await res.json();
      setSimResult(data);
    } catch (err) {
      console.error('Simulation call error:', err);
    } finally {
      setIsSimulating(false);
    }
  };

  // Phase 3A: Intervention Priority Assessment State
  const [priorityData, setPriorityData] = useState<any>(null);

  useEffect(() => {
    runSimulation();
  }, [project.id, landWeeks, liquidityPercent, geoBuffer, fastTrackHPC]);

  useEffect(() => {
    fetch(`/api/projects/${project.id}/priority`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (d) setPriorityData(d);
      })
      .catch(err => console.warn('Priority fetch failed for modal:', err));
  }, [project.id]);

  const currentScore = simResult ? simResult.simulatedRiskScore : project.riskScore;
  const currentTier: RiskTier = simResult ? simResult.simulatedRiskTier : project.riskTier;
  const currentDelay = simResult ? simResult.predictedDelayMonthsSimulated : project.predictedDelayMonths;
  const currentCostEscalation = simResult ? simResult.predictedCostEscalationCrSimulated : project.predictedCostEscalationCr;

  const priorityScore = priorityData?.priorityScore ?? project.priorityScore;
  const priorityTier = priorityData?.priorityTier ?? project.priorityTier ?? 'P3';
  const priorityReason = priorityData?.priorityReason ?? project.priorityReason;
  const recommendedAction = priorityData?.recommendedAction ?? project.recommendedAction;

  const getTierColor = (tier: RiskTier) => {
    switch (tier) {
      case 'CRITICAL': return 'text-red-600 bg-red-50 border-red-200';
      case 'HIGH': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'MODERATE': return 'text-amber-600 bg-amber-50 border-amber-200';
      case 'LOW': return 'text-emerald-600 bg-emerald-50 border-emerald-200';
      case 'UNRATED':
      default: return 'text-slate-600 bg-slate-100 border-slate-200';
    }
  };

  // Drivers for waterfall chart
  const driversToRender = simResult?.updatedDrivers || project.topRiskDrivers || [];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6">
      <div className="bg-white border border-slate-300 w-full max-w-5xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header Bar */}
        <div className="p-5 bg-slate-50 border-b border-slate-200 flex items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-blue-600 uppercase tracking-widest px-2 py-0.5 rounded bg-blue-600 border border-blue-600">
                {project.sector}
              </span>
              <span className="text-xs font-mono text-slate-600">{project.code}</span>
              <span className="text-xs text-slate-500">•</span>
              <span className="text-xs text-slate-700 font-medium">{project.implementingAgency}</span>
              <span className="text-xs text-slate-500">•</span>
              <span className="text-xs text-slate-600">{project.location?.city ? `${project.location.city}, ` : ''}{project.state}</span>
              {project.dataSource && (
                <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-bold ${project.dataSource === 'PAIMANA' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                  {project.dataSource}
                </span>
              )}
            </div>
            <h2 className="text-xl font-extrabold text-slate-900 mt-1 tracking-tight">
              {project.name}
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Supervising Ministry / Agency: <strong className="text-slate-800">{project.ministry || project.implementingAgency}</strong> | Last PAIMANA Report: <span className="text-slate-700">{project.lastUpdated}</span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onAskCopilotAboutProject(project)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-slate-900 shadow-sm transition-all"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Ask Copilot</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Top Summary Banner: Gauge & Metrics */}
        <div className="p-5 bg-white border-b border-slate-200 grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
          
          {/* PRISM Risk Index Block */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider block">
                PRISM Risk Index
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className={`text-3xl font-black ${currentScore == null ? 'text-slate-500' : currentScore >= 80 ? 'text-red-600' : currentScore >= 60 ? 'text-orange-600' : currentScore >= 40 ? 'text-amber-600' : 'text-emerald-600'}`}>
                  {currentScore ?? '—'}
                </span>
                <span className="text-xs text-slate-500 font-medium">/ 100</span>
              </div>
              <div className="mt-1">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${getTierColor(currentTier)}`}>
                  {currentTier} TIER
                </span>
              </div>
            </div>

            {simResult && simResult.riskScoreDelta < 0 && (
              <div className="text-right">
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded border border-emerald-200 flex items-center gap-1">
                  <TrendingDown className="w-3 h-3" />
                  {simResult.riskScoreDelta} pts
                </span>
                <span className="text-[9px] text-slate-600 block mt-1">Simulated Gain</span>
              </div>
            )}
          </div>

          {/* Cost Metrics */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider block">
              Budget Exposure
            </span>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-xl font-bold text-slate-900">₹{project.revisedCostCr.toLocaleString()}</span>
              <span className="text-xs text-slate-600">Cr</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px]">
              <span className="text-slate-600">Orig: ₹{project.originalCostCr.toLocaleString()} Cr</span>
              <span className="font-bold text-red-600">+{project.costOverrunPercent}%</span>
            </div>
          </div>

          {/* Timeline & Schedule Overrun */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider block">
              Timeline Slippage
            </span>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-xl font-bold text-orange-600">+{project.timeOverrunMonths}</span>
              <span className="text-xs text-slate-600">Months</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px]">
              <span className="text-slate-600">Pred. Future:</span>
              <span className="font-semibold text-orange-600">{currentDelay != null ? `+${currentDelay} mo` : 'UNRATED'}</span>
            </div>
          </div>

          {/* Progress & Spend Metric */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider block">
              Physical Progress & Spend
            </span>
            <div className="mt-1 flex items-center justify-between text-xs font-semibold">
              <span className="text-blue-600">Physical: {project.physicalProgressPercent}%</span>
              <span className="text-purple-600">Spend: {project.expenditurePctOfRevisedCost != null ? `${project.expenditurePctOfRevisedCost}%` : `${((project.cumulativeExpenditureCr / (project.revisedCostCr || 1)) * 100).toFixed(1)}%`}</span>
            </div>
            <div className="mt-2 w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
              <div 
                className="bg-blue-500 h-full rounded-full" 
                style={{ width: `${Math.min(100, project.physicalProgressPercent)}%` }} 
              />
            </div>
            <span className="text-[10px] text-slate-600 block mt-1">
              Cumulative spend: ₹{project.cumulativeExpenditureCr.toLocaleString()} Cr
            </span>
          </div>

        </div>

        {/* Phase 3A: Intervention Priority Section */}
        <div className="mx-5 mb-3 p-4 bg-gradient-to-r from-red-50/70 via-amber-50/40 to-slate-50 border border-red-200/80 rounded-xl shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-red-200/60">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-red-100 border border-red-200 flex items-center justify-center text-red-700 shrink-0">
                <ShieldAlert className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    PRISM Intervention Priority
                  </h3>
                  <span className={`px-2 py-0.5 rounded text-[11px] font-extrabold border ${
                    priorityTier === 'P1'
                      ? 'bg-red-600 text-white border-red-600'
                      : priorityTier === 'P2'
                      ? 'bg-orange-500 text-white border-orange-500'
                      : 'bg-emerald-600 text-white border-emerald-600'
                  }`}>
                    {priorityTier} — {
                      priorityTier === 'P1' ? 'Immediate Intervention' :
                      priorityTier === 'P2' ? 'High-Priority Monitoring' :
                      'Routine Monitoring'
                    }
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  Evidence-based prioritization (PRISM Risk Index + Schedule Urgency + Longitudinal Deterioration).
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shrink-0">
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">Priority Score</span>
                <span className={`text-lg font-black leading-none ${
                  priorityScore != null && priorityScore >= 70 ? 'text-red-600' :
                  priorityScore != null && priorityScore >= 50 ? 'text-orange-600' : 'text-emerald-600'
                }`}>
                  {priorityScore ?? '—'}<span className="text-xs text-slate-400 font-normal"> / 100</span>
                </span>
              </div>
              <div className="h-6 w-px bg-slate-200"></div>
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">PRISM Risk</span>
                <span className="text-lg font-black text-slate-800 leading-none">
                  {currentScore ?? '—'}<span className="text-xs text-slate-400 font-normal"> / 100</span>
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3 text-xs">
            <div className="bg-white/95 p-3 rounded-lg border border-slate-200">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                Why This Project Is Prioritized
              </span>
              <p className="text-slate-800 leading-relaxed text-[11px]">
                {priorityReason || 'Assessed under PRISM Intervention Priority Queue framework.'}
              </p>
            </div>

            <div className="bg-white/95 p-3 rounded-lg border border-blue-200">
              <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider block mb-1">
                Deterministic Recommended Action
              </span>
              <p className="text-blue-900 font-semibold leading-relaxed text-[11px]">
                {recommendedAction || 'Maintain routine milestone & expenditure monitoring'}
              </p>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="px-5 border-b border-slate-200 bg-slate-50 flex gap-4">
          <button
            onClick={() => setActiveTab('explainability')}
            className={`py-3 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'explainability'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-slate-600 hover:text-slate-800'
            }`}
          >
            🔍 PRISM Risk Indicators
          </button>
          <button
            onClick={() => setActiveTab('simulation')}
            className={`py-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'simulation'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-slate-600 hover:text-slate-800'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Interactive "What-If" Policy Simulator</span>
          </button>
          <button
            onClick={() => setActiveTab('scurve')}
            className={`py-3 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'scurve'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-slate-600 hover:text-slate-800'
            }`}
          >
            📈 Progress S-Curve
          </button>
          <button
            onClick={() => setActiveTab('roadmap')}
            className={`py-3 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'roadmap'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-slate-600 hover:text-slate-800'
            }`}
          >
            🛡️ Mitigation Roadmap & Audit
          </button>
        </div>

        {/* Body Content Area */}
        <div className="p-5 overflow-y-auto flex-1 space-y-6">
          
          {/* TAB 1: SHAP EXPLAINABILITY */}
          {activeTab === 'explainability' && (
            <div className="space-y-5">
              
              {/* Context Callout */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 mt-0.5">
                    <Activity className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Primary Delay Bottleneck Diagnosis
                    </h4>
                    <p className="text-xs text-slate-700 mt-1 leading-relaxed">
                      {project.primaryDelayCause}
                    </p>
                  </div>
                </div>
              </div>

              {/* Evidence-Based Risk Factor Attribution */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      PRISM Risk Factor Attribution (Evidence Weights)
                    </h3>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      Deterministic, transparent indicators derived from PAIMANA monthly observations. Each bar shows the weighted contribution to the PRISM Risk Index.
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-[11px]">
                    <span className="flex items-center gap-1.5 text-red-600">
                      <span className="w-2.5 h-2.5 rounded-sm bg-red-500"></span> Escalates Risk
                    </span>
                    <span className="flex items-center gap-1.5 text-emerald-600">
                      <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500"></span> Mitigates Risk
                    </span>
                  </div>
                </div>

                <div className="space-y-3 mt-4">
                  {driversToRender.length === 0 ? (
                    <div className="bg-white border border-slate-200 rounded-lg p-6 text-center text-slate-600">
                      <div className="w-10 h-10 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center mx-auto mb-2.5 text-blue-600">
                        <Activity className="w-5 h-5" />
                      </div>
                      <p className="text-xs font-bold text-slate-800 uppercase tracking-wider">No Risk Indicators Available</p>
                      <p className="text-[11px] text-slate-500 mt-1 max-w-md mx-auto">
                        Risk factor attribution is computed from PAIMANA monthly observations. No significant risk indicators were detected for this project.
                      </p>
                    </div>
                  ) : (
                    driversToRender.map((driver, idx) => {
                      const isPositive = driver.shapValue >= 0;
                      const widthPercent = Math.min(100, Math.abs(driver.shapValue) * 4);

                      return (
                        <div key={driver.id || idx} className="bg-white border border-slate-200 rounded-lg p-3">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-slate-800">{driver.label}</span>
                            <span className={`font-mono font-bold ${isPositive ? 'text-red-600' : 'text-emerald-600'}`}>
                              {driver.shapValue} wt
                            </span>
                          </div>

                          {/* Visual Bar */}
                          <div className="mt-2 w-full bg-slate-50 rounded-full h-2 overflow-hidden flex">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                isPositive ? 'bg-gradient-to-r from-orange-500 to-red-500' : 'bg-emerald-500'
                              }`}
                              style={{ width: `${widthPercent}%` }}
                            />
                          </div>

                          <p className="text-[11px] text-slate-600 mt-1.5 leading-relaxed">
                            {driver.description}
                          </p>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: WHAT-IF SIMULATION */}
          {activeTab === 'simulation' && (
            <div className="space-y-5">
              {project.riskScore == null ? (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center text-slate-600">
                  <div className="w-12 h-12 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center mx-auto mb-3 text-blue-600">
                    <Sliders className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                    What-If Policy Simulation Scheduled for Phase 2
                  </h4>
                  <p className="text-xs text-slate-600 mt-2 max-w-lg mx-auto leading-relaxed">
                    Interactive policy intervention simulation requires calibrated risk feature weights and trained counterfactual regression models. In accordance with strict data integrity standards, simulation metrics are not fabricated for unrated PAIMANA records.
                  </p>
                  <div className="mt-4 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-700 shadow-sm">
                    <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                    <span>To experience calibrated policy simulation on USBRL, launch the <strong>Judge Walkthrough</strong> in DEMO mode.</span>
                  </div>
                </div>
              ) : (
                <>
                  {/* Simulation Banner */}
                  <div className="p-4 bg-gradient-to-r from-blue-950/40 via-indigo-50 to-gray-50 border border-blue-200 rounded-xl">
                    <div className="flex items-center gap-2">
                      <Sliders className="w-4 h-4 text-blue-600" />
                      <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                        Interactive What-If Scenario Modeling (SIH 2026 Engine)
                      </h3>
                    </div>
                    <p className="text-xs text-slate-700 mt-1">
                      Simulate policy interventions in statutory clearances, contractor liquidity, and engineering buffers to predict resulting reductions in project risk, delay, and financial overrun.
                    </p>
                  </div>

                  {/* Slider Controls Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    
                    {/* Slider 1: Land Clearances */}
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-slate-800">Expedite Land & Clearances</span>
                        <span className="text-blue-600 font-bold font-mono">+{landWeeks} Weeks</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="24"
                        step="2"
                        value={landWeeks}
                        onChange={(e) => setLandWeeks(Number(e.target.value))}
                        className="w-full mt-3 accent-amber-500 cursor-pointer"
                      />
                      <span className="text-[10px] text-slate-600 block mt-1">
                        Accelerates revenue surveys and forest nod acquisitions via inter-departmental task force.
                      </span>
                    </div>

                    {/* Slider 2: Contractor Liquidity */}
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-slate-800">Contractor Working Capital Advance</span>
                        <span className="text-blue-600 font-bold font-mono">+{liquidityPercent}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="50"
                        step="5"
                        value={liquidityPercent}
                        onChange={(e) => setLiquidityPercent(Number(e.target.value))}
                        className="w-full mt-3 accent-blue-500 cursor-pointer"
                      />
                      <span className="text-[10px] text-slate-600 block mt-1">
                        Releases milestone escrow cash injection to prevent subcontractor demobilization.
                      </span>
                    </div>

                    {/* Slider 3: Geotechnical Buffer */}
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-slate-800">Geotechnical / Weather Engineering Support</span>
                        <span className="text-emerald-600 font-bold font-mono">{geoBuffer}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="10"
                        value={geoBuffer}
                        onChange={(e) => setGeoBuffer(Number(e.target.value))}
                        className="w-full mt-3 accent-emerald-500 cursor-pointer"
                      />
                      <span className="text-[10px] text-slate-600 block mt-1">
                        Deploys specialized Norwegian rock-bolting, heated concrete plants, or flood barriers.
                      </span>
                    </div>

                    {/* Toggle: Cabinet PMG Fast-Track */}
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col justify-between">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-800">Cabinet PMG Fast-Track Review</span>
                        <input
                          type="checkbox"
                          checked={fastTrackHPC}
                          onChange={(e) => setFastTrackHPC(e.target.checked)}
                          className="w-4 h-4 rounded text-blue-700 accent-amber-500 cursor-pointer"
                        />
                      </div>
                      <span className="text-[10px] text-slate-600 block mt-2">
                        Bypasses bureaucratic departmental utility shifting disputes with Chief Secretary orders.
                      </span>
                      <div className="mt-2 text-right">
                        <button
                          onClick={() => {
                            setLandWeeks(0);
                            setLiquidityPercent(0);
                            setGeoBuffer(0);
                            setFastTrackHPC(false);
                          }}
                          className="text-[11px] text-slate-600 hover:text-slate-900 underline"
                        >
                          Reset Sliders
                        </button>
                      </div>
                    </div>

                  </div>

                  {/* Simulation Live Outcome Cards */}
                  {simResult && simResult.simulatedRiskScore != null && (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                        <span>Predicted Policy Intervention Outcomes</span>
                      </h4>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="bg-white p-3 rounded-lg border border-slate-200">
                          <span className="text-[10px] font-medium text-slate-600">Risk Score Impact</span>
                          <div className="flex items-baseline gap-2 mt-1">
                            <span className="text-xl font-bold text-slate-600 line-through">
                              {simResult.originalRiskScore}
                            </span>
                            <ArrowRight className="w-3 h-3 text-slate-500" />
                            <span className="text-xl font-bold text-emerald-600">
                              {simResult.simulatedRiskScore}
                            </span>
                          </div>
                          <span className="text-[10px] text-emerald-600 font-semibold mt-0.5 block">
                            {simResult.riskScoreDelta} points reduction
                          </span>
                        </div>

                        <div className="bg-white p-3 rounded-lg border border-slate-200">
                          <span className="text-[10px] font-medium text-slate-600">Schedule Delay Saved</span>
                          <div className="flex items-baseline gap-2 mt-1">
                            <span className="text-xl font-bold text-orange-600">
                              +{simResult.delaySavedMonths}
                            </span>
                            <span className="text-xs text-slate-600">Months Recovered</span>
                          </div>
                          <span className="text-[10px] text-slate-600 mt-0.5 block">
                            New predicted delay: +{simResult.predictedDelayMonthsSimulated} mo
                          </span>
                        </div>

                        <div className="bg-white p-3 rounded-lg border border-slate-200">
                          <span className="text-[10px] font-medium text-slate-600">Cost Escalation Prevented</span>
                          <div className="flex items-baseline gap-2 mt-1">
                            <span className="text-xl font-bold text-emerald-600">
                              ₹{simResult.costSavedCr?.toLocaleString()}
                            </span>
                            <span className="text-xs text-slate-600">Cr Saved</span>
                          </div>
                          <span className="text-[10px] text-slate-600 mt-0.5 block">
                            Escalation curtailed to ₹{simResult.predictedCostEscalationCrSimulated} Cr
                          </span>
                        </div>
                      </div>

                      {/* Policy Insights */}
                      <div className="mt-3 p-3 bg-white rounded-lg border border-slate-200">
                        <span className="text-[11px] font-bold text-slate-700 block mb-1">
                          Actionable Intelligence Notes:
                        </span>
                        <ul className="space-y-1">
                          {simResult.actionableInsights.map((insight: string, idx: number) => (
                            <li key={idx} className="text-xs text-slate-700 flex items-start gap-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 mt-0.5 shrink-0" />
                              <span>{insight}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* TAB 3: S-CURVE PROGRESS */}
          {activeTab === 'scurve' && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
              <div>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Progress S-Curve & Cumulative Financial Burn
                </h3>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  Monthly planned vs actual progress tracking divergence and capital expenditure
                </p>
              </div>

              <div className="h-72 w-full mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={project.monthlyTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="month" stroke="#64748b" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="left" stroke="#64748b" tick={{ fontSize: 11 }} unit="%" />
                    <YAxis yAxisId="right" orientation="right" stroke="#64748b" tick={{ fontSize: 11 }} unit=" Cr" />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#020617', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                    />
                    <Legend />
                    <Line yAxisId="left" type="monotone" dataKey="plannedPercent" name="Planned Progress %" stroke="#94a3b8" strokeDasharray="5 5" strokeWidth={2} />
                    <Line yAxisId="left" type="monotone" dataKey="actualPercent" name="Actual Physical %" stroke="#3b82f6" strokeWidth={3} activeDot={{ r: 6 }} />
                    <Line yAxisId="right" type="monotone" dataKey="financialExpenditureCr" name="Cumulative Spend (₹ Cr)" stroke="#a855f7" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* TAB 4: ROADMAP & AUDIT */}
          {activeTab === 'roadmap' && (
            <div className="space-y-5">
              
              {/* Mitigation Roadmap */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">
                  Recommended Mitigation Action Plan
                </h3>
                <div className="space-y-3">
                  {project.mitigationRoadmap.length === 0 ? (
                    <div className="bg-white border border-slate-200 rounded-lg p-6 text-center text-slate-600">
                      <p className="text-xs font-bold text-slate-800 uppercase tracking-wider">Mitigation Roadmap Pending Risk Calibration</p>
                      <p className="text-[11px] text-slate-500 mt-1 max-w-md mx-auto leading-relaxed">
                        In accordance with PAIMANA data integrity standards, mitigation interventions are mapped directly to verified risk drivers and will be generated upon Phase 2 model training.
                      </p>
                    </div>
                  ) : (
                    project.mitigationRoadmap.map((m) => (
                      <div key={m.id} className="bg-white border border-slate-200 rounded-lg p-3 flex items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                              m.status === 'Completed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                              m.status === 'In Progress' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                              'bg-slate-100 text-slate-700'
                            }`}>
                              {m.status}
                            </span>
                            <span className="text-xs text-slate-600 font-medium">Target: {m.timeframe}</span>
                            <span className="text-xs text-slate-500">•</span>
                            <span className="text-xs text-slate-700">Lead: {m.responsibleParty}</span>
                          </div>
                          <p className="text-xs font-semibold text-slate-800 mt-1.5">
                            {m.action}
                          </p>
                          <p className="text-[11px] text-slate-600 mt-0.5">
                            {m.impact}
                          </p>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded border border-emerald-200">
                            -{m.riskReductionPoints} pts
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Audit Trail */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">
                  Chronological Audit Trail & Warning Events
                </h3>
                <div className="space-y-2.5">
                  {project.auditTrail.length === 0 ? (
                    <div className="bg-white border border-slate-200 rounded-lg p-4 text-center text-slate-500 text-xs">
                      No monthly milestone audit events recorded for this project snapshot.
                    </div>
                  ) : (
                    project.auditTrail.map((aud) => (
                      <div key={aud.id} className="flex items-start gap-3 text-xs border-l-2 border-slate-200 pl-3 py-1">
                        <span className="font-mono text-[11px] text-slate-500">{aud.date}</span>
                        <div>
                          <p className="text-slate-800 font-medium">{aud.event}</p>
                          <span className="text-[10px] text-slate-600">Reported by: {aud.reportedBy}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>
          )}

        </div>

      </div>
    </div>
  );
};
