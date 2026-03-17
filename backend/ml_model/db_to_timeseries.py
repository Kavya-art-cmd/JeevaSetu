import pandas as pd
from sqlalchemy import create_engine
import os

# -----------------------------------
# Locate Database Path
# -----------------------------------
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BASE_DIR, "jeevasetu.db")

engine = create_engine(f"sqlite:///{DB_PATH}")

# -----------------------------------
# Load Allocation Data
# -----------------------------------
query = """
SELECT allocated_at
FROM emergency_allocations
WHERE allocated_at IS NOT NULL
"""

df = pd.read_sql(query, engine)

if df.empty:
    print("❌ No allocation data found in database.")
    exit()

# -----------------------------------
# Convert to Daily Demand
# -----------------------------------
df["allocated_at"] = pd.to_datetime(df["allocated_at"])
df["date"] = df["allocated_at"].dt.date

daily_demand = (
    df.groupby("date")
    .size()
    .reset_index(name="y")
)

daily_demand.rename(columns={"date": "ds"}, inplace=True)
daily_demand["ds"] = pd.to_datetime(daily_demand["ds"])

# -----------------------------------
# Save as Prophet Dataset
# -----------------------------------
OUTPUT_PATH = os.path.join(BASE_DIR, "ml_model", "blood_demand_from_db.csv")
daily_demand.to_csv(OUTPUT_PATH, index=False)

print("✅ Time series dataset created from database.")
print(daily_demand.head())