from fastapi import APIRouter, HTTPException, Depends
import os
import json
import joblib

from app.utils.auth import get_current_user

router = APIRouter(
    prefix="/forecast",
    tags=["Forecast"],
    dependencies=[Depends(get_current_user)]
)

# ----------------------------------------
# PATHS
# ----------------------------------------
# backend/app/routers/forecast.py -> go up 3 levels to backend/
BASE_DIR = os.path.dirname(
    os.path.dirname(
        os.path.dirname(os.path.abspath(__file__))
    )
)

MODELS_DIR = os.path.join(BASE_DIR, "ml_model", "models")
VERSION_PATH = os.path.join(BASE_DIR, "ml_model", "model_version.txt")
METRICS_PATH = os.path.join(BASE_DIR, "ml_model", "metrics_latest.json")

DEFAULT_THRESHOLD = 14

# ----------------------------------------
# SIMPLE IN-MEMORY CACHE (hot reload)
# ----------------------------------------
_model_cache = {}  # key -> (model_obj, mtime)


def _normalize_bg(bg: str) -> str:
    # accept "O+", "o+", " O+ "
    bg = (bg or "").strip().upper()
    bg = bg.replace(" ", "")
    return bg


def _normalize_city(city: str) -> str:
    # model files use city like "Hyderabad"
    city = (city or "").strip()
    return city.title()


def _read_text_file(path: str):
    if not os.path.exists(path):
        return None
    with open(path, "r", encoding="utf-8") as f:
        return f.read().strip()


def _find_model_path(blood_group: str, city: str) -> str:
    """
    Find model file saved by train_model.py.

    Your training saved files like:
        O+__Hyderabad.pkl

    So this must match exactly:
        {blood_group}__{city}.pkl
    """
    if not os.path.isdir(MODELS_DIR):
        raise HTTPException(
            status_code=500,
            detail=f"Models folder not found: {MODELS_DIR}. Run: python ml_model\\train_model.py"
        )

    bg = _normalize_bg(blood_group)
    ct = _normalize_city(city)

    if not bg or not ct:
        raise HTTPException(status_code=400, detail="blood_group and city are required")

    filename = f"{bg}__{ct}.pkl"
    model_path = os.path.join(MODELS_DIR, filename)

    if not os.path.exists(model_path):
        raise HTTPException(
            status_code=404,
            detail=f"Model not trained for blood_group={bg}, city={ct}. Train first."
        )

    return model_path


def _load_model(blood_group: str, city: str):
    bg = _normalize_bg(blood_group)
    ct = _normalize_city(city)

    model_path = _find_model_path(bg, ct)

    mtime = os.path.getmtime(model_path)
    cache_key = f"{bg}|{ct}"

    if cache_key in _model_cache:
        cached_model, cached_mtime = _model_cache[cache_key]
        if cached_mtime == mtime:
            return cached_model

    model = joblib.load(model_path)
    _model_cache[cache_key] = (model, mtime)
    return model


@router.get("/")
def forecast_demand(
    blood_group: str,
    city: str,
    days: int = 15,
    threshold: int = DEFAULT_THRESHOLD
):
    """
    Forecast blood demand using pre-trained Prophet model for a specific blood_group + city.
    """

    if days < 1 or days > 365:
        raise HTTPException(status_code=400, detail="days must be between 1 and 365")

    model = _load_model(blood_group, city)

    future = model.make_future_dataframe(periods=days, freq="D")
    forecast = model.predict(future)

    result = forecast[["ds", "yhat", "yhat_lower", "yhat_upper"]].tail(days).copy()

    # rounding
    result["yhat"] = result["yhat"].round(2)
    result["yhat_lower"] = result["yhat_lower"].round(2)
    result["yhat_upper"] = result["yhat_upper"].round(2)

    # alert flag
    result["alert"] = result["yhat"].apply(
        lambda x: "HIGH DEMAND" if x > threshold else "Normal"
    )

    result["ds"] = result["ds"].astype(str)

    model_version = _read_text_file(VERSION_PATH)
    bg_norm = _normalize_bg(blood_group)
    ct_norm = _normalize_city(city)

    return {
        "blood_group": bg_norm,
        "city": ct_norm,
        "forecast_days": days,
        "emergency_threshold": threshold,
        "model_version": model_version,
        "model_file_used": os.path.basename(_find_model_path(bg_norm, ct_norm)),
        "predictions": result.to_dict(orient="records"),
    }


@router.get("/metrics")
def forecast_metrics():
    """
    Returns latest model evaluation metrics saved during training.
    """
    if not os.path.exists(METRICS_PATH):
        raise HTTPException(
            status_code=404,
            detail="metrics_latest.json not found. Run: python ml_model\\train_model.py"
        )

    with open(METRICS_PATH, "r", encoding="utf-8") as f:
        return json.load(f)