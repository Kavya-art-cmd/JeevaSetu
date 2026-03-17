from sqlalchemy import create_engine, text
import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # backend/
DB_PATH = os.path.join(BASE_DIR, "jeevasetu.db")

engine = create_engine(f"sqlite:///{DB_PATH}")

CREATE_SQL = """
CREATE TABLE IF NOT EXISTS demand_daily (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ds DATE NOT NULL,
    blood_group TEXT NOT NULL,
    city TEXT NOT NULL,
    y INTEGER NOT NULL,
    UNIQUE(ds, blood_group, city)
);
"""

if __name__ == "__main__":
    with engine.begin() as conn:
        conn.execute(text(CREATE_SQL))
    print("✅ demand_daily table created/verified in jeevasetu.db")