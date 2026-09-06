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

  useEffect(() => {
    runSimulation();
  }, [project.id, landWeeks, liquidityPercent, geoBuffer, fastTrackHPC]);

  const currentScore = simResult ? simResult.simulatedRiskScore : project.riskScore;
  const currentTier: RiskTier = simResult ? simResult.simulatedRiskTier : project.riskTier;
  const currentDelay = simResult ? simResult.predictedDelayMonthsSimulated : project.predictedDelayMonths;
  const currentCostEscalation = simResult ? simResult.predictedCostEscalationCrSimulated : project.predictedCostEscalationCr;

  const getTierColor = (tier: RiskTier) => {
    switch (tier) {
      case 'CRITICAL': return 'text-red-600 bg-red-50 border-red-200';
      case 'HIGH': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'MODERATE': return 'text-amber-600 bg-amber-50 border-amber-200';
      default: return 'text-emerald-600 bg-emerald-50 border-emerald-200';
    }
  };

  // Drivers for waterfall chart
  const driversToRender = simResult?.updatedDrivers || project.topRiskDrivers;

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
              <span className="text-xs text-slate-600">{project.location.city}, {project.state}</span>
            </div>
            <h2 className="text-xl font-extrabold text-slate-900 mt-1 tracking-tight">
              {project.name}
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Supervising Ministry: <strong className="text-slate-800">{project.ministry}</strong> | Last PAIMANA Audit: <span className="text-slate-700">{project.lastUpdated}</span>
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
          
          {/* Risk Score Radial Block */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider block">
                ML Risk Index
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className={`text-3xl font-black ${currentScore >= 80 ? 'text-red-600' : currentScore >= 60 ? 'text-orange-600' : currentScore >= 40 ? 'text-amber-600' : 'text-emerald-600'}`}>
                  {currentScore}
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
              <span className="font-semibold text-orange-600">+{currentDelay} mo</span>
            </div>
          </div>

          {/* Progress Divergence Metric */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider block">
              Physical vs Financial
            </span>
            <div className="mt-1 flex items-center justify-between text-xs font-semibold">
              <span className="text-blue-600">Physical: {project.physicalProgressPercent}%</span>
              <span className="text-purple-400">Financial: {project.financialProgressPercent}%</span>
            </div>
            <div className="mt-2 w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
              <div 
                className="bg-blue-500 h-full rounded-full" 
                style={{ width: `${project.physicalProgressPercent}%` }} 
              />
            </div>
            <span className="text-[10px] text-slate-600 block mt-1">
              {project.financialProgressPercent > project.physicalProgressPercent + 5
                ? '⚠️ Financial burn exceeds physical progress'
                : 'Balanced expenditure trajectory'}
            </span>
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
            🔍 SHAP Explainability & Root Causes
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

              {/* TreeSHAP Feature Attribution Waterfall Bars */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      TreeSHAP Feature Attributions (Risk Contribution Index)
                    </h3>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      Quantifies the exact points added (+) or subtracted (-) by each variable to this project's risk score
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
                  {driversToRender.map((driver, idx) => {
                    const isPositive = driver.shapValue >= 0;
                    const widthPercent = Math.min(100, Math.abs(driver.shapValue) * 3.5);

                    return (
                      <div key={driver.id || idx} className="bg-white border border-slate-200 rounded-lg p-3">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-800">{driver.label}</span>
                          <span className={`font-mono font-bold ${isPositive ? 'text-red-600' : 'text-emerald-600'}`}>
                            {isPositive ? `+${driver.shapValue}` : driver.shapValue} pts
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
                  })}
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: WHAT-IF SIMULATION */}
          {activeTab === 'simulation' && (
            <div className="space-y-5">
              
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
              {simResult && (
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
                          ₹{simResult.costSavedCr.toLocaleString()}
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
                  {project.mitigationRoadmap.map((m) => (
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
                  ))}
                </div>
              </div>

              {/* Audit Trail */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">
                  Chronological Audit Trail & Warning Events
                </h3>
                <div className="space-y-2.5">
                  {project.auditTrail.map((aud) => (
                    <div key={aud.id} className="flex items-start gap-3 text-xs border-l-2 border-slate-200 pl-3 py-1">
                      <span className="font-mono text-[11px] text-slate-500">{aud.date}</span>
                      <div>
                        <p className="text-slate-800 font-medium">{aud.event}</p>
                        <span className="text-[10px] text-slate-600">Reported by: {aud.reportedBy}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

        </div>

      </div>
    </div>
  );
};
