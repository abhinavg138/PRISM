# PRISM Quickstart Guide

This guide gets PRISM running locally with the Python FastAPI backend and the React Vite frontend.

---

## 1. Prerequisites

- **Python**: 3.10 or newer (tested on Python 3.14)
- **Node.js**: 18.0 or newer
- **Package Managers**: `pip` and `npm`

---

## 2. Installation

### Python Backend Dependencies
```bash
python -m pip install -r backend/requirements.txt
```

### Frontend Dependencies
```bash
npm install
```

---

## 3. Environment Configuration

Copy the example environment file if you wish to configure API keys:
```bash
cp .env.example .env
```
Add your optional Gemini API key to `.env`:
```env
GEMINI_API_KEY="your_gemini_api_key_here"
PORT=8000
VITE_BACKEND_URL="http://localhost:8000"
```
*(Note: PRISM works with full deterministic intelligence even without a Gemini API key using its built-in local grounding engine).*

---

## 4. Running the Development Servers

### Terminal 1: Python FastAPI Backend (Port 8000)
```bash
npm run dev:backend
# Or directly via Python:
# python -m uvicorn backend.main:app --port 8000 --reload
```
Verify the backend is live by opening:
- Health Check: `http://localhost:8000/api/health`
- Interactive API Docs: `http://localhost:8000/docs`

### Terminal 2: React Vite Frontend (Port 5173)
```bash
npm run dev:frontend
```
Open your browser to:
`http://localhost:5173`

The Vite dev server automatically proxies all `/api/*` calls directly to the FastAPI server at `http://localhost:8000`.

---

## 5. Running Automated Verification Tests

### Run the Complete Python Backend Test Suite (42 Tests)
```bash
npm run test:backend
# Or directly via pytest:
# pytest backend/tests -v
```

All 42 tests should pass:
- 17 REST API Endpoints
- 14 Canonical Consistency Matrix Tests
- 5 Priority Engine Scenarios
- 3 Dataset Count Invariants
- 3 Risk Calculation Parity Tests

### Run Frontend Typecheck & Build Verification
```bash
npm run lint    # Verifies TypeScript types (tsc --noEmit)
npm run build   # Verifies production Vite bundle
```
