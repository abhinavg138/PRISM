import React, { useState, useEffect } from 'react';
import {
  X, ShieldAlert, AlertTriangle, TrendingDown, Clock,
  IndianRupee, Sliders, CheckCircle2, ChevronRight, Activity,
  HelpCircle, ArrowRight, Sparkles, AlertCircle, FileText,
  Database, Info, Target, TrendingUp, BarChart3, ClipboardCheck,
  Bell, UserCheck, Send, ChevronDown, ChevronUp,
  Shield, BookOpen, MapPin, Calendar, Zap, Lock
} from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  Tooltip, CartesianGrid, Legend, BarChart, Bar, Cell, ReferenceLine
} from 'recharts';
import { Project, RiskTier, PaimanaObservation } from '../types/index';
import { InterventionLab } from './InterventionLab';

interface ProjectDetailModalProps {
  project: Project | null;
  onClose: () => void;
  onAskCopilotAboutProject: (project: Project) => void;
  onOpenFlashReport?: () => void;
}

// Risk Indicator from PRISM Risk Engine API
interface RiskIndicator {
  id: string;
  label: string;
  description: string;
  rawValue: number | null;
  normalisedScore: number;
  weight: number;
  weightedContribution: number;
  category: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'none';
}

interface RiskAssessmentData {
  riskScore: number;
  riskTier: RiskTier;
  evidenceConfidence: number;
  observationCount: number;
  indicators: RiskIndicator[];
  primaryConcerns: string[];
  assessedAt: string;
  dataSource?: string;
}

// Prototype intervention action state
type InterventionAction = 'idle' | 'acknowledged' | 'assigned' | 'update_requested' | 'escalated';

const MONTH_LABELS: Record<string, string> = {
  '2026-04': 'Apr 2026',
  '2026-05': 'May 2026',
  '2026-06': 'Jun 2026',
  '2026-07': 'Jul 2026',
};

