from typing import List, Optional, Literal
from pydantic import BaseModel, Field
from backend.models.common import RiskTier, PriorityTier

class RiskIndicator(BaseModel):
    id: str
    label: str
    description: str
    rawValue: Optional[float] = None
    normalisedScore: int
    weight: int
    weightedContribution: float
    category: str
    severity: Literal['critical', 'high', 'medium', 'low', 'none']

class RiskAssessment(BaseModel):
    riskScore: int
    riskTier: RiskTier
    evidenceConfidence: float
    observationCount: int
    indicators: List[RiskIndicator] = Field(default_factory=list)
    primaryConcerns: List[str] = Field(default_factory=list)
    assessedAt: Optional[str] = None

class PriorityEvidence(BaseModel):
    physicalProgressPercent: float
    cumulativeExpenditureCr: float
    revisedCostCr: float
    originalCostCr: float
    costOverrunPercent: float
    expenditurePctOfRevisedCost: float
    timeOverrunMonths: int
    targetCompletionDate: str
    originalCompletionDate: str
    consecutiveStagnantMonths: int
    recentProgressDelta: Optional[float] = None
    observationCount: int

class PriorityAssessment(BaseModel):
    projectId: str
    projectName: str
    code: str
    sector: str = ""
    state: str
    implementingAgency: str
    priorityScore: int
    priorityTier: PriorityTier
    riskScore: int
    riskTier: RiskTier
    evidenceConfidence: float
    urgency: int
    recentDeterioration: int
    primaryRiskDriver: str
    topRiskDrivers: List[str] = Field(default_factory=list)
    priorityReason: str
    recommendedAction: str
    evidence: Optional[PriorityEvidence] = None
    assessedAt: Optional[str] = None
