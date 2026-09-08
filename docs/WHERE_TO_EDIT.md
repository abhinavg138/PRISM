# PRISM — Where to Edit Guide

This document guides engineers on where to modify code in the PRISM codebase based on common feature requests and enhancement tasks.

---

## 1. Modifying Risk Methodology or Formulas

- **Risk Indicators & Weights**: Edit `backend/services/risk_engine.py`.
  - Indicator logic: `calc_progress_velocity`, `calc_progress_stagnation`, `calc_schedule_pressure`, `calc_cost_escalation`, `calc_physical_financial_divergence`, `calc_deteriorating_trend`.
  - Composite weights: defined in `PRISMRiskEngine.assess()`.
  - Rounding helper: preserve `js_round` for JavaScript parity.
- **Intervention Priority Score**: Edit `backend/services/priority_engine.py`.
  - Formula: `calc_priority_score`
  - Action recommendations: `generate_recommended_action`
  - Urgency and Deterioration factors: `calc_schedule_urgency`, `calc_recent_deterioration`

---

## 2. Adding or Modifying Backend API Endpoints

- **Route Handlers**: Create or update files in `backend/routes/`.
  - `projects.py`: Querying, filtering, project details, history, risk assessments.
  - `priorities.py`: Priority queue, P1/P2/P3 categorization.
  - `alerts.py`: Early warning anomalies.
  - `analytics.py`: Multi-dimensional portfolio aggregations.
  - `simulation.py`: What-if sensitivity testing.
  - `copilot.py`: Natural language questions and grounded responses.
- **Router Registration**: When adding a new router file, import and register it in `backend/routes/__init__.py`.
- **Pydantic Models**: Add any new request/response schemas to the appropriate file in `backend/models/`.

---

## 3. Modifying AI Copilot & Grounding Behavior

- **Authoritative Data Extraction**: Edit `resolve_query_factual_context` in `backend/services/copilot_service.py`.
- **System Prompts & Persona**: Edit `system_instruction` in `CopilotService.chat` (`backend/services/copilot_service.py`).
- **Deterministic Fallback Text**: Edit summary generation blocks in `backend/services/copilot_service.py`.

---

## 4. Modifying Frontend UI Components

- **Main Navigation & HTML Structure**: `frontend/index.html`
- **Design System & Styles**: `frontend/css/styles.css` and `frontend/css/components.css`
- **Dashboard Overview**: `frontend/js/dashboard.js`
- **Projects List & Filters**: `frontend/js/projects.js`
- **Project Detail Dossier**: `frontend/js/project-detail.js`
- **Intervention Lab (Simulation)**: `frontend/js/scenario.js`
- **AI Copilot Drawer**: `frontend/js/copilot.js`
- **Alerts Feed & Radar**: `frontend/js/alerts.js`
- **Map / GIS View**: `frontend/js/map.js`
- **Sector Analytics**: `frontend/js/analytics.js`
- **State Management**: `frontend/js/state.js`
- **REST API Client**: `frontend/js/api.js`

---

## 5. Modifying Data Ingestion or Snapshot Parsing

- **PAIMANA Dataset Ingestion**: `backend/repositories/paimana_repository.py`.
- **Agency-to-Sector Derivation**: `derive_sector_from_agency` in `backend/repositories/paimana_repository.py`.
- **Demo Mode Datasets**: `backend/repositories/demo_data.py` and `backend/demo_projects.json`.
