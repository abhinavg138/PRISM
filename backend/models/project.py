from typing import List, Optional, Dict, Any, Literal
from pydantic import BaseModel, Field
from backend.models.common import RiskTier, PriorityTier, AlertType, AlertSeverity

class LocationGeo(BaseModel):
    lat: Optional[float] = None
    lng: Optional[float] = None
    city: str = ""
    state: str = ""

class RiskDriver(BaseModel):
    id: str
    feature: str
    label: str
    shapValue: float
    description: str
    category: str
    severity: Literal['critical', 'high', 'medium', 'low']

class MitigationStep(BaseModel):
    id: str
    action: str
    timeframe: str
    impact: str
    responsibleParty: str
    status: Literal['Pending', 'In Progress', 'Completed']
    riskReductionPoints: int

class ProgressHistoryPoint(BaseModel):
    month: str
    reportMonth: Optional[str] = None
    plannedPercent: Optional[float] = None
    actualPercent: float
    financialExpenditureCr: float
    expenditurePctOfRevisedCost: Optional[float] = None

class AuditEvent(BaseModel):
    id: str
    date: str
    event: str
    reportedBy: str
    type: Literal['warning', 'milestone', 'audit', 'delay']

class PaimanaObservation(BaseModel):
    report_month: str
    report_page: Optional[Any] = None
    row_no: Optional[Any] = None
    project_id: str
    project_name: str
    agency: str
    legacy_ocms_code: Optional[str] = None
    pmgid: Optional[str] = None
    state: str
    approval_start_mm_yyyy: Optional[str] = None
    revised_start_mm_yyyy: Optional[str] = None
    original_target_completion_mm_yyyy: Optional[str] = None
    revised_target_completion_mm_yyyy: Optional[str] = None
    original_cost_cr: float = 0.0
    revised_cost_cr: float = 0.0
    cumulative_expenditure_cr: float = 0.0
    physical_progress_pct: float = 0.0
    source: Optional[str] = None
    source_file: Optional[str] = None
    expenditure_pct_of_revised_cost: Optional[float] = None
    cost_revision_pct: Optional[float] = 0.0
    physical_progress_change_mom_pct_points: Optional[float] = 0.0
    expenditure_change_mom_cr: Optional[float] = 0.0
    revised_cost_change_mom_cr: Optional[float] = 0.0
    progress_change: Optional[float] = 0.0
    expenditure_change: Optional[float] = 0.0
    expenditure_pct: Optional[float] = 0.0
    progress_expenditure_gap: Optional[float] = 0.0

class EarlyWarningAlert(BaseModel):
    id: str
    projectId: str
    projectName: str
    projectCode: str
    state: str
    sector: str
    implementingAgency: Optional[str] = None
    alertType: AlertType
    severity: AlertSeverity
    evidence: str
    detectedPeriod: str
    recommendedAttention: str
    riskScore: Optional[int] = None
    priorityScore: Optional[int] = None
    priorityTier: Optional[PriorityTier] = None

class Project(BaseModel):
    id: str
    name: str
    code: str
    sector: str
    derivedSector: Optional[str] = None
    ministry: Optional[str] = None
    state: str
    implementingAgency: str
    location: LocationGeo
    originalCostCr: float
    revisedCostCr: float
    cumulativeExpenditureCr: float
    costOverrunPercent: float
    expenditurePctOfRevisedCost: Optional[float] = None
    originalStartDate: str = ""
    originalCompletionDate: str = ""
    revisedCompletionDate: str = ""
    timeOverrunMonths: int = 0
    physicalProgressPercent: float = 0.0
    financialProgressPercent: Optional[float] = None
    riskScore: Optional[int] = None
    riskTier: RiskTier = 'UNRATED'
    predictedDelayMonths: Optional[float] = None
    predictedCostEscalationCr: Optional[float] = None
    confidenceScore: Optional[float] = None
    primaryDelayCause: Optional[str] = None
    lastUpdated: str = ""
    topRiskDrivers: List[RiskDriver] = Field(default_factory=list)
    mitigationRoadmap: List[MitigationStep] = Field(default_factory=list)
    monthlyTrend: List[ProgressHistoryPoint] = Field(default_factory=list)
    auditTrail: List[AuditEvent] = Field(default_factory=list)
    priorityScore: Optional[int] = None
    priorityTier: Optional[PriorityTier] = None
    priorityReason: Optional[str] = None
    recommendedAction: Optional[str] = None
    primaryRiskDriver: Optional[str] = None
    urgency: Optional[int] = None
    evidenceConfidence: Optional[float] = None
    alert: Optional[EarlyWarningAlert] = None
    dataSource: Optional[str] = 'PAIMANA'
    rawPaimana: Optional[PaimanaObservation] = None
    simulationFactors: Optional[Dict[str, Any]] = None

class PortfolioKPIs(BaseModel):
    totalProjects: int
    criticalProjects: int
    highRiskProjects: int
    moderateRiskProjects: int
    lowRiskProjects: int
    unratedProjects: int = 0
    p1Projects: int = 0
    p2Projects: int = 0
    p3Projects: int = 0
    totalBudgetCr: int
    budgetAtRiskCr: int
    averageDelayMonths: float
    averageCostEscalationPercent: float
    activeEscalationsCount: int
    averageRiskScore: Optional[float] = None
    averagePhysicalProgress: Optional[float] = None

class SectorStat(BaseModel):
    sector: str
    totalProjects: int
    avgPhysicalProgress: float
    criticalProjects: int
    highRiskProjects: int
    avgRiskScore: float
    totalBudgetCr: int
