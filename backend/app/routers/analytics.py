from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta

from app.database import get_db
from app import models

router = APIRouter(tags=["Analytics"])


CITY_COORDINATES = {
    "Hyderabad": {"lat": 17.3850, "lng": 78.4867},
    "Mumbai": {"lat": 19.0760, "lng": 72.8777},
    "Warangal": {"lat": 17.9689, "lng": 79.5941},
    "Karimnagar": {"lat": 18.4386, "lng": 79.1288},
    "Nizamabad": {"lat": 18.6725, "lng": 78.0941},
}


@router.get("/analytics/blood-demand-heatmap")
def blood_demand_heatmap(
    blood_group: str | None = Query(default=None),
    db: Session = Depends(get_db)
):
    last_30_days = datetime.utcnow() - timedelta(days=30)

    query = db.query(
        models.EmergencyAllocation.patient_city,
        models.EmergencyAllocation.patient_state,
        models.EmergencyAllocation.blood_group,
        func.count(models.EmergencyAllocation.id).label("demand")
    ).filter(
        models.EmergencyAllocation.allocated_at >= last_30_days
    )

    if blood_group:
        query = query.filter(models.EmergencyAllocation.blood_group == blood_group)

    results = query.group_by(
        models.EmergencyAllocation.patient_city,
        models.EmergencyAllocation.patient_state,
        models.EmergencyAllocation.blood_group
    ).order_by(
        func.count(models.EmergencyAllocation.id).desc()
    ).all()

    merged = {}

    for row in results:
        city = row.patient_city.split()[0]
        key = (city, row.patient_state, row.blood_group)

        if key not in merged:
            merged[key] = 0

        merged[key] += row.demand

    heatmap = []

    for (city, state, blood_group), demand in merged.items():
        coords = CITY_COORDINATES.get(city, {"lat": None, "lng": None})

        heatmap.append({
            "city": city,
            "state": state,
            "blood_group": blood_group,
            "demand": demand,
            "lat": coords["lat"],
            "lng": coords["lng"]
        })

    heatmap.sort(key=lambda x: x["demand"], reverse=True)

    total_requests = sum(row["demand"] for row in heatmap)

    return {
        "total_requests": total_requests,
        "blood_group_filter": blood_group,
        "heatmap": heatmap
    }