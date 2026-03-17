from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app import models
from app.utils.auth import get_current_user
from datetime import date, timedelta
import os
import joblib

router = APIRouter(
    prefix="/dashboard",
    tags=["Dashboard"]
)

# =====================================================
# 🔐 PROTECTED Dashboard Stats
# =====================================================
@router.get("/stats")
def dashboard_stats(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    total_donors = db.query(models.Donor).count()
    active = db.query(models.Donor).filter(models.Donor.is_active == True).count()
    cooldown = db.query(models.Donor).filter(models.Donor.cooldown_until != None).count()
    inactive = db.query(models.Donor).filter(
        models.Donor.is_active == False,
        models.Donor.has_chronic_disease == False
    ).count()
    emergency_reserved = db.query(models.Donor).filter(models.Donor.is_locked == True).count()

    # Blood group distribution
    blood_groups = {}
    for bg, count in db.query(
        models.Donor.blood_group,
        models.Donor.id
    ).group_by(models.Donor.blood_group).all():
        blood_groups[bg] = count

    blood_group_percentages = {
        bg: round((count / total_donors) * 100, 2)
        for bg, count in blood_groups.items()
    } if total_donors else {}

    # City distribution
    cities = {}
    for city, count in db.query(
        models.Donor.city,
        models.Donor.id
    ).group_by(models.Donor.city).all():
        cities[city] = count

    city_percentages = {
        city: round((count / total_donors) * 100, 2)
        for city, count in cities.items()
    } if total_donors else {}

    # State distribution
    states = {}
    for state, count in db.query(
        models.Donor.state,
        models.Donor.id
    ).group_by(models.Donor.state).all():
        states[state] = count

    state_percentages = {
        state: round((count / total_donors) * 100, 2)
        for state, count in states.items()
    } if total_donors else {}

    today = date.today()
    next_7_days = today + timedelta(days=7)

    upcoming_eligible = db.query(models.Donor).filter(
        models.Donor.cooldown_until != None,
        models.Donor.cooldown_until <= next_7_days
    ).count()

    return {
        "accessed_by": current_user.email,
        "total_donors": total_donors,
        "active": active,
        "cooldown": cooldown,
        "inactive": inactive,
        "emergency_reserved": emergency_reserved,
        "blood_group_distribution": blood_groups,
        "blood_group_percentages": blood_group_percentages,
        "city_distribution": cities,
        "city_percentages": city_percentages,
        "state_distribution": states,
        "state_percentages": state_percentages,
        "upcoming_eligible_next_7_days": upcoming_eligible
    }


# =====================================================
# 🔐 PROTECTED Forecast Series (Chart API)
# =====================================================

BASE_DIR = os.path.dirname(
    os.path.dirname(
        os.path.dirname(os.path.abspath(__file__))
    )
)

MODELS_DIR = os.path.join(BASE_DIR, "ml_model", "models")
DEFAULT_THRESHOLD = 14

_model_cache = {}


def _normalize_bg(bg: str) -> str:
    return (bg or "").strip().upper().replace(" ", "")


def _normalize_city(city: str) -> str:
    return (city or "").strip().title()


def _model_filename(blood_group: str, city: str) -> str:
    safe_city = city.replace(" ", "_")
    return f"{blood_group}__{safe_city}.pkl"


def _load_model(blood_group: str, city: str):
    blood_group = _normalize_bg(blood_group)
    city = _normalize_city(city)

    if not blood_group or not city:
        raise HTTPException(status_code=400, detail="blood_group and city are required")

    if not os.path.isdir(MODELS_DIR):
        raise HTTPException(
            status_code=500,
            detail=f"Models folder not found: {MODELS_DIR}. Run: python ml_model\\train_model.py"
        )

    model_file = _model_filename(blood_group, city)
    model_path = os.path.join(MODELS_DIR, model_file)

    if not os.path.exists(model_path):
        raise HTTPException(
            status_code=404,
            detail=f"Model not trained for blood_group={blood_group}, city={city}. Train first."
        )

    mtime = os.path.getmtime(model_path)
    key = f"{blood_group}|{city}"

    if key in _model_cache:
        cached_model, cached_mtime = _model_cache[key]
        if cached_mtime == mtime:
            return cached_model, model_file

    model = joblib.load(model_path)
    _model_cache[key] = (model, mtime)
    return model, model_file


@router.get("/forecast-series")
def dashboard_forecast_series(
    blood_group: str,
    city: str,
    days: int = 15,
    threshold: int = DEFAULT_THRESHOLD,
    current_user: models.User = Depends(get_current_user)
):
    """
    Chart-ready forecast data for dashboard line chart.
    """

    if days < 1 or days > 365:
        raise HTTPException(status_code=400, detail="days must be between 1 and 365")

    model, model_file_used = _load_model(blood_group, city)

    future = model.make_future_dataframe(periods=days, freq="D")
    forecast = model.predict(future).tail(days).copy()

    forecast["yhat"] = forecast["yhat"].round(2)

    labels = forecast["ds"].astype(str).tolist()
    values = forecast["yhat"].tolist()
    alerts = ["HIGH DEMAND" if v > threshold else "Normal" for v in values]

    points = [
        {
            "ds": labels[i],
            "yhat": values[i],
            "alert": alerts[i]
        }
        for i in range(len(labels))
    ]

    return {
        "accessed_by": current_user.email,
        "blood_group": _normalize_bg(blood_group),
        "city": _normalize_city(city),
        "days": days,
        "threshold": threshold,
        "model_file_used": model_file_used,
        "labels": labels,
        "values": values,
        "alerts": alerts,
        "points": points
    }