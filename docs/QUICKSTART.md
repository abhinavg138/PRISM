# PRISM Quickstart Guide

PRISM runs as a unified, high-performance architecture:
- **Frontend**: Pure HTML5 + CSS3 + Vanilla JavaScript (ES6) in `frontend/`
- **Backend**: Python 3 / FastAPI in `backend/`
- **Data & Intelligence**: MoSPI PAIMANA Excel/CSV dataset + Deterministic PRISM Risk Engine + Priority Engine + Early Warning Alerts + Scenario Engine + Grounded Gemini Copilot

---

## 1. Prerequisites

- **Python**: 3.10 or newer (tested on Python 3.14)
- **Pip**: Python package manager
- *(Optional)* Gemini API Key (PRISM works with full deterministic intelligence even without a key via local grounding).

---

## 2. Installation

Install Python backend dependencies:
```bash
python -m pip install -r backend/requirements.txt
```

*(No `npm install` or frontend build step is required. The frontend uses standard browser-native HTML, CSS, and ES6 JavaScript with local assets).*

---

## 3. Environment Configuration

Copy the example environment file:
```bash
cp .env.example .env
```

Add your optional Gemini API key to `.env`:
```env
GEMINI_API_KEY="your_gemini_api_key_here"
API_PORT=8000
```

---

## 4. Running PRISM

Start the unified FastAPI server:
```bash
python -m uvicorn backend.main:app --port 8000 --reload
```

Open your browser to:
```text
http://localhost:8000/
```

- **Application Dashboard**: `http://localhost:8000/`
- **Health Check**: `http://localhost:8000/api/health`
- **Interactive API Documentation**: `http://localhost:8000/docs`

---

## 5. Running Tests

Execute the automated test suite across all 42 parity and endpoint tests:
```bash
pytest backend/tests -v
```
