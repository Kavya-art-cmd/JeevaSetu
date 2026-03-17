import os
import pandas as pd
from sqlalchemy import create_engine, text

# ----------------------------------------
# PATH SETUP
# ----------------------------------------
ML_DIR = os.path.dirname(os.path.abspath(__file__))   # backend/ml_model
BASE_DIR = os.path.dirname(ML_DIR)                    # backend
DB_PATH = os.path.join(BASE_DIR, "jeevasetu.db")

engine = create_engine(f"sqlite:///{DB_PATH}")


def update_demand_daily():
    # ✅ Ensure table exists (DO NOT DROP)
    create_sql = text("""
    CREATE TABLE IF NOT EXISTS demand_daily (
        ds TEXT NOT NULL,
        blood_group TEXT NOT NULL,
        patient_city TEXT NOT NULL,
        y INTEGER NOT NULL,
        PRIMARY KEY (ds, blood_group, patient_city)
    );
    """)

    # Pull allocations (each row = 1 unit demand)
    query = """
    SELECT allocated_at, blood_group, patient_city
    FROM emergency_allocations
    WHERE allocated_at IS NOT NULL
      AND blood_group IS NOT NULL
      AND patient_city IS NOT NULL
    """

    db_df = pd.read_sql(query, engine)

    if db_df.empty:
        print("ℹ No allocations found. Nothing to update.")
        return

    db_df["allocated_at"] = pd.to_datetime(db_df["allocated_at"], errors="coerce")
    db_df = db_df.dropna(subset=["allocated_at"])

    # Daily bucket
    db_df["ds"] = db_df["allocated_at"].dt.strftime("%Y-%m-%d")

    grouped = (
        db_df.groupby(["ds", "blood_group", "patient_city"])
        .size()
        .reset_index(name="y")
    )

    # ✅ Upsert: add new y on top of existing y (keeps seeded baseline)
    upsert_sql = text("""
    INSERT INTO demand_daily (ds, blood_group, patient_city, y)
    VALUES (:ds, :blood_group, :patient_city, :y)
    ON CONFLICT(ds, blood_group, patient_city)
    DO UPDATE SET y = demand_daily.y + excluded.y;
    """)

    with engine.begin() as conn:
        conn.execute(create_sql)

        for _, row in grouped.iterrows():
            conn.execute(
                upsert_sql,
                {
                    "ds": row["ds"],
                    "blood_group": row["blood_group"],
                    "patient_city": row["patient_city"],
                    "y": int(row["y"]),
                },
            )

        # show final count
        final_count = conn.execute(text("SELECT COUNT(*) FROM demand_daily")).scalar()

    print(f"✅ demand_daily updated. Total rows now: {final_count}")


if __name__ == "__main__":
    update_demand_daily()