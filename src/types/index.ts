export type RiskTier = 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW' | 'UNRATED';

export type PriorityTier = 'P1' | 'P2' | 'P3';

export interface PriorityEvidence {
  physicalProgressPercent: number;
  cumulativeExpenditureCr: number;
  revisedCostCr: number;
  originalCostCr: number;
  costOverrunPercent: number;
  expenditurePctOfRevisedCost: number;
  timeOverrunMonths: number;
  targetCompletionDate: string;
  originalCompletionDate: string;
  consecutiveStagnantMonths: number;
  recentProgressDelta: number | null;
  observationCount: number;
}

export interface ProjectPriority {
  projectId: string;
  projectName: string;
  code: string;
  sector: string;
  state: string;
  implementingAgency: string;
  priorityScore: number;
  priorityTier: PriorityTier;
  riskScore: number;
  riskTier: RiskTier;
  evidenceConfidence: number;
  urgency: number;
  recentDeterioration: number;
  primaryRiskDriver: string;
  topRiskDrivers: string[];
  priorityReason: string;
  recommendedAction: string;
  evidence?: PriorityEvidence;
  assessedAt?: string;
}

export interface SectorStat {
  sector: string;
  totalProjects: number;
  avgPhysicalProgress: number;
  highRiskProjects: number;
  criticalProjects: number;
  avgRiskScore: number;
  totalBudgetCr: number;
}

export type SectorType = 
  | 'Railways' 
  | 'Road Transport & Highways' 
  | 'Power & Energy' 
  | 'Petroleum & Gas' 
  | 'Urban Affairs & Metro' 
  | 'Ports & Shipping'
  | 'Telecommunications'
  | 'Coal & Mining'
  | 'Civil Aviation'
  | 'Water Resources'
  | 'Steel & Heavy Industry'
  | 'Other Infrastructure'
  | string;

export interface LocationGeo {
  lat: number | null;
  lng: number | null;
  city: string;
  state: string;
}

export interface RiskDriver {
  id: string;
  feature: string;
  label: string;
  shapValue: number; // Positive increases risk, negative decreases
  description: string;
  category: 'Land Acquisition' | 'Clearances & Approvals' | 'Contractor & Cashflow' | 'Geological & Weather' | 'Scope & Design' | 'Coordination';
  severity: 'critical' | 'high' | 'medium' | 'low';
}

export interface MitigationStep {
  id: string;
  action: string;
  timeframe: string;
  impact: string;
  responsibleParty: string;
  status: 'Pending' | 'In Progress' | 'Completed';
  riskReductionPoints: number;
}

export interface ProgressHistoryPoint {
  month: string;
  reportMonth?: string;
  plannedPercent?: number | null;
  actualPercent: number;
  financialExpenditureCr: number;
  expenditurePctOfRevisedCost?: number | null;
}

export interface AuditEvent {
  id: string;
  date: string;
  event: string;
  reportedBy: string;
  type: 'warning' | 'milestone' | 'audit' | 'delay';
}

export interface PaimanaObservation {
  report_month: string;
  report_page?: number | string;
  row_no?: number | string;
  project_id: string;
  project_name: string;
  agency: string;
  legacy_ocms_code?: string;
  pmgid?: string;
  state: string;
  approval_start_mm_yyyy?: string;
  revised_start_mm_yyyy?: string;
  original_target_completion_mm_yyyy?: string;
  revised_target_completion_mm_yyyy?: string;
  original_cost_cr: number;
  revised_cost_cr: number;
  cumulative_expenditure_cr: number;
  physical_progress_pct: number;
  source?: string;
  source_file?: string;
  expenditure_pct_of_revised_cost?: number;
  cost_revision_pct?: number;
  physical_progress_change_mom_pct_points?: number;
  expenditure_change_mom_cr?: number;
  revised_cost_change_mom_cr?: number;
  progress_change?: number;
  expenditure_change?: number;
  expenditure_pct?: number;
  progress_expenditure_gap?: number;
}

