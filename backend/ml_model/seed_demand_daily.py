import os
import pandas as pd
from datetime import datetime, timedelta
from sqlalchemy import create_engine, text

ML_DIR = os.path.dirname(os.path.abspath(__file__))
BASE_DIR = os.path.dirname(ML_DIR)
DB_PATH = os.path.join(BASE_DIR, "jeevasetu.db")

# Seed these series so forecasting works in demo/frontend
SERIES_TO_SEED = [
    ("O+", "Hyderabad"),
    ("O+", "Mumbai"),
]

DAYS = 365


def ensure_table(engine):
    # If demand_daily exists but has no PK, ON CONFLICT will fail.
    # We ensure correct schema here.
    with engine.begin() as conn:
        conn.execute(text("""
        CREATE TABLE IF NOT EXISTS demand_daily (
            ds TEXT NOT NULL,
            blood_group TEXT NOT NULL,
            patient_city TEXT NOT NULL,
            y INTEGER NOT NULL,
            PRIMARY KEY (ds, blood_group, patient_city)
        );
        """))


def seed_series(engine, blood_group: str, city: str):
    end = datetime.utcnow().date()
    start = end - timedelta(days=DAYS - 1)
    dates = pd.date_range(start=start, end=end, freq="D")

    # Simple synthetic baseline (you can improve later)
    df = pd.DataFrame({
        "ds": dates.strftime("%Y-%m-%d"),
        "blood_group": blood_group,
        "patient_city": city,
        "y": 10
    })

    upsert = text("""
    INSERT INTO demand_daily (ds, blood_group, patient_city, y)
    VALUES (:ds, :blood_group, :patient_city, :y)
    ON CONFLICT(ds, blood_group, patient_city)
    DO UPDATE SET y = excluded.y;
    """)

    with engine.begin() as conn:
        for r in df.to_dict(orient="records"):
            conn.execute(upsert, r)

    print(f"✅ Seeded demand_daily with {len(df)} rows for ({blood_group}, {city}).")


def main():
    engine = create_engine(f"sqlite:///{DB_PATH}")
    ensure_table(engine)

    for bg, city in SERIES_TO_SEED:
        seed_series(engine, bg, city)

    print("ℹ Now run update_demand_daily.py to add real allocations on top.")


if __name__ == "__main__":
    main()