export const ProjectDetailModal: React.FC<ProjectDetailModalProps> = ({
  project,
  onClose,
  onAskCopilotAboutProject,
  onOpenFlashReport
}) => {
  if (!project) return null;

  // Simulation State
  const [landWeeks, setLandWeeks] = useState<number>(0);
  const [liquidityPercent, setLiquidityPercent] = useState<number>(0);
  const [geoBuffer, setGeoBuffer] = useState<number>(0);
  const [fastTrackHPC, setFastTrackHPC] = useState<boolean>(false);

  const [simResult, setSimResult] = useState<any>(null);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'lab' | 'indicators' | 'evidence' | 'scurve' | 'simulation' | 'intervention'>('lab');

  // PRISM Risk Engine data (from /api/projects/:id/risk)
  const [riskAssessment, setRiskAssessment] = useState<RiskAssessmentData | null>(null);
  const [isLoadingRisk, setIsLoadingRisk] = useState<boolean>(false);

  // Raw PAIMANA observations (from /api/projects/:id/history)
  const [observations, setObservations] = useState<PaimanaObservation[]>([]);
  const [isLoadingObs, setIsLoadingObs] = useState<boolean>(false);

  // Priority assessment
  const [priorityData, setPriorityData] = useState<any>(null);

  // Intervention prototype state
  const [interventionAction, setInterventionAction] = useState<InterventionAction>('idle');
  const [interventionNote, setInterventionNote] = useState<string>('');

  // Run simulation
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

  // Fetch PRISM Risk Assessment from Risk Engine
  useEffect(() => {
    if (!project?.id) return;
    setIsLoadingRisk(true);
    fetch(`/api/projects/${project.id}/risk`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d) setRiskAssessment(d); })
      .catch(() => {})
      .finally(() => setIsLoadingRisk(false));
  }, [project.id]);

  // Fetch raw PAIMANA observations
  useEffect(() => {
    if (!project?.id) return;
    setIsLoadingObs(true);
    fetch(`/api/projects/${project.id}/history`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (d) {
          const obs = d.observations || d.monthlyTrend || [];
          setObservations(obs);
        }
      })
      .catch(() => {})
      .finally(() => setIsLoadingObs(false));
  }, [project.id]);

  // Fetch priority assessment
  useEffect(() => {
    fetch(`/api/projects/${project.id}/priority`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d) setPriorityData(d); })
      .catch(() => {});
  }, [project.id]);

  // Run simulation on param change
  useEffect(() => {
    runSimulation();
  }, [project.id, landWeeks, liquidityPercent, geoBuffer, fastTrackHPC]);

  const currentScore = simResult ? simResult.simulatedRiskScore : project.riskScore;
  const currentTier: RiskTier = simResult ? simResult.simulatedRiskTier : project.riskTier;

  const priorityScore = priorityData?.priorityScore ?? project.priorityScore;
  const priorityTier = priorityData?.priorityTier ?? project.priorityTier ?? 'P3';
  const priorityReason = priorityData?.priorityReason ?? project.priorityReason;
  const recommendedAction = priorityData?.recommendedAction ?? project.recommendedAction;

  const isCriticalOrHigh = project.riskTier === 'CRITICAL' || project.riskTier === 'HIGH';

  const getTierColor = (tier: RiskTier) => {
    switch (tier) {
      case 'CRITICAL': return 'text-red-600 bg-red-50 border-red-200';
      case 'HIGH': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'MODERATE': return 'text-amber-600 bg-amber-50 border-amber-200';
      case 'LOW': return 'text-emerald-600 bg-emerald-50 border-emerald-200';
      default: return 'text-slate-600 bg-slate-100 border-slate-200';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-600';
      case 'high': return 'text-orange-600';
      case 'medium': return 'text-amber-600';
      case 'low': return 'text-blue-600';
      default: return 'text-emerald-600';
    }
  };

  const getIndicatorBarColor = (normScore: number) => {
    if (normScore >= 80) return 'bg-red-500';
    if (normScore >= 60) return 'bg-orange-500';
    if (normScore >= 40) return 'bg-amber-500';
    if (normScore >= 20) return 'bg-blue-400';
    return 'bg-emerald-500';
  };

  // Build longitudinal story from observations
  const buildLongitudinalInsights = (): string[] => {
    const insights: string[] = [];
    const sorted = [...observations].sort((a, b) =>
      (a.report_month || '').localeCompare(b.report_month || '')
    );
    if (sorted.length < 2) return insights;

    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const progressDelta = (last.physical_progress_pct ?? 0) - (first.physical_progress_pct ?? 0);
    const spendDelta = (last.cumulative_expenditure_cr ?? 0) - (first.cumulative_expenditure_cr ?? 0);

    // Stagnation detection
    let stagnantCount = 0;
    for (let i = 1; i < sorted.length; i++) {
      const delta = Math.abs((sorted[i].physical_progress_pct ?? 0) - (sorted[i-1].physical_progress_pct ?? 0));
      if (delta <= 0.5) stagnantCount++;
    }

    if (stagnantCount >= sorted.length - 1) {
      insights.push(`PRISM detected persistent progress stagnation across ${stagnantCount} of ${sorted.length - 1} observation intervals (Apr–Jul 2026).`);
    } else if (progressDelta < 2) {
      insights.push(`Physical progress advanced by only ${progressDelta.toFixed(1)} pp across the full Apr–Jul 2026 observation window — well below expected trajectory.`);
    } else {
      insights.push(`Physical progress advanced by ${progressDelta.toFixed(1)} pp from ${first.report_month} to ${last.report_month}.`);
    }

    // Spend vs progress insight
    const expPct = last.expenditure_pct_of_revised_cost ?? 0;
    const physPct = last.physical_progress_pct ?? 0;
    if (expPct - physPct > 10) {
      insights.push(`Expenditure (${expPct.toFixed(1)}% of revised cost) significantly exceeds physical progress (${physPct.toFixed(1)}%), indicating physical-financial divergence.`);
    }

    // Cost revision detection
    if (sorted.length >= 2) {
      const costChange = (last.revised_cost_cr ?? 0) - (first.revised_cost_cr ?? 0);
      if (Math.abs(costChange) > 0.1 * (first.revised_cost_cr ?? 1)) {
        insights.push(`Revised cost changed by ₹${Math.abs(costChange).toLocaleString()} Cr between ${first.report_month} and ${last.report_month}.`);
      }
    }

    return insights;
  };

  const longInsights = buildLongitudinalInsights();

  // Build tier badge for sim outcome
  const SimTierBadge: React.FC<{ tier: RiskTier; label?: string }> = ({ tier, label }) => (
    <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold border ${getTierColor(tier)}`}>
      {label || tier}
    </span>
  );

  const handleInterventionAction = (action: InterventionAction) => {
    setInterventionAction(action);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6">
      <div className="bg-white border border-slate-200 w-full max-w-5xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[93vh]">

        {/* Header Bar */}
        <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-200 flex items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold px-2 py-0.5 rounded bg-blue-600 text-white border border-blue-600">
                {project.derivedSector || project.sector}
              </span>
              <span className="text-xs font-mono text-slate-600">{project.code}</span>
              <span className="text-xs text-slate-400">•</span>
              <span className="text-xs text-slate-700 font-medium">{project.implementingAgency}</span>
              <span className="text-xs text-slate-400">•</span>
              <span className="text-xs text-slate-600">{project.state}</span>
              {project.dataSource === 'PAIMANA' && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  PAIMANA
                </span>
              )}
            </div>
            <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 mt-1 tracking-tight leading-tight">
              {project.name}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Project ID: <span className="font-mono text-slate-700">{project.id}</span>
              {' '}· Ministry/Agency: <strong className="text-slate-700">{project.ministry || project.implementingAgency}</strong>
              {' '}· Last Report: <span className="text-slate-700">{project.lastUpdated}</span>
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => onAskCopilotAboutProject(project)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-all"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Ask Copilot</span>
            </button>
            <button onClick={onClose} className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Risk Authority Banner */}
        <div className="px-5 py-2 bg-slate-900 border-b border-slate-700 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Lock className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span className="text-[11px] text-slate-300 font-medium">
              <span className="text-white font-bold">Risk Authority: PRISM Deterministic Risk Engine</span>
              {' '}— Gemini provides explanation and analytical assistance; it does not calculate or modify the Risk Index.
            </span>
          </div>
          <span className="text-[10px] font-mono text-slate-400 shrink-0">MoSPI PAIMANA · Apr–Jul 2026</span>
        </div>

        {/* Top Summary Banner */}
        <div className="p-4 sm:p-5 bg-white border-b border-slate-200 grid grid-cols-2 md:grid-cols-4 gap-3 items-start">

          {/* PRISM Risk Index */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">PRISM Risk Index</span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className={`text-3xl font-black ${
                project.riskScore == null ? 'text-slate-500' :
                project.riskScore >= 80 ? 'text-red-600' :
                project.riskScore >= 60 ? 'text-orange-600' :
                project.riskScore >= 40 ? 'text-amber-600' : 'text-emerald-600'
              }`}>
                {project.riskScore ?? '—'}
              </span>
              <span className="text-xs text-slate-400 font-medium">/ 100</span>
            </div>
            <div className="mt-1.5 flex items-center gap-1.5">
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${getTierColor(project.riskTier)}`}>
                {project.riskTier}
              </span>
              {riskAssessment && (
                <span className="text-[10px] text-slate-500 font-mono">
                  {Math.round(riskAssessment.evidenceConfidence * 100)}% conf
                </span>
              )}
            </div>
            {simResult && simResult.riskScoreDelta !== 0 && simResult.riskScoreDelta != null && (
              <div className="mt-2 flex items-center gap-1">
                <span className="text-[10px] text-slate-500">Scenario:</span>
                <span className={`text-[11px] font-bold ${simResult.riskScoreDelta < 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {simResult.simulatedRiskScore} ({simResult.riskScoreDelta > 0 ? '+' : ''}{simResult.riskScoreDelta})
                </span>
              </div>
            )}
          </div>

          {/* Intervention Priority */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Intervention Priority</span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className={`text-3xl font-black ${
                priorityTier === 'P1' ? 'text-red-600' :
                priorityTier === 'P2' ? 'text-orange-600' : 'text-emerald-600'
              }`}>
                {priorityTier}
              </span>
              <span className="text-xs text-slate-400">{priorityScore != null ? `· ${priorityScore}/100` : ''}</span>
            </div>
            <div className="mt-1">
              <span className={`text-[10px] font-semibold ${
                priorityTier === 'P1' ? 'text-red-700' :
                priorityTier === 'P2' ? 'text-orange-700' : 'text-slate-600'
              }`}>
                {priorityTier === 'P1' ? 'Immediate Intervention' :
                 priorityTier === 'P2' ? 'Significant Oversight' : 'Routine Monitoring'}
              </span>
            </div>
          </div>

          {/* Budget Exposure */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Budget Exposure</span>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-xl font-bold text-slate-900">₹{project.revisedCostCr.toLocaleString()}</span>
              <span className="text-xs text-slate-500">Cr</span>
            </div>
            <div className="mt-1 text-[11px] space-y-0.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Original:</span>
                <span className="text-slate-700">₹{project.originalCostCr.toLocaleString()} Cr</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Overrun:</span>
                <span className="font-bold text-red-600">+{project.costOverrunPercent}%</span>
              </div>
            </div>
          </div>

          {/* Physical Progress & Spend */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Physical Progress & Spend</span>
            <div className="mt-2 space-y-2">
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-blue-700 font-semibold">Physical</span>
                  <span className="font-bold text-blue-700">{project.physicalProgressPercent}%</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-1.5">
                  <div className="bg-blue-500 h-full rounded-full" style={{ width: `${Math.min(100, project.physicalProgressPercent)}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-purple-700 font-semibold">Expended</span>
                  <span className="font-bold text-purple-700">
                    {project.expenditurePctOfRevisedCost != null
                      ? `${project.expenditurePctOfRevisedCost}%`
                      : `${((project.cumulativeExpenditureCr / (project.revisedCostCr || 1)) * 100).toFixed(1)}%`}
                  </span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-1.5">
                  <div className="bg-purple-500 h-full rounded-full" style={{
                    width: `${Math.min(100, project.expenditurePctOfRevisedCost ?? ((project.cumulativeExpenditureCr / (project.revisedCostCr || 1)) * 100))}%`
                  }} />
                </div>
              </div>
              <div className="text-[10px] text-slate-500">
                Cumulative spend: ₹{project.cumulativeExpenditureCr.toLocaleString()} Cr
              </div>
            </div>
          </div>
        </div>

        {/* Why This Project Needs Attention */}
        {isCriticalOrHigh && (
          <div className="mx-5 mt-3 p-3.5 bg-red-50 border border-red-200 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <ShieldAlert className="w-4 h-4 text-red-600 shrink-0" />
              <span className="text-[11px] font-bold text-red-800 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse" />
                Why This Project Needs Attention
              </span>
              <span className="ml-auto text-[10px] font-mono text-slate-500">
                Confidence: {Math.round((project.evidenceConfidence ?? (riskAssessment?.evidenceConfidence ?? 1)) * 100)}%
                ({riskAssessment?.observationCount ?? project.monthlyTrend?.length ?? 4}/4 observations)
              </span>
            </div>
            <p className="text-xs text-slate-800 font-medium leading-relaxed">
              {priorityReason || 'High risk combined with schedule pressure.'}
            </p>
            {recommendedAction && (
              <div className="mt-2 flex items-start gap-1.5">
                <ChevronRight className="w-3.5 h-3.5 text-blue-600 mt-0.5 shrink-0" />
                <span className="text-[11px] text-blue-800 font-semibold">{recommendedAction}</span>
              </div>
            )}
          </div>
        )}

        {/* Active Early Warning Alert */}
        {project.alert && (
          <div className="mx-5 mt-2 mb-0 p-3 bg-amber-50 border border-amber-200 rounded-xl">
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold inline-flex items-center gap-1 ${
                project.alert.severity === 'CRITICAL' ? 'bg-red-100 text-red-800 border border-red-200' :
                project.alert.severity === 'HIGH' ? 'bg-orange-100 text-orange-800 border border-orange-200' :
                'bg-amber-100 text-amber-800 border border-amber-200'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${project.alert.severity === 'CRITICAL' ? 'bg-red-600 animate-pulse' : 'bg-orange-500'}`} />
                {project.alert.severity} EARLY WARNING
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-white text-slate-800 border border-slate-200">
                {project.alert.alertType}
              </span>
              <span className="ml-auto text-[10px] text-slate-500">Detected: {project.alert.detectedPeriod}</span>
            </div>
            <p className="text-[11px] text-slate-700 font-medium">"{project.alert.evidence}"</p>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="px-5 border-b border-slate-200 bg-slate-50 flex gap-0 overflow-x-auto mt-3">
          {[
            { id: 'lab', label: '🧪 Intervention Lab', badge: 'DECISION SUPPORT' },
            { id: 'indicators', label: '🔬 Risk Indicators', badge: riskAssessment ? `${riskAssessment.indicators.length}` : '' },
            { id: 'evidence', label: '📋 Evidence', badge: observations.length > 0 ? `${observations.length}mo` : '' },
            { id: 'scurve', label: '📈 Longitudinal Story', badge: '' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-2.5 px-3 text-xs font-bold border-b-2 transition-all whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-slate-600 hover:text-slate-800'
              }`}
            >
              <span>{tab.label}</span>
              {tab.badge && (
                <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded-full ${
                  tab.id === 'lab' ? 'bg-blue-100 text-blue-800 font-bold' : 'bg-slate-200 text-slate-700'
                }`}>
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Body Content Area */}
        <div className="p-5 overflow-y-auto flex-1 space-y-5">

          {/* ================================================================= */}
          {/* TAB 0: PRISM INTERVENTION LAB (ORCHESTRATION LAYER)                */}
          {/* ================================================================= */}
          {activeTab === 'lab' && (
            <InterventionLab
              project={project}
              onAskCopilotAboutProject={onAskCopilotAboutProject}
              onOpenFlashReport={onOpenFlashReport}
            />
          )}

          {/* ================================================================= */}
          {/* TAB 1: PRISM RISK INDICATORS                                       */}
          {/* ================================================================= */}
          {activeTab === 'indicators' && (
            <div className="space-y-4">

              {/* Risk Score Attribution Header */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 border border-blue-200 flex items-center justify-center text-blue-700 shrink-0">
                    <BarChart3 className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      PRISM Risk Index Decomposition
                    </h4>
                    <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                      The PRISM Risk Index is the deterministic sum of six evidence-based indicators, each derived exclusively from
                      PAIMANA monthly observations. Every point below shows the indicator score, its weight, and the exact weighted
                      contribution to the composite Risk Index. No AI inference is involved in risk computation.
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-[10px]">
                      <span className="flex items-center gap-1 text-slate-600 font-mono font-bold bg-white px-2 py-1 rounded border border-slate-200">
                        Risk Index = Σ (Indicator Score × Weight / 100)
                      </span>
                      <span className="text-slate-500">Total Weight: 100%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* The 6 PRISM Indicators */}
              {isLoadingRisk ? (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center">
                  <Activity className="w-6 h-6 text-blue-500 animate-spin mx-auto mb-2" />
                  <p className="text-xs text-slate-600">Loading PRISM Risk Engine assessment...</p>
                </div>
              ) : riskAssessment && riskAssessment.indicators.length > 0 ? (
                <div className="space-y-3">
                  {riskAssessment.indicators.map((ind, idx) => (
                    <div key={ind.id} className="bg-white border border-slate-200 rounded-xl p-4 hover:border-slate-300 transition-colors">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-700">
                            {idx + 1}
                          </span>
                          <div>
                            <span className="text-xs font-bold text-slate-900">{ind.label}</span>
                            <span className="ml-2 text-[10px] font-mono text-slate-500">Weight: {ind.weight}%</span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="flex items-center gap-2">
                            <div className="text-right">
                              <span className="text-[10px] text-slate-500 block">Score</span>
                              <span className={`text-sm font-black ${getSeverityColor(ind.severity)}`}>{ind.normalisedScore}/100</span>
                            </div>
                            <div className="w-px h-8 bg-slate-200" />
                            <div className="text-right">
                              <span className="text-[10px] text-slate-500 block">Contribution</span>
                              <span className={`text-sm font-black ${ind.weightedContribution >= 10 ? 'text-red-600' : ind.weightedContribution >= 6 ? 'text-orange-600' : 'text-slate-700'}`}>
                                +{ind.weightedContribution.toFixed(1)} pts
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Indicator Progress Bar */}
                      <div className="mb-2">
                        <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                          <span>LOW RISK</span>
                          <span>HIGH RISK</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden relative">
                          <div
                            className={`h-full rounded-full transition-all duration-700 ${getIndicatorBarColor(ind.normalisedScore)}`}
                            style={{ width: `${ind.normalisedScore}%` }}
                          />
                        </div>
                      </div>

                      {/* Evidence description */}
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        {ind.description}
                      </p>

                      {/* Severity badge */}
                      {ind.severity !== 'none' && (
                        <div className="mt-1.5">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            ind.severity === 'critical' ? 'bg-red-50 text-red-700 border border-red-200' :
                            ind.severity === 'high' ? 'bg-orange-50 text-orange-700 border border-orange-200' :
                            ind.severity === 'medium' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                            'bg-blue-50 text-blue-700 border border-blue-200'
                          }`}>
                            {ind.severity.toUpperCase()} SIGNAL
                          </span>
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Risk Score Total */}
                  <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Composite PRISM Risk Index</span>
                      <span className="text-[11px] text-slate-500 mt-0.5 block">
                        Σ weighted contributions = {riskAssessment.indicators.reduce((s, i) => s + i.weightedContribution, 0).toFixed(1)} pts
                      </span>
                    </div>
                    <div className="text-right">
                      <span className={`text-4xl font-black ${
                        riskAssessment.riskScore >= 80 ? 'text-red-400' :
                        riskAssessment.riskScore >= 60 ? 'text-orange-400' :
                        riskAssessment.riskScore >= 40 ? 'text-amber-400' : 'text-emerald-400'
                      }`}>
                        {riskAssessment.riskScore}
                      </span>
                      <span className="text-slate-500 text-xs"> / 100</span>
                      <div className="mt-0.5">
                        <span className={`text-[11px] font-extrabold px-2 py-0.5 rounded ${getTierColor(riskAssessment.riskTier)}`}>
                          {riskAssessment.riskTier} TIER
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Primary Concerns */}
                  {riskAssessment.primaryConcerns.length > 0 && (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                      <h4 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-2">Primary Risk Concerns</h4>
                      <div className="space-y-2">
                        {riskAssessment.primaryConcerns.map((concern, i) => (
                          <div key={i} className="flex items-start gap-2 text-xs text-slate-700">
                            <span className="w-4 h-4 rounded-full bg-red-100 border border-red-200 flex items-center justify-center text-[9px] font-bold text-red-700 shrink-0 mt-0.5">
                              {i + 1}
                            </span>
                            <span className="leading-relaxed">{concern}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Fallback for DEMO mode or UNRATED projects */
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 text-center">
                  <Activity className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">No Risk Indicator Data</p>
                  <p className="text-[11px] text-slate-500 mt-1 max-w-sm mx-auto">
                    {project.riskScore == null
                      ? 'This project has insufficient PAIMANA observations for PRISM Risk Engine assessment.'
                      : 'Risk indicator breakdown not available for this data mode.'}
                  </p>
                  {project.primaryDelayCause && (
                    <div className="mt-3 p-3 bg-white border border-slate-200 rounded-lg text-left">
                      <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block mb-1">Primary Delay Factor</span>
                      <p className="text-xs text-slate-800">{project.primaryDelayCause}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ================================================================= */}
          {/* TAB 2: EVIDENCE / SOURCE PROVENANCE                                */}
          {/* ================================================================= */}
          {activeTab === 'evidence' && (
            <div className="space-y-4">

              {/* Source Provenance Header */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-700 shrink-0">
                    <Database className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      PAIMANA Source Evidence
                    </h4>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      Source: <strong>MoSPI PAIMANA Monthly Flash Reports, Apr–Jul 2026</strong> ·
                      Project ID: <span className="font-mono">{project.id}</span>
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Every risk claim in PRISM is traceable to the monthly observation records below.
                      No data has been fabricated or imputed.
                    </p>
                  </div>
                </div>
              </div>

              {/* Monthly Observation Records */}
              {isLoadingObs ? (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 text-center">
                  <Database className="w-5 h-5 text-blue-500 animate-pulse mx-auto mb-2" />
                  <p className="text-xs text-slate-600">Loading PAIMANA observations...</p>
                </div>
              ) : observations.length > 0 ? (
                <div className="space-y-3">
                  {[...observations]
                    .sort((a, b) => (a.report_month || '').localeCompare(b.report_month || ''))
                    .map((obs, idx, arr) => {
                      const prevObs = idx > 0 ? arr[idx - 1] : null;
                      const progressDelta = prevObs
                        ? (obs.physical_progress_pct ?? 0) - (prevObs.physical_progress_pct ?? 0)
                        : null;
                      const spendDelta = prevObs
                        ? (obs.cumulative_expenditure_cr ?? 0) - (prevObs.cumulative_expenditure_cr ?? 0)
                        : null;
                      const monthLabel = MONTH_LABELS[obs.report_month] || obs.report_month;

                      return (
                        <div key={obs.report_month || idx} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                          {/* Month Header */}
                          <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Calendar className="w-3.5 h-3.5 text-blue-600" />
                              <span className="text-xs font-bold text-slate-800">{monthLabel}</span>
                              <span className="text-[10px] font-mono text-slate-500">Report Month: {obs.report_month}</span>
                            </div>
                            {idx === arr.length - 1 && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                                LATEST
                              </span>
                            )}
                          </div>

                          {/* Observation Data Grid */}
                          <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
                            <div>
                              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">Physical Progress</span>
                              <div className="flex items-baseline gap-1.5 mt-0.5">
                                <span className="text-base font-bold text-blue-700">{obs.physical_progress_pct ?? '—'}%</span>
                                {progressDelta !== null && (
                                  <span className={`text-[11px] font-semibold ${progressDelta > 0 ? 'text-emerald-600' : progressDelta < 0 ? 'text-red-600' : 'text-slate-500'}`}>
                                    {progressDelta > 0 ? `+${progressDelta.toFixed(2)}` : progressDelta.toFixed(2)} pp
                                  </span>
                                )}
                              </div>
                            </div>

                            <div>
                              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">Cumulative Expenditure</span>
                              <div className="flex items-baseline gap-1.5 mt-0.5">
                                <span className="text-base font-bold text-slate-800">₹{(obs.cumulative_expenditure_cr ?? 0).toLocaleString()}</span>
                                <span className="text-[11px] text-slate-500">Cr</span>
                                {spendDelta !== null && spendDelta !== 0 && (
                                  <span className="text-[11px] font-semibold text-slate-600">
                                    (+₹{spendDelta.toFixed(1)} Cr)
                                  </span>
                                )}
                              </div>
                            </div>

                            <div>
                              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">Expenditure % of Revised Cost</span>
                              <span className="text-base font-bold text-purple-700 mt-0.5 block">
                                {obs.expenditure_pct_of_revised_cost != null
                                  ? `${obs.expenditure_pct_of_revised_cost}%`
                                  : obs.revised_cost_cr > 0
                                    ? `${((obs.cumulative_expenditure_cr / obs.revised_cost_cr) * 100).toFixed(1)}%`
                                    : '—'}
                              </span>
                            </div>

                            <div>
                              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">Original Cost</span>
                              <span className="text-sm font-semibold text-slate-700 mt-0.5 block">
                                ₹{(obs.original_cost_cr ?? 0).toLocaleString()} Cr
                              </span>
                            </div>

                            <div>
                              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">Revised Cost</span>
                              <span className="text-sm font-semibold text-slate-700 mt-0.5 block">
                                ₹{(obs.revised_cost_cr ?? 0).toLocaleString()} Cr
                              </span>
                            </div>

                            <div>
                              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">Target Completion</span>
                              <div className="mt-0.5">
                                <span className="text-sm font-semibold text-slate-700 block">
                                  Rev: {obs.revised_target_completion_mm_yyyy || '—'}
                                </span>
                                <span className="text-[10px] text-slate-500">
                                  Orig: {obs.original_target_completion_mm_yyyy || '—'}
                                </span>
                              </div>
                            </div>

                            {obs.state && (
                              <div>
                                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">State</span>
                                <span className="text-sm font-semibold text-slate-700 mt-0.5 block">{obs.state}</span>
                              </div>
                            )}
                          </div>

                          {/* Source Provenance Footer */}
                          <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 flex items-center gap-2">
                            <BookOpen className="w-3 h-3 text-slate-400" />
                            <span className="text-[10px] text-slate-500">
                              Source: PAIMANA {MONTH_LABELS[obs.report_month] || obs.report_month} Flash Report
                              {obs.row_no && ` · Row: ${obs.row_no}`}
                              {' '}· Project ID: {obs.project_id}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                </div>
              ) : (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center">
                  <Database className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">Observations Not Available</p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Raw PAIMANA monthly observations are not retrievable for this project in the current data mode.
                  </p>
                </div>
              )}

              {/* Project-Level Static Fields */}
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <h4 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-3">Project Registration Data</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  {[
                    { label: 'Implementing Agency', value: project.implementingAgency },
                    { label: 'Sector', value: project.derivedSector || project.sector },
                    { label: 'State', value: project.state },
                    { label: 'Original Start Date', value: project.originalStartDate || '—' },
                    { label: 'Original Completion Date', value: project.originalCompletionDate || '—' },
                    { label: 'Revised Completion Date', value: project.revisedCompletionDate || '—' },
                    { label: 'Time Overrun', value: `${project.timeOverrunMonths} months` },
                    { label: 'PRISM Risk Index', value: project.riskScore != null ? `${project.riskScore}/100 (${project.riskTier})` : 'UNRATED' },
                    { label: 'Evidence Confidence', value: project.evidenceConfidence != null ? `${Math.round(project.evidenceConfidence * 100)}%` : '—' },
                  ].map(field => (
                    <div key={field.label}>
                      <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">{field.label}</span>
                      <span className="font-medium text-slate-800 mt-0.5 block">{field.value}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 pt-2 border-t border-slate-100 flex items-center gap-2">
                  <BookOpen className="w-3 h-3 text-slate-400" />
                  <span className="text-[10px] text-slate-500">
                    Source: MoSPI PAIMANA Monthly Flash Reports, Apr–Jul 2026 · Project ID: {project.id}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* TAB 3: SCENARIO POLICY SIMULATION                                  */}
          {/* ================================================================= */}
          {activeTab === 'simulation' && (
            <div className="space-y-4">

              {/* Illustrative Scenario Disclaimer */}
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider block">
                    Illustrative Policy Scenario — Not an Observed Forecast
                  </span>
                  <p className="text-[11px] text-amber-700 mt-0.5 leading-relaxed">
                    This tool simulates the sensitivity of the PRISM Risk Index to hypothetical policy interventions using
                    rule-based multipliers. It does not predict actual future outcomes and does not modify the official Risk Index.
                    The official PRISM Risk Index is always derived exclusively from verified PAIMANA observations.
                  </p>
                </div>
              </div>

              {project.riskScore == null ? (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center">
                  <Sliders className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                  <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Simulation Requires Risk Score</h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    Policy scenario simulation requires a computed PRISM Risk Index. This project is currently UNRATED.
                  </p>
                </div>
              ) : (
                <>
                  {/* CURRENT vs SCENARIO Comparison Banner */}
                  {simResult && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">CURRENT (Official)</span>
                        <div className="flex items-baseline gap-1 mt-1">
                          <span className={`text-3xl font-black ${
                            simResult.originalRiskScore >= 80 ? 'text-red-600' :
                            simResult.originalRiskScore >= 60 ? 'text-orange-600' :
                            simResult.originalRiskScore >= 40 ? 'text-amber-600' : 'text-emerald-600'
                          }`}>{simResult.originalRiskScore}</span>
                          <span className="text-slate-400 text-xs">/ 100</span>
                        </div>
                        <SimTierBadge tier={simResult.originalRiskTier} />
                        <div className="mt-1 text-[10px] text-slate-500">
                          Priority: <span className="font-bold">{priorityTier}</span>
                        </div>
                      </div>
                      <div className={`border rounded-xl p-4 ${
                        simResult.riskScoreDelta < 0 ? 'bg-emerald-50 border-emerald-200' :
                        simResult.riskScoreDelta > 0 ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'
                      }`}>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">SCENARIO (Illustrative)</span>
                        <div className="flex items-baseline gap-1 mt-1">
                          <span className={`text-3xl font-black ${
                            simResult.simulatedRiskScore >= 80 ? 'text-red-600' :
                            simResult.simulatedRiskScore >= 60 ? 'text-orange-600' :
                            simResult.simulatedRiskScore >= 40 ? 'text-amber-600' : 'text-emerald-600'
                          }`}>{simResult.simulatedRiskScore}</span>
                          <span className="text-slate-400 text-xs">/ 100</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          {simResult.riskScoreDelta !== 0 && (
                            <span className={`text-[11px] font-bold ${simResult.riskScoreDelta < 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                              {simResult.riskScoreDelta > 0 ? '+' : ''}{simResult.riskScoreDelta} pts
                            </span>
                          )}
                        </div>
                        {simResult.originalRiskTier !== simResult.simulatedRiskTier && (
                          <div className="mt-1.5 text-[10px] font-semibold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded inline-block">
                            Tier change: {simResult.originalRiskTier} → {simResult.simulatedRiskTier}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {simResult && simResult.riskScoreDelta < 0 && (
                    <div className="text-[11px] text-slate-600 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                      <Info className="w-3.5 h-3.5 inline mr-1 text-blue-600" />
                      Scenario indicates that the modeled interventions could reduce intervention severity.
                      This is a rule-based sensitivity illustration, not a confirmed outcome.
                    </div>
                  )}

                  {/* Slider Controls */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                      <div className="flex justify-between items-center text-xs mb-2">
                        <span className="font-bold text-slate-800">Expedite Land & Clearances</span>
                        <span className="text-blue-600 font-bold font-mono">+{landWeeks} Weeks</span>
                      </div>
                      <input type="range" min="0" max="24" step="2" value={landWeeks}
                        onChange={(e) => setLandWeeks(Number(e.target.value))}
                        className="w-full accent-amber-500 cursor-pointer" />
                      <span className="text-[10px] text-slate-500 block mt-1">
                        Accelerates revenue surveys and statutory approvals via inter-departmental task force.
                      </span>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                      <div className="flex justify-between items-center text-xs mb-2">
                        <span className="font-bold text-slate-800">Contractor Working Capital Advance</span>
                        <span className="text-blue-600 font-bold font-mono">+{liquidityPercent}%</span>
                      </div>
                      <input type="range" min="0" max="50" step="5" value={liquidityPercent}
                        onChange={(e) => setLiquidityPercent(Number(e.target.value))}
                        className="w-full accent-blue-500 cursor-pointer" />
                      <span className="text-[10px] text-slate-500 block mt-1">
                        Releases milestone escrow cash injection to prevent subcontractor demobilization.
                      </span>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                      <div className="flex justify-between items-center text-xs mb-2">
                        <span className="font-bold text-slate-800">Geotechnical / Weather Engineering Support</span>
                        <span className="text-emerald-600 font-bold font-mono">{geoBuffer}%</span>
                      </div>
                      <input type="range" min="0" max="100" step="10" value={geoBuffer}
                        onChange={(e) => setGeoBuffer(Number(e.target.value))}
                        className="w-full accent-emerald-500 cursor-pointer" />
                      <span className="text-[10px] text-slate-500 block mt-1">
                        Deploys specialized geological support or flood/weather engineering buffers.
                      </span>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col justify-between">
                      <div className="flex items-center justify-between text-xs mb-2">
                        <span className="font-bold text-slate-800">Cabinet PMG Fast-Track Review</span>
                        <input type="checkbox" checked={fastTrackHPC} onChange={(e) => setFastTrackHPC(e.target.checked)}
                          className="w-4 h-4 rounded accent-amber-500 cursor-pointer" />
                      </div>
                      <span className="text-[10px] text-slate-500 block">
                        Bypasses bureaucratic utility shifting disputes with Chief Secretary orders.
                      </span>
                      <div className="mt-2 text-right">
                        <button onClick={() => { setLandWeeks(0); setLiquidityPercent(0); setGeoBuffer(0); setFastTrackHPC(false); }}
                          className="text-[11px] text-slate-500 hover:text-slate-800 underline">
                          Reset to Baseline
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Scenario Policy Insights */}
                  {simResult && simResult.actionableInsights && simResult.actionableInsights.length > 0 && (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                      <h4 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-2">Scenario Reasoning</h4>
                      <ul className="space-y-1.5">
                        {simResult.actionableInsights.map((insight: string, idx: number) => (
                          <li key={idx} className="text-xs text-slate-700 flex items-start gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 mt-0.5 shrink-0" />
                            <span>{insight}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ================================================================= */}
          {/* TAB 4: LONGITUDINAL STORY / S-CURVE                                */}
          {/* ================================================================= */}
          {activeTab === 'scurve' && (
            <div className="space-y-4">

              {/* APR → JUL Progress Story */}
              {observations.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">
                    Longitudinal Project Story — Apr → Jul 2026
                  </h3>

                  {/* Timeline Track */}
                  <div className="flex items-stretch gap-0 overflow-x-auto pb-2">
                    {[...observations]
                      .sort((a, b) => (a.report_month || '').localeCompare(b.report_month || ''))
                      .map((obs, idx, arr) => {
                        const prevObs = idx > 0 ? arr[idx - 1] : null;
                        const delta = prevObs
                          ? (obs.physical_progress_pct ?? 0) - (prevObs.physical_progress_pct ?? 0)
                          : null;
                        const isStagnant = delta !== null && Math.abs(delta) <= 0.5;
                        const isLast = idx === arr.length - 1;

                        return (
                          <div key={obs.report_month} className="flex items-stretch">
                            <div className={`flex-1 min-w-[120px] p-3 rounded-xl border ${
                              isLast ? 'bg-blue-50 border-blue-200' :
                              isStagnant ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-200'
                            }`}>
                              <span className="text-[10px] font-bold text-slate-500 block">
                                {MONTH_LABELS[obs.report_month] || obs.report_month}
                              </span>
                              <span className="text-lg font-black text-blue-700 block mt-0.5">
                                {obs.physical_progress_pct ?? '—'}%
                              </span>
                              {delta !== null && (
                                <span className={`text-[10px] font-bold block mt-0.5 ${
                                  isStagnant ? 'text-amber-600' :
                                  delta > 0 ? 'text-emerald-600' : 'text-red-600'
                                }`}>
                                  {isStagnant ? '⚠ Stagnant' : delta > 0 ? `▲ +${delta.toFixed(1)} pp` : `▼ ${delta.toFixed(1)} pp`}
                                </span>
                              )}
                              <span className="text-[10px] text-slate-500 block mt-1">
                                ₹{(obs.cumulative_expenditure_cr ?? 0).toLocaleString()} Cr
                              </span>
                            </div>
                            {!isLast && (
                              <div className="flex items-center px-1">
                                <ArrowRight className="w-4 h-4 text-slate-400" />
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>

                  {/* Longitudinal Insights */}
                  {longInsights.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {longInsights.map((insight, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs text-slate-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                          <Shield className="w-3.5 h-3.5 text-blue-600 mt-0.5 shrink-0" />
                          <span>{insight}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* S-Curve Chart */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
                <div className="mb-3">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Progress S-Curve & Cumulative Financial Burn</h3>
                  <p className="text-[11px] text-slate-600 mt-0.5">Physical progress % vs cumulative capital expenditure (₹ Cr), Apr–Jul 2026</p>
                </div>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={observations.length > 0 ? observations.map(obs => ({
                      month: MONTH_LABELS[obs.report_month] || obs.report_month,
                      actualPercent: obs.physical_progress_pct,
                      financialExpenditureCr: obs.cumulative_expenditure_cr,
                      expenditurePctOfRevisedCost: obs.expenditure_pct_of_revised_cost,
                    })) : project.monthlyTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="month" stroke="#64748b" tick={{ fontSize: 11 }} />
                      <YAxis yAxisId="left" stroke="#64748b" tick={{ fontSize: 11 }} unit="%" domain={[0, 100]} />
                      <YAxis yAxisId="right" orientation="right" stroke="#64748b" tick={{ fontSize: 11 }} unit=" Cr" />
                      <Tooltip contentStyle={{ backgroundColor: '#fff', borderColor: '#e2e8f0', borderRadius: '8px', fontSize: '12px' }} />
                      <Legend />
                      <Line yAxisId="left" type="monotone" dataKey="actualPercent" name="Physical Progress %" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                      <Line yAxisId="right" type="monotone" dataKey="financialExpenditureCr" name="Cumulative Spend (₹ Cr)" stroke="#a855f7" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Mitigation Roadmap if present */}
              {project.mitigationRoadmap && project.mitigationRoadmap.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">Mitigation Roadmap</h3>
                  <div className="space-y-2">
                    {project.mitigationRoadmap.map((m) => (
                      <div key={m.id} className="flex items-start justify-between gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                              m.status === 'Completed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                              m.status === 'In Progress' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                              'bg-slate-100 text-slate-600'
                            }`}>{m.status}</span>
                            <span className="text-[10px] text-slate-500">Target: {m.timeframe}</span>
                          </div>
                          <p className="text-xs font-semibold text-slate-800 mt-1">{m.action}</p>
                          <p className="text-[11px] text-slate-600 mt-0.5">{m.impact}</p>
                        </div>
                        <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded border border-emerald-200 shrink-0">
                          -{m.riskReductionPoints} pts
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================================================================= */}
          {/* TAB 5: INTERVENTION BRIEF                                          */}
          {/* ================================================================= */}
          {activeTab === 'intervention' && (
            <div className="space-y-4">

              {/* Intervention Brief Header */}
              <div className={`p-5 rounded-xl border ${
                project.riskTier === 'CRITICAL' ? 'bg-red-50 border-red-200' :
                project.riskTier === 'HIGH' ? 'bg-orange-50 border-orange-200' :
                'bg-slate-50 border-slate-200'
              }`}>
                <div className="flex items-center gap-2 mb-4">
                  <ShieldAlert className={`w-5 h-5 ${project.riskTier === 'CRITICAL' ? 'text-red-600' : 'text-orange-600'}`} />
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest">Intervention Brief</h3>
                  <span className="ml-auto text-[10px] font-mono text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded">
                    PROTOTYPE WORKFLOW
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Project</span>
                    <span className="text-xs font-bold text-slate-900 mt-0.5 block line-clamp-2">{project.name}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Project ID</span>
                    <span className="text-xs font-mono font-bold text-slate-800 mt-0.5 block">{project.id}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Risk</span>
                    <span className={`text-sm font-black mt-0.5 block ${
                      project.riskTier === 'CRITICAL' ? 'text-red-600' :
                      project.riskTier === 'HIGH' ? 'text-orange-600' : 'text-slate-700'
                    }`}>
                      {project.riskScore ?? '—'} / 100
                    </span>
                    <SimTierBadge tier={project.riskTier} />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Priority</span>
                    <span className={`text-sm font-black mt-0.5 block ${
                      priorityTier === 'P1' ? 'text-red-600' :
                      priorityTier === 'P2' ? 'text-orange-600' : 'text-slate-700'
                    }`}>{priorityTier}</span>
                  </div>
                </div>

                {/* Why Intervention is Required */}
                <div className="bg-white border border-slate-200 rounded-lg p-3.5 mb-3">
                  <h4 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-2">Why Intervention Is Required</h4>
                  {riskAssessment ? (
                    <ul className="space-y-1.5">
                      {riskAssessment.indicators
                        .filter(ind => ind.severity === 'critical' || ind.severity === 'high')
                        .slice(0, 4)
                        .map((ind, i) => (
                          <li key={ind.id} className="flex items-start gap-2 text-xs">
                            <span className="w-4 h-4 rounded-full bg-red-100 border border-red-200 flex items-center justify-center text-[9px] font-bold text-red-700 shrink-0 mt-0.5">
                              {i + 1}
                            </span>
                            <div>
                              <span className="font-bold text-slate-800">{ind.label}</span>
                              <span className="text-slate-500 ml-1.5 text-[10px]">(Score: {ind.normalisedScore}/100, Contribution: +{ind.weightedContribution.toFixed(1)} pts)</span>
                            </div>
                          </li>
                        ))}
                      {riskAssessment.indicators.filter(ind => ind.severity === 'critical' || ind.severity === 'high').length === 0 && (
                        <li className="text-xs text-slate-600">{priorityReason || 'High risk combined with schedule pressure.'}</li>
                      )}
                    </ul>
                  ) : (
                    <p className="text-xs text-slate-700">{priorityReason || 'High risk combined with schedule pressure.'}</p>
                  )}
                </div>

                {/* Evidence Summary */}
                <div className="bg-white border border-slate-200 rounded-lg p-3.5 mb-3">
                  <h4 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-2">Evidence Summary</h4>
                  {observations.length > 0 ? (() => {
                    const sorted = [...observations].sort((a, b) => (a.report_month || '').localeCompare(b.report_month || ''));
                    const first = sorted[0];
                    const last = sorted[sorted.length - 1];
                    return (
                      <div className="text-[11px] text-slate-700 space-y-1">
                        <p>Observation window: <strong>{MONTH_LABELS[first?.report_month] || first?.report_month} → {MONTH_LABELS[last?.report_month] || last?.report_month}</strong> ({observations.length} monthly snapshots)</p>
                        <p>Physical progress: <strong>{first?.physical_progress_pct}% → {last?.physical_progress_pct}%</strong> ({((last?.physical_progress_pct ?? 0) - (first?.physical_progress_pct ?? 0)) >= 0 ? '+' : ''}{((last?.physical_progress_pct ?? 0) - (first?.physical_progress_pct ?? 0)).toFixed(2)} pp over period)</p>
                        <p>Cumulative expenditure: <strong>₹{(last?.cumulative_expenditure_cr ?? 0).toLocaleString()} Cr</strong> ({last?.expenditure_pct_of_revised_cost != null ? `${last.expenditure_pct_of_revised_cost}%` : '—'} of revised cost)</p>
                        <p className="text-[10px] text-slate-500 pt-1">Source: PAIMANA {MONTH_LABELS[last?.report_month] || 'Jul 2026'} Flash Report · Project ID: {project.id}</p>
                      </div>
                    );
                  })() : (
                    <p className="text-[11px] text-slate-600">
                      Monitoring period: Apr–Jul 2026 · Physical Progress: {project.physicalProgressPercent}% · Budget: ₹{project.revisedCostCr.toLocaleString()} Cr
                    </p>
                  )}
                </div>

                {/* Recommended Action */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3.5 mb-4">
                  <h4 className="text-[11px] font-bold text-blue-800 uppercase tracking-wider mb-1">Recommended Action</h4>
                  <p className="text-xs font-semibold text-blue-900">
                    {recommendedAction || 'Maintain routine milestone & expenditure monitoring'}
                  </p>
                  <span className="text-[10px] text-blue-600 mt-1 block">
                    Source: PRISM Deterministic Priority Engine (evidence-based rule assessment)
                  </span>
                </div>

                {/* Prototype Action Buttons */}
                <div>
                  <h4 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-2">Officer Actions</h4>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => handleInterventionAction('acknowledged')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                        interventionAction === 'acknowledged'
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-700 border-slate-300 hover:border-slate-400'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Acknowledge
                    </button>
                    <button
                      onClick={() => handleInterventionAction('assigned')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                        interventionAction === 'assigned'
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-slate-700 border-slate-300 hover:border-blue-400'
                      }`}
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      Assign Intervention
                    </button>
                    <button
                      onClick={() => handleInterventionAction('update_requested')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                        interventionAction === 'update_requested'
                          ? 'bg-amber-600 text-white border-amber-600'
                          : 'bg-white text-slate-700 border-slate-300 hover:border-amber-400'
                      }`}
                    >
                      <Send className="w-3.5 h-3.5" />
                      Request Agency Update
                    </button>
                    <button
                      onClick={() => handleInterventionAction('escalated')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                        interventionAction === 'escalated'
                          ? 'bg-red-600 text-white border-red-600'
                          : 'bg-white text-red-700 border-red-300 hover:border-red-400'
                      }`}
                    >
                      <ShieldAlert className="w-3.5 h-3.5" />
                      Escalate to PMG
                    </button>
                    {onOpenFlashReport && (
                      <button
                        onClick={onOpenFlashReport}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-300 transition-all"
                        title="Open MoSPI Executive Flash Report"
                      >
                        <FileText className="w-3.5 h-3.5 text-blue-600" />
                        <span>View 1-Page Flash Report</span>
                      </button>
                    )}
                  </div>

                  {/* Action Feedback */}
                  {interventionAction !== 'idle' && (
                    <div className={`mt-3 p-3 rounded-lg border text-xs font-medium ${
                      interventionAction === 'escalated' ? 'bg-red-50 border-red-200 text-red-800' :
                      interventionAction === 'assigned' ? 'bg-blue-50 border-blue-200 text-blue-800' :
                      interventionAction === 'update_requested' ? 'bg-amber-50 border-amber-200 text-amber-800' :
                      'bg-slate-50 border-slate-200 text-slate-700'
                    }`}>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          {interventionAction === 'acknowledged' && `Intervention brief for ${project.name} acknowledged. Logged as reviewed.`}
                          {interventionAction === 'assigned' && `Intervention assigned for ${project.name}. Field officer notification queued.`}
                          {interventionAction === 'update_requested' && `Agency update request queued for ${project.implementingAgency}.`}
                          {interventionAction === 'escalated' && `Project ${project.id} escalated to PMG review queue.`}
                        </span>
                      </div>
                      <p className="mt-1 text-[10px] opacity-70">
                        ⚠ Prototype workflow — no actual government notification has been sent.
                        In production, this would integrate with the CPGRAMS / PMG notification system.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* DETECT → EXPLAIN → PRIORITIZE → ACT Chain */}
              <div className="bg-slate-900 border border-slate-700 rounded-xl p-4">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">PRISM Intelligence Chain</h4>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {[
                    { label: 'DATA', desc: 'PAIMANA Observations', color: 'bg-blue-900 text-blue-300 border-blue-700' },
                    { label: 'RISK', desc: 'PRISM Risk Engine', color: 'bg-red-900 text-red-300 border-red-700' },
                    { label: 'EXPLAIN', desc: 'Risk Indicators + Evidence', color: 'bg-orange-900 text-orange-300 border-orange-700' },
                    { label: 'PRIORITY', desc: 'Priority Engine', color: 'bg-purple-900 text-purple-300 border-purple-700' },
                    { label: 'SCENARIO', desc: 'Policy Simulation', color: 'bg-indigo-900 text-indigo-300 border-indigo-700' },
                    { label: 'ACT', desc: 'Intervention Brief', color: 'bg-emerald-900 text-emerald-300 border-emerald-700' },
                  ].map((step, idx, arr) => (
                    <React.Fragment key={step.label}>
                      <div className={`px-3 py-2 rounded-lg border text-center ${step.color}`}>
                        <div className="font-black text-sm">{step.label}</div>
                        <div className="text-[10px] opacity-80 mt-0.5">{step.desc}</div>
                      </div>
                      {idx < arr.length - 1 && (
                        <ArrowRight className="w-4 h-4 text-slate-500" />
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>

              {/* Not HIGH/CRITICAL notice */}
              {!isCriticalOrHigh && project.riskTier !== 'CRITICAL' && project.riskTier !== 'HIGH' && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                  <p className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Routine Monitoring</p>
                  <p className="text-[11px] text-emerald-700 mt-1">
                    This project's current PRISM Risk Index ({project.riskScore ?? '—'}) does not trigger a formal intervention brief.
                    Standard periodic monitoring applies under PMG cadence.
                  </p>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Modal Bottom Sticky Actions Bar */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <div className="text-[11px] text-slate-500 hidden sm:flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-slate-400" />
            <span>Deterministic scores based on MoSPI PAIMANA longitudinal data.</span>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            {onOpenFlashReport && (
              <button
                onClick={onOpenFlashReport}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 transition-all shadow-2xs"
                title="Open MoSPI Executive Flash Report"
              >
                <FileText className="w-3.5 h-3.5 text-blue-600" />
                <span>Flash Report</span>
              </button>
            )}
            <button
              onClick={() => onAskCopilotAboutProject(project)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-all shadow-2xs"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Ask Copilot</span>
            </button>
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-200 hover:bg-slate-300 text-slate-800 transition-colors"
            >
              Close
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
