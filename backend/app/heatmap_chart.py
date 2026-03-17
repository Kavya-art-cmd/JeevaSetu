import pandas as pd
import plotly.express as px
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta

from app.database import SessionLocal
from app import models


CITY_COORDINATES = {
    "Hyderabad": {"lat": 17.3850, "lng": 78.4867},
    "Mumbai": {"lat": 19.0760, "lng": 72.8777},
    "Warangal": {"lat": 17.9689, "lng": 79.5941},
    "Karimnagar": {"lat": 18.4386, "lng": 79.1288},
    "Nizamabad": {"lat": 18.6725, "lng": 78.0941},
}


def build_heatmap():
    db: Session = SessionLocal()

    try:
        last_30_days = datetime.utcnow() - timedelta(days=30)

        results = db.query(
            models.EmergencyAllocation.patient_city,
            models.EmergencyAllocation.patient_state,
            models.EmergencyAllocation.blood_group,
            func.count(models.EmergencyAllocation.id).label("demand")
        ).filter(
            models.EmergencyAllocation.allocated_at >= last_30_days
        ).group_by(
            models.EmergencyAllocation.patient_city,
            models.EmergencyAllocation.patient_state,
            models.EmergencyAllocation.blood_group
        ).all()

        merged = {}

        for row in results:
            city = row.patient_city.split()[0]
            key = (city, row.patient_state, row.blood_group)

            if key not in merged:
                merged[key] = 0

            merged[key] += row.demand

        rows = []

        for (city, state, blood_group), demand in merged.items():
            coords = CITY_COORDINATES.get(city, {"lat": None, "lng": None})

            rows.append({
                "city": city,
                "state": state,
                "blood_group": blood_group,
                "demand": demand,
                "lat": coords["lat"],
                "lng": coords["lng"]
            })

        df = pd.DataFrame(rows)

        fig = px.scatter_mapbox(
            df,
            lat="lat",
            lon="lng",
            size="demand",
            color="demand",
            hover_name="city",
            hover_data=["state", "blood_group", "demand"],
            zoom=4,
            height=600,
            title="Regional Blood Demand Heatmap (Last 30 Days)"
        )

        fig.update_layout(mapbox_style="open-street-map")
        fig.write_html("blood_demand_heatmap.html")

        print("Heatmap saved as blood_demand_heatmap.html")

    finally:
        db.close()


if __name__ == "__main__":
    build_heatmap()