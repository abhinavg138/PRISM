# PRISM System Architecture

## 1. High-Level Architecture Overview

PRISM (Predictive Risk Intelligence & Smart Monitoring) is an infrastructure governance and early-warning monitoring platform designed for the Ministry of Statistics & Programme Implementation (MoSPI) and the Cabinet Project Monitoring Group (PMG).

The system follows a clean decoupled architecture:
- **Frontend Layer**: Modern, high-performance React 19 single-page application built with Vite, TypeScript, Tailwind CSS, and Stitch-generated components.
- **API Communication**: Strictly typed JSON REST API over HTTP/HTTPS with CORS support and unified error envelopes.
- **Backend Services Layer**: High-throughput Python 3 / FastAPI server executing deterministic risk models, priority queues, scenario simulations, and grounded LLM synthesis.
- **Authoritative Data Store**: MoSPI PAIMANA repository (2,054 mega-projects, 7,499 monthly snapshot observations, 1,664 4-month longitudinal series) loaded into in-memory indexed data structures.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        REACT 19 + VITE FRONTEND                        │
│                                                                        │
│   Dashboard  │  Projects  │  Intervention Lab  │  GIS  │  AI Copilot   │
│                 (TypeScript, Tailwind CSS, Recharts)                  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ JSON REST API
                                    │ (Vite Proxy -> Port 8000)
┌───────────────────────────────────▼────────────────────────────────────┐
│                        PYTHON / FASTAPI BACKEND                        │
│                                                                        │
│  ┌───────────────────────┐  ┌───────────────────────────────────────┐  │
│  │   REST Route Layer    │  │        Authoritative Engines          │  │
│  │  - /api/health        │  │  - PRISMRiskEngine (6 indicators)     │  │
│  │  - /api/metadata      │  │  - PRISMPriorityEngine (P1/P2/P3)     │  │
│  │  - /api/projects      │  │  - PRISMAlertEngine (6 alert types)   │  │
│  │  - /api/priorities    │  │  - ScenarioEngine (What-if levers)    │  │
│  │  - /api/alerts        │  │  - CopilotService (Grounded LLM)      │  │
│  │  - /api/sectors       │  │  - ProjectQueryService                │  │
│  │  - /api/analytics     │  └──────────────────┬────────────────────┘  │
│  │  - /api/simulate      │                     │                       │
│  │  - /api/copilot/chat  │  ┌──────────────────▼────────────────────┐  │
│  │  - /api/demo/reset    │  │     PaimanaRepository (In-Memory)     │  │
│  └───────────────────────┘  │  - 2,054 Projects                     │  │
│                             │  - 7,499 Observations (Apr–Jul 2026)  │  │
│                             │  - 1,664 4-Month Longitudinal Series  │  │
│                             └──────────────────┬────────────────────┘  │
└────────────────────────────────────────────────┼───────────────────────┘
                                                 │
                                                 ▼
                              ┌───────────────────────────────────────┐
                              │           PAIMANA Dataset             │
                              │   data/paimana_clean_4months.xlsx     │
                              └───────────────────────────────────────┘
```

---

## 2. Component Responsibility Breakdown

| Component | Technology | Primary Responsibilities |
|---|---|---|
| **Frontend UI** | React 19, Vite, TypeScript, Tailwind | Rendering project tables, KPI cards, charts, interactive filters, modal drawers, and responsive layouts. |
| **Backend Framework** | FastAPI, Uvicorn, Pydantic v2 | Request validation, routing, error handling, CORS middleware, and API serialization. |
| **Risk Engine** | Python (`risk_engine.py`) | Authoritative deterministic 6-indicator risk scoring (0–100) and risk tier classification (CRITICAL, HIGH, MODERATE, LOW). |
| **Priority Engine** | Python (`priority_engine.py`) | Tri-tier priority classification (P1 Immediate, P2 Significant, P3 Routine) based on risk, urgency, deterioration, and confidence. |
| **Alert Engine** | Python (`alert_engine.py`) | Early-warning alert generator detecting 6 critical anomalies across project series. |
| **Scenario Engine** | Python (`scenario_engine.py`) | Rule-based sensitivity analysis evaluating policy levers (liquidity, clearances, committee review). Clearly disclaimed as illustrative simulation, not ML forecast. |
| **Copilot Service** | Python (`copilot_service.py`), Google GenAI | Strict factual grounding; local deterministic retrieval fallback; LLM synthesis via `gemini-3.6-flash`. |
| **Data Repository** | Python (`paimana_repository.py`) | Direct parsing, validation, and in-memory indexing of the MoSPI Excel snapshots. |

---

## 3. Communication Protocol

- **Transport**: HTTP/1.1 REST (JSON)
- **Default Frontend Port**: `5173` (Vite dev server)
- **Default Backend Port**: `8000` (FastAPI / Uvicorn)
- **Proxy Configuration**: `vite.config.ts` proxies all requests starting with `/api` to `http://localhost:8000`.
- **CORS Support**: FastAPI CORS middleware allows requests from `http://localhost:5173`, `http://localhost:3000`, `http://localhost:8000`, and `127.0.0.1`.

---

## 4. Key Invariants & Non-Negotiable Rules

1. **Deterministic Authority**: All risk scores, rankings, KPIs, and priorities are calculated deterministically by the Python engines. Neither the frontend nor the Gemini LLM can calculate or alter scores.
2. **Canonical Baseline Numbers**:
   - 2,054 Unique Mega-Projects
   - 7,499 Snapshot Observations (Apr–Jul 2026)
   - 1,664 Projects with full 4-month longitudinal series
   - 0 Projects Unrated
   - 1,036 Early Warning Alerts
   - Delhi State Partition: 17 Dedicated, 7 Multi-State, 24 Total
   - Benchmark Project `701396`: Risk Score `81` (`CRITICAL`)
   - Priority Queue P1 Count: `508`
3. **Mathematical Parity**: Python backend employs half-up rounding (`Math.floor(x + 0.5)`) identical to JavaScript's behavior, ensuring zero drift between implementations.
