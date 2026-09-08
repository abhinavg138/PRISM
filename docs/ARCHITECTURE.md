# PRISM System Architecture

## 1. High-Level Architecture Overview

PRISM (Predictive Risk Intelligence & Smart Monitoring) is an infrastructure governance and early-warning monitoring platform designed for the Ministry of Statistics & Programme Implementation (MoSPI) and the Cabinet Project Monitoring Group (PMG).

The system follows a clean, single-backend architecture accessible to developers who know basic HTML, CSS, JavaScript, and Python:
- **Frontend Layer**: Standard HTML5, CSS3, and Vanilla JavaScript (ES6) organized into modular, maintainable files in `frontend/`.
- **API Communication**: Standard JSON REST API over HTTP/HTTPS with unified error envelopes.
- **Backend Services Layer**: High-throughput Python 3 / FastAPI server executing deterministic risk models, priority queues, early warning alerts, scenario simulations, and grounded LLM synthesis.
- **Static Hosting**: FastAPI directly mounts and serves the `frontend/` static assets, eliminating separate frontend dev servers, bundlers, and proxies.
- **Authoritative Data Store**: MoSPI PAIMANA repository (2,054 mega-projects, 7,499 monthly snapshot observations, 1,664 4-month longitudinal series) loaded into in-memory indexed data structures.

```text
        HTML5 (Structure)
                +
         CSS3 (Appearance)
                +
    Vanilla JavaScript (Behavior & API)
                │
            HTTP / JSON
                │
                ▼
             Python 3
                │
             FastAPI (Port 8000)
                │
   ┌────────────┼───────────────────────────┐
   ▼            ▼                           ▼
PAIMANA    Deterministic PRISM        Grounded Gemini
Dataset    Risk & Priority Engines    Copilot Service
(MoSPI)    + Early Warning Alerts     (Explanation Layer)
           + Scenario Simulation
```

---

## 2. Component Responsibility Breakdown

| Component | Technology | Primary Responsibilities |
|---|---|---|
| **Frontend Structure** | HTML5 (`frontend/index.html`) | Semantic DOM layout: header, dashboard view, projects table, GIS map, sector analytics, dossier modal, and Copilot drawer. |
| **Frontend Styling** | CSS3 (`frontend/css/styles.css`, `components.css`) | Stitch design system tokens, typography, grid layouts, cards, badges, and print formatting. |
| **Frontend Behavior** | Vanilla JS (`frontend/js/*.js`) | Modular DOM rendering, table pagination, filter updates, modal toggling, Chart.js visual charts, and REST API calls. |
| **Backend Framework** | FastAPI, Uvicorn, Pydantic v2 | Request validation, routing, error handling, CORS, static file serving, and API serialization. |
| **Risk Engine** | Python (`backend/services/risk_engine.py`) | Authoritative deterministic 6-indicator risk scoring (0–100) and risk tier classification (CRITICAL, HIGH, MODERATE, LOW). |
| **Priority Engine** | Python (`backend/services/priority_engine.py`) | Tri-tier priority classification (P1 Immediate, P2 Significant, P3 Routine) based on risk, urgency, deterioration, and confidence. |
| **Alert Engine** | Python (`backend/services/alert_engine.py`) | Early-warning alert generator detecting 6 critical anomalies across project series. |
| **Scenario Engine** | Python (`backend/services/scenario_engine.py`) | Rule-based sensitivity analysis evaluating policy levers (liquidity, clearances, committee review). Clearly disclaimed as illustrative simulation, not ML forecast. |
| **Copilot Service** | Python (`backend/services/copilot_service.py`), Google GenAI | Strict factual grounding; local deterministic retrieval fallback; LLM synthesis via Gemini. |
| **Data Repository** | Python (`backend/repositories/paimana_repository.py`) | Direct parsing, validation, and in-memory indexing of the MoSPI Excel snapshots. |

---

## 3. Communication Protocol

- **Transport**: HTTP/1.1 REST (JSON)
- **Application Port**: `8000` (FastAPI serves both the frontend at `/` and the API at `/api/*`)
- **Interactive Documentation**: Swagger UI at `/docs`
- **Health Check**: `/api/health`

---

## 4. Frontend Module Organization

```text
frontend/
├── index.html            # Main application layout
├── css/
│   ├── styles.css        # Design tokens, typography, colors, badges, tables
│   └── components.css    # Modals, drawers, range sliders, print styling
├── js/
│   ├── app.js            # App lifecycle, routing, role switching
│   ├── api.js            # Centralized fetch client for backend endpoints
│   ├── state.js          # Central state store and event emitter
│   ├── dashboard.js      # KPI summary, sector cards, priority queue, alerts widget
│   ├── projects.js       # Search, multi-column filters, paginated table
│   ├── project-detail.js # Dossier modal, PRISM Risk Indicators, longitudinal trend
│   ├── scenario.js       # Intervention Lab policy sliders, simulate API, officer brief
│   ├── copilot.js        # Grounded AI Copilot drawer, chips, chat history
│   ├── analytics.js      # Sector & portfolio distributions via Chart.js
│   ├── alerts.js         # Early warning alert filters and project quick links
│   ├── map.js            # Interactive India SVG GIS map, coordinates projection
│   ├── reports.js        # Executive Flash Report generation & print layout
│   └── utils.js          # Formatters, badges, safe markdown parser, icons
└── assets/
    ├── chart.umd.min.js  # Standalone chart rendering library
    └── lucide.min.js     # Standalone SVG icon library
```

---

## 5. Security & Governance

- **Zero Client-Side Calculation**: Authoritative risk and priority scores are computed strictly on the Python backend.
- **Server-Side Secrets**: `GEMINI_API_KEY` is exclusively read and utilized within `backend/config.py`. No keys or credentials are sent to the client.
- **Zero Coordinate Fabrication**: Projects without verified GPS coordinates are honestly represented in the National State Registry without synthetic map coordinates.
- **Deterministic Risk Indicators**: PRISM uses 6 deterministic engineering indicators (Velocity, Stagnation, Schedule Pressure, Cost Escalation, Divergence, Trend).
