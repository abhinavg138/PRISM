from typing import List, Optional, Any, Dict
from pydantic import BaseModel, Field
from backend.models.common import RiskTier, PriorityTier

class GroundedProject(BaseModel):
    id: str
    name: str
    riskScore: int
    riskTier: RiskTier
    priorityTier: Optional[PriorityTier] = None
    state: Optional[str] = None
    sector: Optional[str] = None
    physicalProgressPercent: Optional[float] = None
    primaryRiskDriver: Optional[str] = None

class CopilotRequest(BaseModel):
    message: str
    activeProjectId: Optional[str] = None

class CopilotResponse(BaseModel):
    answer: str
    groundedProjects: List[GroundedProject] = Field(default_factory=list)
    suggestedQuestions: List[str] = Field(default_factory=list)
    totalMatching: Optional[int] = None
    displayedCount: Optional[int] = None
    error: Optional[str] = None

class InterventionNarrativeRequest(BaseModel):
    projectId: str
    scenarioResult: Dict[str, Any]

class InterventionNarrativeResponse(BaseModel):
    narrative: str
    isAIGenerated: bool
    generatedAt: str
