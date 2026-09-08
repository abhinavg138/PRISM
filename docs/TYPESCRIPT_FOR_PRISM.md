# TypeScript in PRISM

This document explains why TypeScript is retained for the PRISM frontend and how type safety is maintained across the Python FastAPI backend boundary.

---

## 1. Why TypeScript is Retained for the Frontend

1. **Enterprise UI Architecture**: PRISM is a complex governance platform featuring high-density data grids, multi-dimensional charts (Recharts), dynamic filter bars, interactive drawer panels, and real-time scenario simulation levers. TypeScript provides compile-time safety and prevents runtime UI crashes.
2. **Preservation of the Stitch Design**: The entire visual language was crafted in React and styled using Tailwind CSS tokens. Rewriting this in Python web frameworks (such as Streamlit or Dash) would destroy the Stitch design, micro-animations, and responsive layout.
3. **Decoupled Client-Server Contract**: By keeping the frontend in TypeScript and the backend in Python, both layers can evolve independently while adhering to strict JSON REST schemas.

---

## 2. Type Synchronization: TypeScript vs. Python Pydantic

Every core schema in `src/types/index.ts` maps 1:1 to a Pydantic v2 model in `backend/models/`:

| TypeScript Type (`src/types/index.ts`) | Python Pydantic Model (`backend/models/`) | Description |
|---|---|---|
| `Project` | `backend.models.project.Project` | Core infrastructure project entity with financials, milestones, and scores. |
| `PaimanaObservation` | `backend.models.project.PaimanaObservation` | Raw monthly snapshot row from MoSPI Central Flash Reports. |
| `RiskTier` | `backend.models.common.RiskTier` | `CRITICAL`, `HIGH`, `MODERATE`, `LOW`, `UNRATED`. |
| `PriorityTier` | `backend.models.common.PriorityTier` | `P1`, `P2`, `P3`. |
| `RiskAssessment` | `backend.models.risk.RiskAssessment` | 6 indicator breakdown, composite risk score, and primary concerns. |
| `PriorityAssessment` | `backend.models.risk.PriorityAssessment` | Urgency, deterioration, confidence, priority score, and recommended action. |
| `EarlyWarningAlert` | `backend.models.project.EarlyWarningAlert` | Anomaly alert with severity, title, metric, and threshold. |
| `PortfolioKPIs` | `backend.models.project.PortfolioKPIs` | Aggregated portfolio budget, average delay, and count metrics. |
| `SimulationParams` | `backend.models.simulation.SimulationParams` | Input parameters for exploratory scenario levers. |
| `InterventionLabResult` | `backend.models.simulation.InterventionLabResult` | Simulated risk/priority scores, saved months, and officer brief. |
| `CopilotResponse` | `backend.models.copilot.CopilotResponse` | LLM-synthesized answer, grounded projects, and suggested follow-ups. |

---

## 3. How the Bridge Works in Development and Production

- **Development**:
  Vite acts as the development server. Requests to `/api/*` are forwarded via the Vite proxy (`vite.config.ts`) to `http://localhost:8000`.
- **Production Deployment**:
  The React frontend is built to static production bundles (`npm run build` -> `dist/`). These static files can be served directly by FastAPI or hosted via an edge CDN (e.g. Cloudflare, Cloud Storage, or Nginx) pointing API requests to the FastAPI service.
