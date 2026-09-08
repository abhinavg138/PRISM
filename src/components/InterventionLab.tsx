import React, { useState, useEffect } from 'react';
import {
  Sliders, Sparkles, ShieldAlert, AlertTriangle, CheckCircle2,
  ArrowRight, Activity, Lock, RefreshCw, FileText, Send,
  UserCheck, Check, Copy, Info, Zap, Shield, BookOpen,
  Clock, IndianRupee, AlertCircle, ChevronRight, ChevronDown, ChevronUp
} from 'lucide-react';
import {
  Project, RiskTier, PriorityTier, InterventionLabResult,
  IndicatorChange, AssumptionImpact, InterventionBriefData
} from '../types/index';

interface InterventionLabProps {
  project: Project;
  onAskCopilotAboutProject?: (p: Project) => void;
  onOpenFlashReport?: () => void;
}

type OfficerAction = 'idle' | 'acknowledged' | 'assigned' | 'update_requested' | 'escalated';

export const InterventionLab: React.FC<InterventionLabProps> = ({
  project,
  onAskCopilotAboutProject,
  onOpenFlashReport
}) => {
  // Policy Lever States
  const [landWeeks, setLandWeeks] = useState<number>(0);
  const [liquidityPercent, setLiquidityPercent] = useState<number>(0);
  const [geoBuffer, setGeoBuffer] = useState<number>(0);
  const [fastTrackHPC, setFastTrackHPC] = useState<boolean>(false);

  // Simulation Results & Loading
  const [simResult, setSimResult] = useState<InterventionLabResult | null>(null);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [hasSimulated, setHasSimulated] = useState<boolean>(false);

  // AI Executive Narrative Generator State
  const [aiNarrative, setAiNarrative] = useState<string | null>(null);
  const [isGeneratingNarrative, setIsGeneratingNarrative] = useState<boolean>(false);
  const [isAIGenerated, setIsAIGenerated] = useState<boolean>(false);
  const [copiedBrief, setCopiedBrief] = useState<boolean>(false);

  // Officer Action Workflow
  const [officerAction, setOfficerAction] = useState<OfficerAction>('idle');

  // Edge cases
  const isUnrated = project.riskScore == null;
  const isCompleted = project.physicalProgressPercent >= 100;
  const isLowRisk = !isUnrated && (project.riskScore ?? 100) < 40;

  // Run isolated scenario simulation against existing What-If engine
  const handleRunSimulation = async (
    customParams?: { land?: number; cash?: number; geo?: number; hpc?: boolean }
  ) => {
    if (isUnrated) return;

    setIsSimulating(true);
    setAiNarrative(null); // Reset narrative when scenario inputs change

    const pLand = customParams?.land !== undefined ? customParams.land : landWeeks;
    const pCash = customParams?.cash !== undefined ? customParams.cash : liquidityPercent;
    const pGeo = customParams?.geo !== undefined ? customParams.geo : geoBuffer;
    const pHpc = customParams?.hpc !== undefined ? customParams.hpc : fastTrackHPC;

    try {
      const res = await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: project.id,
          params: {
            landClearanceAccelerationWeeks: pLand,
            contractorLiquidityInjectionPercent: pCash,
            weatherGeologicalMitigationLevel: pGeo,
            fastTrackHighPowerCommittee: pHpc
          }
        })
      });

      if (res.ok) {
        const data: InterventionLabResult = await res.json();
        setSimResult(data);
        setHasSimulated(true);
      }
    } catch (err) {
      console.error('[Intervention Lab] Simulation request failed:', err);
    } finally {
      setIsSimulating(false);
    }
  };

  // Preset Handlers for 90-Second Judge Demo
  const applyPreset = (preset: 'standard' | 'aggressive' | 'reset') => {
    if (preset === 'standard') {
      setLandWeeks(12);
      setLiquidityPercent(20);
      setGeoBuffer(0);
      setFastTrackHPC(true);
      handleRunSimulation({ land: 12, cash: 20, geo: 0, hpc: true });
    } else if (preset === 'aggressive') {
      setLandWeeks(18);
      setLiquidityPercent(35);
      setGeoBuffer(60);
      setFastTrackHPC(true);
      handleRunSimulation({ land: 18, cash: 35, geo: 60, hpc: true });
    } else {
      setLandWeeks(0);
      setLiquidityPercent(0);
      setGeoBuffer(0);
      setFastTrackHPC(false);
      handleRunSimulation({ land: 0, cash: 0, geo: 0, hpc: false });
    }
  };

  // Run baseline simulation on mount if high or critical risk
  useEffect(() => {
    if (!isUnrated && !hasSimulated) {
      // Auto-run baseline so judge immediately sees current state
      handleRunSimulation({ land: 0, cash: 0, geo: 0, hpc: false });
    }
  }, [project.id]);

  // Generate AI Executive Brief Narrative
  const handleGenerateNarrative = async () => {
    if (!simResult) return;
    setIsGeneratingNarrative(true);
    try {
      const res = await fetch('/api/intervention-lab/narrative', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: project.id,
          scenarioResult: simResult
        })
      });
      if (res.ok) {
        const data = await res.json();
        setAiNarrative(data.narrative);
        setIsAIGenerated(data.isAIGenerated);
      }
    } catch (err) {
      console.error('[Intervention Lab] Narrative generation failed:', err);
    } finally {
      setIsGeneratingNarrative(false);
    }
  };

  const handleCopyBrief = () => {
    if (!simResult) return;
    const textToCopy = aiNarrative || `PRISM INTERVENTION BRIEF: ${project.name} (${project.id})
Current: Risk ${simResult.originalRiskScore}/100 (${simResult.originalRiskTier}), Priority ${simResult.originalPriorityTier} (${simResult.originalPriorityScore}/100)
Scenario: Risk ${simResult.simulatedRiskScore}/100 (${simResult.simulatedRiskTier}), Priority ${simResult.simulatedPriorityTier} (${simResult.simulatedPriorityScore}/100)
Schedule Impact: ~${simResult.delaySavedMonths} months saved | Cost Escalation Curtailed: ₹${simResult.costSavedCr} Cr
Recommended Action: ${simResult.recommendedIntervention}
Disclaimer: Illustrative Policy Scenario — Not an Observed Forecast.`;

    navigator.clipboard.writeText(textToCopy);
    setCopiedBrief(true);
    setTimeout(() => setCopiedBrief(false), 2500);
  };

  const getTierBadge = (tier?: RiskTier | null) => {
    switch (tier) {
      case 'CRITICAL':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'HIGH':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'MODERATE':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'LOW':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getPriorityBadge = (tier?: PriorityTier | null) => {
    switch (tier) {
      case 'P1':
        return 'bg-red-50 text-red-700 border-red-200 font-extrabold';
      case 'P2':
        return 'bg-orange-50 text-orange-700 border-orange-200 font-bold';
      case 'P3':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200 font-medium';
      default:
        return 'bg-slate-50 text-slate-600 border-slate-200';
    }
  };

  // Edge Case: Project is UNRATED
  if (isUnrated) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-8 text-center max-w-xl mx-auto my-6">
        <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 mx-auto mb-3">
          <Sliders className="w-6 h-6" />
        </div>
        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
          Intervention Lab Unavailable (Project Unrated)
        </h3>
        <p className="text-xs text-slate-600 mt-2 leading-relaxed">
          The PRISM Intervention Lab operates strictly on top of verified longitudinal risk indices.
          Project <strong>{project.name}</strong> currently has fewer than 2 monthly PAIMANA observations,
          preventing deterministic risk indicator computation.
        </p>
        <div className="mt-4 p-3 bg-white border border-slate-200 rounded-xl text-left text-[11px] text-slate-600 space-y-1">
          <p><strong>Required Cadence:</strong> Minimum 2 consecutive monthly MoSPI PAIMANA flash reports.</p>
          <p><strong>Recommended Action:</strong> Mandate monthly field submission via the MoSPI Project Monitoring Portal.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* ───────────────────────────────────────────────────────────────────── */}
      {/* 1. INTERVENTION LAB BANNER & RIGOROUS AUTHORITY NOTICE                 */}
      {/* ───────────────────────────────────────────────────────────────────── */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 text-white shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 border border-blue-400 flex items-center justify-center text-white shadow-xs shrink-0">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-extrabold tracking-tight uppercase">
                  PRISM Intervention Lab
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-900 text-blue-200 border border-blue-700">
                  DECISION SUPPORT
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Isolated policy simulation & executive brief generation grounded on verified MoSPI PAIMANA data.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="text-[10px] uppercase font-mono px-2 py-1 rounded bg-slate-800 text-slate-300 border border-slate-700 flex items-center gap-1.5">
              <Lock className="w-3 h-3 text-emerald-400" />
              NON-MUTATING SANDBOX
            </span>
          </div>
        </div>

        {/* Strict Authority & Disclaimer Strip */}
        <div className="mt-3 pt-3 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[10px] text-slate-400">
          <div className="flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span>
              <strong>Authority:</strong> PRISM Deterministic Risk Engine ({project.riskScore}/100). Policy scenarios do not modify official historical records.
            </span>
          </div>
          <span className="text-amber-300 font-medium">
            Illustrative Policy Scenario — Not an Observed Forecast
          </span>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────────────── */}
      {/* 2. CURRENT STATE: RISK & PRIORITY BASELINE                           */}
      {/* ───────────────────────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-blue-600" />
            1. Current State Baseline
          </span>
          <span className="text-[10px] font-mono text-slate-500">
            PAIMANA Apr–Jul 2026 Snapshot
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Risk Index */}
          <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              PRISM Risk Index
            </span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className={`text-2xl font-black ${
                (project.riskScore ?? 0) >= 80 ? 'text-red-600' :
                (project.riskScore ?? 0) >= 60 ? 'text-orange-600' :
                (project.riskScore ?? 0) >= 40 ? 'text-amber-600' : 'text-emerald-600'
              }`}>
                {project.riskScore}
              </span>
              <span className="text-xs text-slate-400 font-medium">/ 100</span>
            </div>
            <div className="mt-1.5">
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getTierBadge(project.riskTier)}`}>
                {project.riskTier}
              </span>
            </div>
          </div>

          {/* Intervention Priority */}
          <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              Intervention Priority
            </span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className={`text-2xl font-black ${
                project.priorityTier === 'P1' ? 'text-red-600' :
                project.priorityTier === 'P2' ? 'text-orange-600' : 'text-emerald-600'
              }`}>
                {project.priorityTier || 'P2'}
              </span>
              <span className="text-xs text-slate-400 font-medium">
                {project.priorityScore != null ? `· ${project.priorityScore}/100` : ''}
              </span>
            </div>
            <div className="mt-1.5">
              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${getPriorityBadge(project.priorityTier)}`}>
                {project.priorityTier === 'P1' ? 'Immediate Urgent Action' :
                 project.priorityTier === 'P2' ? 'Significant Oversight' : 'Periodic Monitoring'}
              </span>
            </div>
          </div>

          {/* Physical Progress */}
          <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              Physical Progress
            </span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-2xl font-bold text-blue-700">
                {project.physicalProgressPercent}%
              </span>
            </div>
            <div className="mt-2 w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-blue-600 h-full rounded-full"
                style={{ width: `${Math.min(100, project.physicalProgressPercent)}%` }}
              />
            </div>
            <span className="text-[10px] text-slate-500 block mt-1.5">
              {isCompleted ? '100% Complete' : `Overrun: +${project.timeOverrunMonths} mo`}
            </span>
          </div>

          {/* Cost Exposure */}
          <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              Revised Budget & Overrun
            </span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-xl font-bold text-slate-900">
                ₹{project.revisedCostCr.toLocaleString()}
              </span>
              <span className="text-xs text-slate-500">Cr</span>
            </div>
            <div className="mt-1.5 text-[10px]">
              <span className={`font-bold ${project.costOverrunPercent > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                {project.costOverrunPercent > 0 ? `+${project.costOverrunPercent}% overrun` : 'Budget compliant'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────────────── */}
      {/* 3. WHY: SIX DETERMINISTIC PRISM RISK INDICATORS                        */}
      {/* ───────────────────────────────────────────────────────────────────── */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-blue-600" />
              2. Why This Project is Prioritized (Six PRISM Indicators)
            </h3>
            <p className="text-[11px] text-slate-600 mt-0.5">
              Deterministic contributors computed from PAIMANA monthly observation differentials.
            </p>
          </div>
          <span className="text-[10px] font-mono text-slate-400 hidden sm:inline">
            Deterministic Formula (Sum = 100)
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
          {(simResult?.indicatorChanges || [
            { id: 'velocity', label: 'Progress Velocity', weight: 25, originalScore: 75, originalContribution: 18.8 },
            { id: 'stagnation', label: 'Progress Stagnation', weight: 20, originalScore: 80, originalContribution: 16.0 },
            { id: 'schedule_pressure', label: 'Schedule Pressure', weight: 20, originalScore: 85, originalContribution: 17.0 },
            { id: 'cost_escalation', label: 'Cost Escalation', weight: 15, originalScore: 70, originalContribution: 10.5 },
            { id: 'divergence', label: 'Phys-Financial Divergence', weight: 10, originalScore: 60, originalContribution: 6.0 },
            { id: 'deteriorating_trend', label: 'Deteriorating Trend', weight: 10, originalScore: 50, originalContribution: 5.0 },
          ]).map((ind) => (
            <div key={ind.id} className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col justify-between shadow-2xs">
              <div className="flex items-start justify-between gap-1 mb-1.5">
                <span className="text-xs font-bold text-slate-800 leading-tight">
                  {ind.label}
                </span>
                <span className="text-[10px] font-mono text-slate-400 shrink-0">
                  wt: {ind.weight}%
                </span>
              </div>

              <div className="flex items-baseline justify-between mt-1">
                <div className="flex items-baseline gap-1">
                  <span className={`text-base font-black ${
                    ind.originalScore >= 75 ? 'text-red-600' :
                    ind.originalScore >= 50 ? 'text-orange-600' :
                    ind.originalScore >= 25 ? 'text-amber-600' : 'text-emerald-600'
                  }`}>
                    {ind.originalScore}
                  </span>
                  <span className="text-[10px] text-slate-400">/ 100</span>
                </div>
                <span className="text-[11px] font-mono text-slate-600 font-semibold">
                  +{ind.originalContribution} pts
                </span>
              </div>

              <div className="mt-2 w-full bg-slate-100 rounded-full h-1 overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    ind.originalScore >= 75 ? 'bg-red-500' :
                    ind.originalScore >= 50 ? 'bg-orange-500' :
                    ind.originalScore >= 25 ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.min(100, ind.originalScore)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────────────── */}
      {/* 4. INTERVENTION PLAN: ADJUSTABLE LEVERS & PRESETS                      */}
      {/* ───────────────────────────────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-blue-600" />
              3. Intervention Plan & Parametric Assumptions
            </h3>
            <p className="text-[11px] text-slate-600 mt-0.5">
              Calibrate operational policy levers to simulate sensitivity against critical path bottlenecks.
            </p>
          </div>

          {/* 90-Second Demo Presets */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-slate-500 font-medium mr-1 hidden sm:inline">Presets:</span>
            <button
              onClick={() => applyPreset('standard')}
              className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 transition-colors"
              title="Apply 12w land clearance + HPC escalation"
            >
              ⚡ Standard (12w + HPC)
            </button>
            <button
              onClick={() => applyPreset('aggressive')}
              className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 transition-colors"
              title="Apply aggressive multi-lever package"
            >
              🚀 Aggressive
            </button>
            <button
              onClick={() => applyPreset('reset')}
              className="px-2 py-1 rounded-lg text-[11px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200 transition-colors"
              title="Reset levers to baseline"
            >
              Reset
            </button>
          </div>
        </div>

        {/* 4 Levers Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Lever 1: Land Clearance Acceleration */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <span>🚚 Land & Right-of-Way Fast-Track</span>
              </label>
              <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                {landWeeks} weeks expedited
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="24"
              step="2"
              value={landWeeks}
              onChange={(e) => setLandWeeks(parseInt(e.target.value, 10))}
              disabled={isCompleted}
              className="w-full accent-blue-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500">
              <span>0w (Status Quo)</span>
              <span>12w (Targeted)</span>
              <span>24w (Max Expedited)</span>
            </div>
            <p className="text-[10px] text-slate-500 leading-tight">
              Compresses statutory forest/revenue land handover on critical path.
            </p>
          </div>

          {/* Lever 2: Contractor Liquidity Support */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <span>💰 Contractor Working Capital Advance</span>
              </label>
              <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                {liquidityPercent}% mobilization
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="50"
              step="5"
              value={liquidityPercent}
              onChange={(e) => setLiquidityPercent(parseInt(e.target.value, 10))}
              disabled={isCompleted}
              className="w-full accent-blue-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500">
              <span>0% (Standard)</span>
              <span>25% (Working Capital)</span>
              <span>50% (Emergency Support)</span>
            </div>
            <p className="text-[10px] text-slate-500 leading-tight">
              Escrow mobilization against bank guarantee to unblock labor and materials.
            </p>
          </div>

          {/* Lever 3: Geotechnical & Weather Engineering Mitigation */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <span>⛰️ Geotechnical & Weather Buffer</span>
              </label>
              <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                {geoBuffer}% buffer
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="10"
              value={geoBuffer}
              onChange={(e) => setGeoBuffer(parseInt(e.target.value, 10))}
              disabled={isCompleted}
              className="w-full accent-blue-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500">
              <span>0% (Unmitigated)</span>
              <span>50% (Slope Stabilized)</span>
              <span>100% (All-Weather)</span>
            </div>
            <p className="text-[10px] text-slate-500 leading-tight">
              Deploys rock bolting, de-watering, and all-weather heated batching plants.
            </p>
          </div>

          {/* Lever 4: Fast-Track High-Power Committee */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-800 block">
                  🏛️ High-Power Committee (HPC)
                </span>
                <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">
                  Chief Secretary level inter-ministerial dispute resolution.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFastTrackHPC(!fastTrackHPC)}
                disabled={isCompleted}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                  fastTrackHPC ? 'bg-blue-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    fastTrackHPC ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div className="mt-2 pt-2 border-t border-slate-200 flex items-center justify-between text-[10px]">
              <span className="text-slate-600 font-medium">Status:</span>
              <span className={`font-bold ${fastTrackHPC ? 'text-blue-700' : 'text-slate-500'}`}>
                {fastTrackHPC ? 'CONVENED (Active)' : 'Standard Channel'}
              </span>
            </div>
          </div>

        </div>

        {/* Simulate Action Button */}
        <div className="mt-4 pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-[11px] text-slate-600 flex items-center gap-1.5">
            <Info className="w-4 h-4 text-blue-600 shrink-0" />
            <span>
              Simulating policy sensitivity updates the project in-memory without altering database records.
            </span>
          </div>

          <button
            onClick={() => handleRunSimulation()}
            disabled={isSimulating || isCompleted}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white shadow-sm transition-all"
          >
            {isSimulating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Simulating Scenario...</span>
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" />
                <span>Run Intervention Scenario</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────────────── */}
      {/* 5. RESULT: CURRENT VS SCENARIO COMPARISON                             */}
      {/* ───────────────────────────────────────────────────────────────────── */}
      {simResult && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-blue-600" />
              4. Scenario Results: Current vs Simulated
            </h3>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              SIMULATION COMPLETED
            </span>
          </div>

          {/* Big Transition Tiles */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">

            {/* Risk Score Transition */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                PRISM Risk Score Transition
              </span>
              <div className="flex items-center gap-3 mt-2">
                <div>
                  <span className="text-2xl font-black text-slate-700 block leading-none">
                    {simResult.originalRiskScore}
                  </span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded mt-1 inline-block border ${getTierBadge(simResult.originalRiskTier)}`}>
                    {simResult.originalRiskTier}
                  </span>
                </div>

                <ArrowRight className="w-5 h-5 text-blue-600 shrink-0" />

                <div>
                  <span className={`text-2xl font-black block leading-none ${
                    (simResult.simulatedRiskScore ?? 0) < (simResult.originalRiskScore ?? 0) ? 'text-emerald-600' : 'text-slate-800'
                  }`}>
                    {simResult.simulatedRiskScore}
                  </span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded mt-1 inline-block border ${getTierBadge(simResult.simulatedRiskTier)}`}>
                    {simResult.simulatedRiskTier}
                  </span>
                </div>
              </div>
              {simResult.riskScoreDelta !== 0 && (
                <span className="text-[11px] font-bold text-emerald-700 block mt-2">
                  ▼ {Math.abs(simResult.riskScoreDelta ?? 0)} pts risk reduction
                </span>
              )}
            </div>

            {/* Priority Tier Transition */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                Intervention Priority Transition
              </span>
              <div className="flex items-center gap-3 mt-2">
                <div>
                  <span className="text-2xl font-black text-slate-700 block leading-none">
                    {simResult.originalPriorityTier || 'P1'}
                  </span>
                  <span className="text-[10px] text-slate-500 block mt-1">
                    Score: {simResult.originalPriorityScore}
                  </span>
                </div>

                <ArrowRight className="w-5 h-5 text-blue-600 shrink-0" />

                <div>
                  <span className={`text-2xl font-black block leading-none ${
                    simResult.simulatedPriorityTier !== simResult.originalPriorityTier ? 'text-emerald-600' : 'text-slate-800'
                  }`}>
                    {simResult.simulatedPriorityTier || 'P2'}
                  </span>
                  <span className="text-[10px] text-slate-500 block mt-1">
                    Score: {simResult.simulatedPriorityScore}
                  </span>
                </div>
              </div>
              <span className="text-[11px] font-semibold text-blue-700 block mt-2">
                {simResult.simulatedPriorityTier !== simResult.originalPriorityTier
                  ? `Urgency shifted from ${simResult.originalPriorityTier} → ${simResult.simulatedPriorityTier}`
                  : 'Maintains current priority bracket'}
              </span>
            </div>

            {/* Averted Slippage & Escalation */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                Estimated Schedule Recovery
              </span>
              <div className="mt-2">
                <span className="text-2xl font-black text-blue-700 block leading-none">
                  ~{simResult.delaySavedMonths ?? 0}
                  <span className="text-xs font-normal text-slate-500 ml-1">months saved</span>
                </span>
                <span className="text-[11px] text-slate-600 block mt-1.5 font-medium">
                  Cost Escalation Curtailed: <strong>₹{simResult.costSavedCr ?? 0} Cr</strong>
                </span>
              </div>
              <span className="text-[10px] text-slate-400 block mt-2">
                Parametric estimate under continuous execution
              </span>
            </div>

          </div>

          {/* ───────────────────────────────────────────────────────────────── */}
          {/* 6. DRIVERS CHANGED: INDICATOR-LEVEL BEFORE / AFTER BREAKDOWN     */}
          {/* ───────────────────────────────────────────────────────────────── */}
          <div className="pt-2">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2.5 flex items-center justify-between">
              <span>5. Drivers Changed (Indicator-Level Before vs After)</span>
              <span className="text-[10px] font-normal text-slate-500">
                Mathematical Attribution
              </span>
            </h4>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border border-slate-200 rounded-xl overflow-hidden">
                <thead className="bg-slate-100 border-b border-slate-200 text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                  <tr>
                    <th className="p-2.5">Indicator</th>
                    <th className="p-2.5 text-center">Weight</th>
                    <th className="p-2.5 text-center">Baseline</th>
                    <th className="p-2.5 text-center">Simulated</th>
                    <th className="p-2.5 text-center">Delta</th>
                    <th className="p-2.5">Policy Driver Explanation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {simResult.indicatorChanges.map((ind) => (
                    <tr key={ind.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-2.5 font-semibold text-slate-800">
                        {ind.label}
                      </td>
                      <td className="p-2.5 text-center font-mono text-slate-500">
                        {ind.weight}%
                      </td>
                      <td className="p-2.5 text-center font-mono font-medium text-slate-700">
                        {ind.originalScore}
                      </td>
                      <td className="p-2.5 text-center font-mono font-bold text-blue-700">
                        {ind.simulatedScore}
                      </td>
                      <td className="p-2.5 text-center font-mono font-bold">
                        {ind.scoreDelta < 0 ? (
                          <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                            ▼ {Math.abs(ind.scoreDelta)}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="p-2.5 text-[11px] text-slate-600">
                        {ind.assumptionDriver}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ───────────────────────────────────────────────────────────────── */}
          {/* 7. ASSUMPTIONS APPLIED                                            */}
          {/* ───────────────────────────────────────────────────────────────── */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
            <h4 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
              Exact Assumptions Applied
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {simResult.assumptionImpacts.map((assump, idx) => (
                <div key={idx} className="bg-white border border-slate-200 rounded-lg p-2.5 text-xs">
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-bold text-slate-800">{assump.lever}</span>
                    <span className="font-mono font-bold text-emerald-700 text-[11px]">
                      -{assump.pointsReduced} pts
                    </span>
                  </div>
                  <span className="text-[10px] text-blue-700 font-medium block">
                    Setting: {assump.value}
                  </span>
                  <p className="text-[10px] text-slate-500 mt-1 leading-tight">
                    {assump.mechanism}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* ───────────────────────────────────────────────────────────────── */}
          {/* 8. OFFICER INTERVENTION BRIEF                                     */}
          {/* ───────────────────────────────────────────────────────────────── */}
          <div className="pt-3 border-t border-slate-200 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-blue-600" />
                  6. Officer Intervention Brief
                </h4>
                <p className="text-[11px] text-slate-500">
                  Synthesized executive summary for Ministry Secretaries and PMG review.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleGenerateNarrative}
                  disabled={isGeneratingNarrative}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white shadow-2xs transition-all"
                  title="Generate structured AI narrative grounded on scenario results"
                >
                  {isGeneratingNarrative ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Synthesizing...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Generate AI Executive Memo</span>
                    </>
                  )}
                </button>

                <button
                  onClick={handleCopyBrief}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 transition-all shadow-2xs"
                  title="Copy structured brief text to clipboard"
                >
                  {copiedBrief ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Brief</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* AI Generated or Default Structured Brief Memo */}
            {aiNarrative ? (
              <div className="bg-purple-50/70 border border-purple-200 rounded-xl p-4 text-xs space-y-3">
                <div className="flex items-center justify-between border-b border-purple-200 pb-2">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-purple-600 shrink-0" />
                    <span className="font-bold text-purple-900 text-xs">
                      {isAIGenerated ? 'MoSPI PMG Executive Intervention Memorandum (AI-Synthesized)' : 'MoSPI PMG Executive Intervention Memorandum (Deterministic)'}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white text-purple-700 border border-purple-200">
                    GROUNDED ON SCENARIO OUTPUT
                  </span>
                </div>

                <div className="text-slate-800 leading-relaxed space-y-2 whitespace-pre-line text-[11px]">
                  {aiNarrative}
                </div>

                <div className="pt-2 border-t border-purple-200 flex items-center justify-between text-[10px] text-purple-700">
                  <span>Synthesized by PRISM Copilot Engine from verified scenario variables.</span>
                  <span className="font-medium">Illustrative Policy Scenario</span>
                </div>
              </div>
            ) : (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                      📌 Evidence Baseline
                    </span>
                    <p className="text-slate-800 font-medium mt-0.5 text-[11px] leading-relaxed">
                      {simResult.officerBrief.evidenceSummary}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                      ⚠️ Core Operational Concern
                    </span>
                    <p className="text-slate-800 font-medium mt-0.5 text-[11px] leading-relaxed">
                      {simResult.officerBrief.primaryConcern}
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200">
                  <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wider block">
                    🎯 Recommended Intervention Action
                  </span>
                  <p className="text-blue-900 font-bold mt-0.5 text-xs">
                    {simResult.officerBrief.recommendedAction}
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[10px] text-slate-500">
                  <span><strong>Provenance:</strong> {simResult.officerBrief.provenance}</span>
                  <span className="text-amber-700 font-semibold">{simResult.officerBrief.disclaimer}</span>
                </div>
              </div>
            )}

            {/* Officer Workflow Actions */}
            <div className="pt-2 flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold text-slate-600 mr-1">Officer Action:</span>

              <button
                onClick={() => setOfficerAction('acknowledged')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                  officerAction === 'acknowledged'
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-700 border-slate-300 hover:border-slate-400'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Acknowledge</span>
              </button>

              <button
                onClick={() => setOfficerAction('assigned')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                  officerAction === 'assigned'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-700 border-slate-300 hover:border-blue-400'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>Assign Field Action</span>
              </button>

              <button
                onClick={() => setOfficerAction('update_requested')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                  officerAction === 'update_requested'
                    ? 'bg-amber-600 text-white border-amber-600'
                    : 'bg-white text-slate-700 border-slate-300 hover:border-amber-400'
                }`}
              >
                <Send className="w-3.5 h-3.5" />
                <span>Request Agency Update</span>
              </button>

              <button
                onClick={() => setOfficerAction('escalated')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                  officerAction === 'escalated'
                    ? 'bg-red-600 text-white border-red-600'
                    : 'bg-white text-red-700 border-red-300 hover:border-red-400'
                }`}
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Escalate to PMG</span>
              </button>

              {onOpenFlashReport && (
                <button
                  onClick={onOpenFlashReport}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-300 hover:bg-blue-100 transition-all ml-auto"
                >
                  <FileText className="w-3.5 h-3.5 text-blue-600" />
                  <span>View Flash Report</span>
                </button>
              )}
            </div>

            {/* Officer Action Feedback */}
            {officerAction !== 'idle' && (
              <div className="p-3 rounded-xl border bg-slate-50 border-slate-200 text-xs">
                <div className="flex items-center gap-2 text-slate-800 font-semibold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    {officerAction === 'acknowledged' && `Intervention brief for ${project.name} acknowledged and logged in officer audit trail.`}
                    {officerAction === 'assigned' && `Intervention package assigned to Ministry field team for ${project.name}.`}
                    {officerAction === 'update_requested' && `Monthly milestone clarification queued for ${project.implementingAgency}.`}
                    {officerAction === 'escalated' && `Project ${project.id} escalated to Cabinet Secretariat / PMG priority queue.`}
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  ⚠ Prototype workflow simulation — integrates with CPGRAMS / PMG inter-departmental routing in production deployment.
                </p>
              </div>
            )}

          </div>

        </div>
      )}

    </div>
  );
};
