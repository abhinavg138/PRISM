from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from backend.models.common import RiskTier, PriorityTier
from backend.models.project import RiskDriver

class SimulationParams(BaseModel):
    projectId: str
    landClearanceAccelerationWeeks: float = 0.0
    contractorLiquidityInjectionPercent: float = 0.0
    weatherGeologicalMitigationLevel: float = 0.0
    fastTrackHighPowerCommittee: bool = False

class IndicatorChange(BaseModel):
    id: str
    label: str
    weight: int
    originalScore: int
    simulatedScore: int
    scoreDelta: int
    originalContribution: float
    simulatedContribution: float
    assumptionDriver: str

class AssumptionImpact(BaseModel):
    lever: str
    value: str
    pointsReduced: float
    mechanism: str

class InterventionBriefData(BaseModel):
    projectName: str
    projectId: str
    sector: str
    state: str
    agency: str
    currentRisk: Dict[str, Any]
    currentPriority: Dict[str, Any]
    simulatedRisk: Dict[str, Any]
    simulatedPriority: Dict[str, Any]
    evidenceSummary: str
    primaryConcern: str
    recommendedAction: str
    scenarioAssumptions: List[AssumptionImpact] = Field(default_factory=list)
    indicatorChanges: List[IndicatorChange] = Field(default_factory=list)
    provenance: str
    disclaimer: str
    aiExecutiveSummary: Optional[str] = None

class InterventionLabResult(BaseModel):
    projectId: str
    originalRiskScore: Optional[int] = None
    originalRiskTier: RiskTier = 'UNRATED'
    simulatedRiskScore: Optional[int] = None
    simulatedRiskTier: RiskTier = 'UNRATED'
    riskScoreDelta: Optional[float] = None
    originalPriorityScore: Optional[int] = None
    originalPriorityTier: Optional[PriorityTier] = None
    simulatedPriorityScore: Optional[int] = None
    simulatedPriorityTier: Optional[PriorityTier] = None
    priorityScoreDelta: Optional[int] = None
    predictedDelayMonthsOriginal: Optional[float] = None
    predictedDelayMonthsSimulated: Optional[float] = None
    delaySavedMonths: Optional[float] = None
    predictedCostEscalationCrOriginal: Optional[float] = None
    predictedCostEscalationCrSimulated: Optional[float] = None
    costSavedCr: Optional[float] = None
    updatedDrivers: Optional[List[RiskDriver]] = None
    assumptionImpacts: List[AssumptionImpact] = Field(default_factory=list)
    indicatorChanges: List[IndicatorChange] = Field(default_factory=list)
    actionableInsights: List[str] = Field(default_factory=list)
    recommendedIntervention: str = ""
    officerBrief: Optional[InterventionBriefData] = None
