# PRISM - Production Container Dockerfile
# SIH 2026 Problem Statement 26103
FROM python:3.12-slim

# Set environment flags
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    API_PORT=8000 \
    API_HOST=0.0.0.0 \
    ENVIRONMENT=production

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python requirements
COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir -r /app/backend/requirements.txt

# Copy complete PRISM application
COPY backend /app/backend
COPY data /app/data
COPY frontend /app/frontend
COPY docs /app/docs
COPY ml /app/ml
COPY package.json /app/package.json
COPY README.md /app/README.md

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/api/health || exit 1

EXPOSE 8000

# Start production server with Uvicorn
CMD ["python", "-m", "uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
