import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

from backend.config import API_HOST, API_PORT, CORS_ORIGINS
from backend.repositories.paimana_repository import paimana_repository
from backend.routes import routers

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Lifespan startup: Pre-load and index PAIMANA dataset
    print("[PRISM] Initializing PAIMANA repository on server startup...")
    try:
        paimana_repository.load()
        stats = paimana_repository.get_stats()
        print(f"[PRISM] Successfully initialized {stats['uniqueProjects']} projects from {stats['totalObservations']} observations.")
    except Exception as err:
        print(f"[PRISM] Warning: Failed to load dataset on startup: {err}")
    yield
    print("[PRISM] Server shutting down.")

app = FastAPI(
    title="PRISM - Predictive Risk Intelligence & Smart Monitoring",
    description="Deterministic Risk Intelligence, Priority Engine, and Grounded AI Analytics API for SIH 2026.",
    version="2.1.0-sih2026",
    lifespan=lifespan
)

# Enable CORS for local development across multiple dev ports (e.g. 5173, 3000, 8000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Custom Exception Handlers to avoid stack trace leaks
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=400,
        content={"error": "Malformed request or validation error", "details": str(exc.errors())}
    )

@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": exc.detail}
    )

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    print(f"[PRISM Internal Error]: {exc}")
    return JSONResponse(
        status_code=500,
        content={"error": "Internal processing event. Please retry."}
    )

# Register API routers
for router in routers:
    app.include_router(router)

@app.get("/")
def root():
    return {
        "platform": "PRISM - Predictive Risk Intelligence & Smart Monitoring",
        "version": "2.1.0-sih2026",
        "documentation": "/docs",
        "health": "/api/health"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host=API_HOST, port=API_PORT, reload=True)
