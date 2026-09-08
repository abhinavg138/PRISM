from typing import Literal

RiskTier = Literal['CRITICAL', 'HIGH', 'MODERATE', 'LOW', 'UNRATED']
PriorityTier = Literal['P1', 'P2', 'P3']

AlertType = Literal[
    'Progress Stagnation',
    'Deteriorating Progress',
    'Schedule Pressure',
    'Cost Escalation',
    'Physical-Financial Divergence',
    'High/Critical Risk'
]

AlertSeverity = Literal['CRITICAL', 'HIGH', 'MEDIUM']