export interface Project {
  id: string;
  name: string;
  code: string;
  sector: SectorType;
  /** Internal classification derived from agency. Not an official PAIMANA field. */
  derivedSector?: string;
  ministry?: string;
  state: string;
  implementingAgency: string;
  location: LocationGeo;
  originalCostCr: number;
  revisedCostCr: number;
  cumulativeExpenditureCr: number;
  costOverrunPercent: number;
  /** Actual PAIMANA field: spending as % of revised cost */
  expenditurePctOfRevisedCost?: number | null;
  originalStartDate: string;
  originalCompletionDate: string;
  revisedCompletionDate: string;
  timeOverrunMonths: number;
  physicalProgressPercent: number;
  /** Optional/nullable. Keep physical progress and expenditure clearly separate. */
  financialProgressPercent?: number | null;
  /** null for unrated PAIMANA projects where risk has not been calculated yet */
  riskScore: number | null;
  riskTier: RiskTier;
  predictedDelayMonths?: number | null;
  predictedCostEscalationCr?: number | null;
  confidenceScore?: number | null;
  primaryDelayCause?: string;
  lastUpdated: string;
  topRiskDrivers: RiskDriver[];
  mitigationRoadmap: MitigationStep[];
  monthlyTrend: ProgressHistoryPoint[];
  auditTrail: AuditEvent[];
  /** Intervention Priority Queue fields (Phase 3A) */
  priorityScore?: number | null;
  priorityTier?: PriorityTier | null;
  priorityReason?: string;
  recommendedAction?: string;
  primaryRiskDriver?: string;
  urgency?: number;
  evidenceConfidence?: number;
  /** Active early warning alert if project shows empirical indicators requiring attention */
  alert?: EarlyWarningAlert | null;
  dataSource?: 'PAIMANA' | 'DEMO';
  /** Full raw PAIMANA record for complete source transparency */
  rawPaimana?: PaimanaObservation;
  // Simulation baseline overrides
  simulationFactors?: {
    landAcquisitionBoostMonths?: number;
    clearanceFastTrack?: boolean;
    cashflowLiquidityPercent?: number;
    geologicalSupportLevel?: number;
  };
}

export type AlertType =
  | 'Progress Stagnation'
  | 'Deteriorating Progress'
  | 'Schedule Pressure'
  | 'Cost Escalation'
  | 'Physical-Financial Divergence'
  | 'High/Critical Risk';

export type AlertSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM';

export interface EarlyWarningAlert {
  id: string;
  projectId: string;
  projectName: string;
  projectCode: string;
  state: string;
  sector: string;
  implementingAgency?: string;
  alertType: AlertType;
  severity: AlertSeverity;
  evidence: string;
  detectedPeriod: string;
  recommendedAttention: string;
  riskScore: number | null;
  priorityScore: number | null;
  priorityTier?: PriorityTier | null;
}

export interface PortfolioKPIs {
  totalProjects: number;
  criticalProjects: number;
  highRiskProjects: number;
  moderateRiskProjects: number;
  lowRiskProjects: number;
  unratedProjects?: number;
  p1Projects?: number;
  p2Projects?: number;
  p3Projects?: number;
  totalBudgetCr: number;
  budgetAtRiskCr: number;
  averageDelayMonths: number;
  averageCostEscalationPercent: number;
  activeEscalationsCount: number;
  averageRiskScore?: number;
  averagePhysicalProgress?: number;
}

export interface FilterState {
  search: string;
  sector: string;
  state: string;
  riskTier: string;
  minCost: number;
  maxCost: number;
  sortBy: 'riskScore' | 'costOverrun' | 'timeOverrun' | 'revisedCostCr' | 'name';
  sortDirection: 'asc' | 'desc';
}

export interface UserRole {
  id: string;
  name: string;
  title: string;
  department: string;
  badge: string;
}

