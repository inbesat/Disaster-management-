"""FastAPI microservice exposing the trained XGBoost flood-risk model.

Next.js can't run XGBoost natively, so this lightweight Python API is the
bridge between the Next.js backend and the model.

Run from ml_service/ with:
    uvicorn api:app --reload --port 8000
"""

import os
import sys
import asyncio
import hashlib
import hmac
from contextlib import asynccontextmanager

# Python 3.14 Windows fix: the default Proactor loop crashes accepts with
# WinError 10014. The Selector loop works around it until 3.16 removes it.
if sys.platform == "win32" and hasattr(asyncio, "WindowsSelectorEventLoopPolicy"):
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

import joblib
from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# Explicit local configuration; production deployments can provide process env.
from pathlib import Path
for _line in (Path(__file__).parent / ".env.local").read_text().splitlines() if (Path(__file__).parent / ".env.local").exists() else []:
    if "=" in _line and not _line.lstrip().startswith("#"):
        _key, _value = _line.split("=", 1)
        os.environ.setdefault(_key.strip(), _value.strip())

MODEL_PATH = os.path.join(os.path.dirname(__file__), "flood_xgboost_model.pkl")

# Column order MUST match the order used during training (train_model.py).
FEATURE_ORDER = [
    "cumulative_rainfall_72h",
    "river_level_trend",
    "soil_saturation_index",
    "elevation_m",
]
RISK_LABELS = ["Low", "Medium", "High", "Critical"]

# API key for authentication (set ML_API_KEY in environment)
ML_API_KEY = os.environ.get("ML_API_KEY", "")


def verify_api_key(authorization: str = Header(default="")):
    """Verify Bearer token for API authentication."""
    if not ML_API_KEY:
        # No key configured — allow in dev, reject in production
        if os.environ.get("ENVIRONMENT", "development") == "production":
            raise HTTPException(status_code=401, detail="ML_API_KEY not configured")
        return
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    token = authorization[7:]
    if not hmac.compare_digest(token, ML_API_KEY):
        raise HTTPException(status_code=401, detail="Invalid API key")


class FloodFeatures(BaseModel):
    cumulative_rainfall_72h: float = Field(
        ge=0, description="Cumulative rainfall over the last 72h (mm)"
    )
    river_level_trend: float = Field(
        description="River level change over 72h (m)"
    )
    soil_saturation_index: float = Field(
        ge=0, le=1, description="Soil saturation index (0-1)"
    )
    elevation_m: float = Field(ge=0, description="Terrain elevation (m)")

    class Config:
        json_schema_extra = {
            "example": {
                "cumulative_rainfall_72h": 120.5,
                "river_level_trend": 0.8,
                "soil_saturation_index": 0.65,
                "elevation_m": 45.0,
            }
        }


class PredictionResponse(BaseModel):
    predicted_risk_class: int
    risk_level: str
    confidence_score: float
    probabilities: list[float]


def _load_model():
    """Load the XGBoost model with integrity verification."""
    if not os.path.exists(MODEL_PATH):
        raise RuntimeError(f"Model file not found: {MODEL_PATH}")

    # Basic file size sanity check (model should be > 1KB, < 100MB)
    file_size = os.path.getsize(MODEL_PATH)
    if file_size < 1024:
        raise RuntimeError(f"Model file suspiciously small: {file_size} bytes")
    if file_size > 100 * 1024 * 1024:
        raise RuntimeError(f"Model file suspiciously large: {file_size} bytes")

    # Load with joblib (safe for legitimate .pkl files from scikit-learn/xgboost)
    # In production, use a signed model or checksum verification.
    model = joblib.load(MODEL_PATH)

    # Verify it has the expected predict_proba method
    if not hasattr(model, "predict_proba"):
        raise RuntimeError("Loaded model does not have predict_proba method")

    return model


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.model = _load_model()
    yield


app = FastAPI(
    title="SafeSphere ML Engine",
    description="XGBoost flood-risk classifier (0=Low, 1=Medium, 2=High, 3=Critical)",
    version="0.1.0",
    lifespan=lifespan,
)

# Restrict CORS to Next.js backend only
ALLOWED_ORIGINS = os.environ.get("ML_ALLOWED_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "Authorization"],
)


@app.get("/health")
def health():
    return {"status": "ok", "model_loaded": hasattr(app.state, "model")}


@app.post("/predict", response_model=PredictionResponse)
def predict(features: FloodFeatures, _auth: None = Depends(verify_api_key)):
    try:
        if not hasattr(app.state, "model"):
            raise HTTPException(status_code=503, detail="Model not loaded")
        row = [[getattr(features, field) for field in FEATURE_ORDER]]
        proba = app.state.model.predict_proba(row)[0]
        class_idx = int(proba.argmax())
        return PredictionResponse(
            predicted_risk_class=class_idx,
            risk_level=RISK_LABELS[class_idx],
            confidence_score=float(proba[class_idx]),
            probabilities=[float(p) for p in proba],
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=422,
            detail=f"Prediction failed: {str(e)[:200]}",
        )
