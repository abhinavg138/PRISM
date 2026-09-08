import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env from workspace root if present
ROOT_DIR = Path(__file__).resolve().parent.parent
load_dotenv(ROOT_DIR / ".env")

# Server settings
API_HOST = os.getenv("API_HOST", "0.0.0.0")
API_PORT = int(os.getenv("API_PORT", "8000"))

# Gemini API configuration
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

# Data paths
DATA_DIR = ROOT_DIR / "data"
EXCEL_PATH = str(DATA_DIR / "PRISM_PAIMANA_Dataset_v1_Apr-Jul_2026.xlsx")
CSV_PATH = str(DATA_DIR / "PRISM_ML_features_v1.csv")

# CORS Origins
CORS_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:3000",
    "*"
]

# App URL
APP_URL = os.getenv("APP_URL", f"http://localhost:{API_PORT}")