export interface AICopilotMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  groundedProjects?: Array<{
    id: string;
    name: string;
    riskScore: number;
    riskTier: RiskTier;
    priorityTier?: string;
    state?: string;
    sector?: string;
    physicalProgressPercent?: number;
    primaryRiskDriver?: string;
  }>;
  suggestedQuestions?: string[];
  totalMatching?: number;
  displayedCount?: number;
}

export interface FullAnalyticsData {
  dataSource?: 'PAIMANA' | 'DEMO';
  kpis: PortfolioKPIs;
  observationsCoverage: {
    totalObservations: number;
    observationsByMonth: Record<string, number>;
    coverageCounts: Record<string, number>;
  };
  riskDistribution: Array<{
    name: string;
    tier: string;
    count: number;
    percent: number;
    color: string;
  }>;
  priorityDistribution: Array<{
    name: string;
    tier: string;
    count: number;
    percent: number;
    color: string;
  }>;
  sectorAnalytics: Array<{
    sector: string;
    projectCount: number;
    portfolioPercent: number;
    originalCostCr: number;
    revisedCostCr: number;
    costOverrunPercent: number;
    avgPhysicalProgress: number;
    avgRiskScore: number;
    criticalProjects: number;
    highRiskProjects: number;
    avgDelayMonths: number;
  }>;
  stateAnalytics: Array<{
    state: string;
    projectCount: number;
    totalBudgetCr: number;
    avgRiskScore: number;
    criticalCount: number;
    highCount: number;
    avgPhysicalProgress: number;
  }>;
  costEscalation: {
    totalOriginalCostCr: number;
    totalRevisedCostCr: number;
    totalEscalationCr: number;
    overallOverrunPercent: number;
    brackets: Array<{
      name: string;
      count: number;
      percent: number;
      color: string;
    }>;
  };
  executionIndicators: {
    prolongedStagnationCount: number;
    stagnationRate: number;
    divergenceCount: number;
    divergenceRate: number;
    criticalUrgencyCount: number;
  };
}

export interface IndicatorChange {
  id: string;
  label: string;
  weight: number;
  originalScore: number;
  simulatedScore: number;
  scoreDelta: number;
  originalContribution: number;
  simulatedContribution: number;
  assumptionDriver: string;
}

export interface AssumptionImpact {
  lever: string;
  value: string;
  pointsReduced: number;
  mechanism: string;
}

export interface InterventionBriefData {
  projectName: string;
  projectId: string;
  sector: string;
  state: string;
  agency: string;
  currentRisk: { score: number | null; tier: RiskTier };
  currentPriority: { score: number | null; tier: PriorityTier | null };
  simulatedRisk: { score: number | null; tier: RiskTier };
  simulatedPriority: { score: number | null; tier: PriorityTier | null };
  evidenceSummary: string;
  primaryConcern: string;
  recommendedAction: string;
  scenarioAssumptions: AssumptionImpact[];
  indicatorChanges: IndicatorChange[];
  provenance: string;
  disclaimer: string;
  aiExecutiveSummary?: string;
}

export interface InterventionLabResult {
  projectId: string;
  originalRiskScore: number | null;
  originalRiskTier: RiskTier;
  simulatedRiskScore: number | null;
  simulatedRiskTier: RiskTier;
  riskScoreDelta: number | null;
  originalPriorityScore: number | null;
  originalPriorityTier: PriorityTier | null;
  simulatedPriorityScore: number | null;
  simulatedPriorityTier: PriorityTier | null;
  priorityScoreDelta: number | null;
  predictedDelayMonthsOriginal: number | null;
  predictedDelayMonthsSimulated: number | null;
  delaySavedMonths: number | null;
  predictedCostEscalationCrOriginal: number | null;
  predictedCostEscalationCrSimulated: number | null;
  costSavedCr: number | null;
  updatedDrivers?: RiskDriver[];
  assumptionImpacts: AssumptionImpact[];
  indicatorChanges: IndicatorChange[];
  actionableInsights: string[];
  recommendedIntervention: string;
  officerBrief: InterventionBriefData;
}

