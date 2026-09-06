export type RiskTier = 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW';

export type SectorType = 
  | 'Railways' 
  | 'Road Transport & Highways' 
  | 'Power & Energy' 
  | 'Petroleum & Gas' 
  | 'Urban Affairs & Metro' 
  | 'Ports & Shipping';

export interface LocationGeo {
  lat: number;
  lng: number;
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
  plannedPercent: number;
  actualPercent: number;
  financialExpenditureCr: number;
}

export interface AuditEvent {
  id: string;
  date: string;
  event: string;
  reportedBy: string;
  type: 'warning' | 'milestone' | 'audit' | 'delay';
}

export interface Project {
  id: string;
  name: string;
  code: string;
  sector: SectorType;
  ministry: string;
  state: string;
  implementingAgency: string;
  location: LocationGeo;
  originalCostCr: number;
  revisedCostCr: number;
  cumulativeExpenditureCr: number;
  costOverrunPercent: number;
  originalStartDate: string;
  originalCompletionDate: string;
  revisedCompletionDate: string;
  timeOverrunMonths: number;
  physicalProgressPercent: number;
  financialProgressPercent: number;
  riskScore: number; // 0 - 100
  riskTier: RiskTier;
  predictedDelayMonths: number;
  predictedCostEscalationCr: number;
  confidenceScore: number; // 0.0 - 1.0
  primaryDelayCause: string;
  lastUpdated: string;
  topRiskDrivers: RiskDriver[];
  mitigationRoadmap: MitigationStep[];
  monthlyTrend: ProgressHistoryPoint[];
  auditTrail: AuditEvent[];
  // Simulation baseline overrides
  simulationFactors?: {
    landAcquisitionBoostMonths?: number;
    clearanceFastTrack?: boolean;
    cashflowLiquidityPercent?: number;
    geologicalSupportLevel?: number;
  };
}

export interface PortfolioKPIs {
  totalProjects: number;
  criticalProjects: number;
  highRiskProjects: number;
  moderateRiskProjects: number;
  lowRiskProjects: number;
  totalBudgetCr: number;
  budgetAtRiskCr: number;
  averageDelayMonths: number;
  averageCostEscalationPercent: number;
  activeEscalationsCount: number;
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
  groundedProjects?: Array<{ id: string; name: string; riskScore: number; riskTier: RiskTier }>;
  suggestedQuestions?: string[];
}
