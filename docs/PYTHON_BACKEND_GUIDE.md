# PRISM Python Backend Developer Guide

## 1. Directory Structure

```
backend/
├── config.py                     # Environment variables, file paths, port configs
├── demo_projects.json            # 15 seeded showcase projects for demo mode
├── main.py                       # FastAPI application entrypoint, CORS, lifespan
├── requirements.txt              # Production & development dependencies
├── models/                       # Pydantic v2 schemas
│   ├── common.py                 # Enums: RiskTier, PriorityTier
│   ├── copilot.py                # Chat request/response, narrative models
│   ├── project.py                # Core Project, Observation, KPI schemas
│   ├── risk.py                   # Risk assessment & Priority assessment models
│   └── simulation.py             # What-if simulation parameters & output models
├── repositories/                 # Data access layer
│   ├── demo_data.py              # In-memory storage & helpers for 15 demo projects
│   └── paimana_repository.py     # In-memory repository loading Excel/CSV snapshots
├── routes/                       # Modular FastAPI APIRouter endpoints
│   ├── alerts.py                 # GET /api/alerts, GET /api/projects/{id}/alert
│   ├── analytics.py              # GET /api/analytics
│   ├── copilot.py                # POST /api/copilot/chat
│   ├── demo.py                   # POST /api/demo/reset
│   ├── health.py                 # GET /api/health
│   ├── metadata.py               # GET /api/metadata
│   ├── priorities.py             # GET /api/priorities, GET /api/projects/{id}/priority
│   ├── projects.py               # GET /api/projects, GET /api/projects/{id}, /history, /risk
│   ├── sectors.py                # GET /api/sectors
│   └── simulation.py             # POST /api/simulate, POST /api/intervention-lab/narrative
├── services/                     # Core business logic & deterministic engines
│   ├── alert_engine.py           # Early warning anomaly detection (6 alerts)
│   ├── copilot_service.py        # Factual query context resolver & Gemini synthesis
│   ├── priority_engine.py        # Multi-factor priority queue (0.40R + 0.25U + 0.20D + 0.15C)
│   ├── project_query_service.py  # Universal filtering, state partitioning, pagination
│   ├── risk_engine.py            # 6-indicator deterministic risk engine (0–100)
│   ├── scenario_engine.py        # Exploratory What-If policy simulation
│   └── state_manager.py          # Active data source manager (PAIMANA vs DEMO)
└── tests/                        # Pytest automated test suite (42 tests)
    ├── test_api_endpoints.py     # All 17 REST API endpoints tested with TestClient
    ├── test_canonical_matrix.py  # 14 tests verifying exact canonical truth
    ├── test_paimana_counts.py    # Invariant dataset counts and state partitions
    ├── test_priority_parity.py   # 5 priority engine behavioral scenarios
    └── test_risk_parity.py       # Indicator weight distributions and repeatability
```

---

## 2. Core Service Responsibilities

### `PRISMRiskEngine` (`backend/services/risk_engine.py`)
Computes the authoritative composite risk index (0–100) using 6 weighted indicators:
1. **Progress Velocity** (25%): Measures physical progress acceleration across months.
2. **Progress Stagnation** (20%): Evaluates consecutive flat progress months.
3. **Schedule Pressure** (20%): Calculated from target completion dates and time overruns.
4. **Cost Escalation** (15%): Evaluates percentage cost increase between original and revised estimates.
5. **Physical-Financial Divergence** (10%): Flags disparity where cumulative expenditure exceeds physical completion.
6. **Deteriorating Trend** (10%): Evaluates the month-over-month rate of change in milestone completion.

> **Mathematical Parity Rule**: Python's `round()` uses round-to-even. To preserve 100% equivalence with the JavaScript frontend, the risk engine utilizes `js_round(x)` which implements `math.floor(x + 0.5)`.

### `PRISMPriorityEngine` (`backend/services/priority_engine.py`)
Ranks projects for intervention priority:
$$\text{Priority Score} = 0.40 \cdot \text{Risk} + 0.25 \cdot \text{Urgency} + 0.20 \cdot \text{Deterioration} + 0.15 \cdot (\text{Confidence} \times 100)$$
- **P1 (Score $\ge 70$)**: Immediate Executive Intervention
- **P2 (Score $50 - 69$)**: Significant Monitoring Oversight
- **P3 (Score $< 50$)**: Routine Operational Tracking

### `ScenarioEngine` (`backend/services/scenario_engine.py`)
Applies policy sensitivity levers (e.g., liquidity injections, fast-track environmental clearance, high-power committee oversight).
- Strictly annotated: *"Illustrative Policy Scenario — Not an Observed Forecast"*.
- Never claims to be machine learning or predictive forecasting.

### `CopilotService` (`backend/services/copilot_service.py`)
- **Authority Rule**: Gemini is never the source of truth. Factual context is deterministically resolved from `PaimanaRepository`.
- **Model**: `gemini-3.6-flash`.
- **Resilient Fallback**: If `GEMINI_API_KEY` is missing or the network fails, returns clean deterministic grounded analysis without throwing an unhandled exception.

---

## 3. Running the Python Backend

```bash
# Activate your Python virtual environment if applicable
python -m uvicorn backend.main:app --port 8000 --reload
```

Interactive OpenAPI documentation is automatically available at:
`http://localhost:8000/docs`
