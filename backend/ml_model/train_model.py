import os
import json
import joblib
import pandas as pd
from datetime import datetime, timezone

from prophet import Prophet
from sqlalchemy import create_engine, text
from sklearn.metrics import mean_absolute_error

# =========================================================
# Multi-model training: 1 model per (blood_group + patient_city)
# Data source: demand_daily table
# Saves models to: backend/ml_model/models/<BG>__<CITY>.pkl
# Saves version + metrics:
#   - backend/ml_model/model_version.txt
#   - backend/ml_model/train_state.json
#   - backend/ml_model/metrics_latest.json
#   - backend/ml_model/metrics_history.csv
# =========================================================


# ----------------------------------------
# PATH SETUP
# ----------------------------------------
ML_DIR = os.path.dirname(os.path.abspath(__file__))     # backend/ml_model
BASE_DIR = os.path.dirname(ML_DIR)                      # backend
DB_PATH = os.path.join(BASE_DIR, "jeevasetu.db")

MODELS_DIR = os.path.join(ML_DIR, "models")
os.makedirs(MODELS_DIR, exist_ok=True)

VERSION_PATH = os.path.join(ML_DIR, "model_version.txt")
STATE_PATH = os.path.join(ML_DIR, "train_state.json")

METRICS_JSON_PATH = os.path.join(ML_DIR, "metrics_latest.json")
METRICS_CSV_PATH = os.path.join(ML_DIR, "metrics_history.csv")

engine = create_engine(f"sqlite:///{DB_PATH}")


# ----------------------------------------
# HELPERS
# ----------------------------------------
def create_model():
    return Prophet(
        weekly_seasonality=True,
        yearly_seasonality=False,
        daily_seasonality=False,
        changepoint_prior_scale=0.05,
    )


def safe_mape(y_true, y_pred):
    y_true = pd.Series(y_true).astype(float)
    y_pred = pd.Series(y_pred).astype(float)
    denom = y_true.replace(0, pd.NA).abs()
    mape = ((y_true - y_pred).abs() / denom).dropna().mean()
    return float(mape * 100) if pd.notna(mape) else None


def sanitize(text_value: str) -> str:
    # safe filename
    s = str(text_value).strip()
    s = s.replace("/", "_").replace("\\", "_").replace(":", "_")
    s = s.replace(" ", "_")
    return s


def read_state_defaults():
    defaults = {
        "last_trained_at_utc": None,
        "last_seen_allocation_id": 0,
        "min_new_allocations_to_retrain": 10,
        "max_hours_without_retrain": 24,
    }
    if os.path.exists(STATE_PATH):
        try:
            with open(STATE_PATH, "r", encoding="utf-8") as f:
                existing = json.load(f) or {}
            defaults["min_new_allocations_to_retrain"] = int(existing.get("min_new_allocations_to_retrain", 10))
            defaults["max_hours_without_retrain"] = float(existing.get("max_hours_without_retrain", 24))
        except Exception:
            pass
    return defaults


def write_version_and_state(version_iso: str, latest_allocation_id: int):
    with open(VERSION_PATH, "w", encoding="utf-8") as f:
        f.write(version_iso)

    state_defaults = read_state_defaults()
    state = {
        "last_trained_at_utc": version_iso,
        "last_seen_allocation_id": int(latest_allocation_id),
        "min_new_allocations_to_retrain": state_defaults["min_new_allocations_to_retrain"],
        "max_hours_without_retrain": state_defaults["max_hours_without_retrain"],
    }

    with open(STATE_PATH, "w", encoding="utf-8") as f:
        json.dump(state, f, indent=2)

    return state


def save_metrics(metrics_payload: dict):
    # latest json
    with open(METRICS_JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(metrics_payload, f, indent=2)

    # append to csv history (one line per training run)
    flat = {
        "trained_at_utc": metrics_payload.get("trained_at_utc"),
        "latest_allocation_id": metrics_payload.get("latest_allocation_id"),
        "series_trained": metrics_payload.get("series_trained"),
        "series_skipped": metrics_payload.get("series_skipped"),
        "total_rows": metrics_payload.get("total_rows"),
        "avg_mae": metrics_payload.get("avg_mae"),
        "avg_mape_percent": metrics_payload.get("avg_mape_percent"),
    }

    row = pd.DataFrame([flat])
    if not os.path.exists(METRICS_CSV_PATH):
        row.to_csv(METRICS_CSV_PATH, index=False)
    else:
        row.to_csv(METRICS_CSV_PATH, mode="a", header=False, index=False)


# ----------------------------------------
# LOAD DATA FROM demand_daily
# ----------------------------------------
def load_demand_daily() -> pd.DataFrame:
    q = text("""
        SELECT ds, blood_group, patient_city, y
        FROM demand_daily
    """)
    df = pd.read_sql(q, engine)

    if df.empty:
        return df

    df["ds"] = pd.to_datetime(df["ds"], errors="coerce")
    df["y"] = pd.to_numeric(df["y"], errors="coerce")
    df["blood_group"] = df["blood_group"].astype(str).str.strip()
    df["patient_city"] = df["patient_city"].astype(str).str.strip()

    df = df.dropna(subset=["ds", "y", "blood_group", "patient_city"])

    # aggregate duplicates if any
    df = (
        df.groupby(["ds", "blood_group", "patient_city"], as_index=False)["y"]
        .sum()
        .sort_values(["blood_group", "patient_city", "ds"])
        .reset_index(drop=True)
    )
    return df


def latest_allocation_id() -> int:
    q = text("SELECT MAX(id) AS max_id FROM emergency_allocations")
    try:
        df = pd.read_sql(q, engine)
        if df.empty or pd.isna(df.loc[0, "max_id"]):
            return 0
        return int(df.loc[0, "max_id"])
    except Exception:
        return 0


# ----------------------------------------
# TRAIN ONE MODEL PER SERIES
# ----------------------------------------
def train_series(series_df: pd.DataFrame):
    """
    Input series_df: columns [ds, y] sorted by ds
    Returns: (final_model, mae, mape, rows_total, rows_train, rows_test)
    """
    series_df = series_df.sort_values("ds").reset_index(drop=True)

    # rolling window: last 3 years
    cutoff = series_df["ds"].max() - pd.DateOffset(years=3)
    series_df = series_df[series_df["ds"] >= cutoff].reset_index(drop=True)

    if len(series_df) < 30:
        # too small to evaluate reliably
        return None, None, None, len(series_df), 0, 0

    split_idx = int(len(series_df) * 0.8)
    train_df = series_df.iloc[:split_idx].copy()
    test_df = series_df.iloc[split_idx:].copy()

    # eval model
    eval_model = create_model()
    eval_model.fit(train_df)

    future_test = eval_model.make_future_dataframe(periods=len(test_df), freq="D")
    fc_test = eval_model.predict(future_test).tail(len(test_df))

    y_pred = fc_test["yhat"].values
    y_true = test_df["y"].values

    mae = float(mean_absolute_error(y_true, y_pred))
    mape = safe_mape(y_true, y_pred)

    # final model
    final_model = create_model()
    final_model.fit(series_df)

    return final_model, mae, mape, len(series_df), len(train_df), len(test_df)


def main():
    df = load_demand_daily()
    if df.empty:
        raise RuntimeError(
            "demand_daily table is empty or missing.\n"
            "Fix it first, then run: python ml_model\\update_demand_daily.py"
        )

    latest_id = latest_allocation_id()
    trained_at = datetime.now(timezone.utc).isoformat()

    series_metrics = []
    series_trained = 0
    series_skipped = 0

    maes = []
    mapes = []

    for (bg, city), g in df.groupby(["blood_group", "patient_city"]):
        series = g[["ds", "y"]].copy()

        model, mae, mape, rows_total, rows_train, rows_test = train_series(series)

        if model is None:
            series_skipped += 1
            series_metrics.append({
                "blood_group": bg,
                "patient_city": city,
                "rows_total": int(rows_total),
                "skipped_reason": "not_enough_data(<30_days)",
            })
            continue

        # save model
        model_file = f"{sanitize(bg)}__{sanitize(city)}.pkl"
        model_path = os.path.join(MODELS_DIR, model_file)
        joblib.dump(model, model_path)

        series_trained += 1
        maes.append(mae)
        if mape is not None:
            mapes.append(mape)

        series_metrics.append({
            "blood_group": bg,
            "patient_city": city,
            "model_file": model_file,
            "rows_total": int(rows_total),
            "rows_train": int(rows_train),
            "rows_test": int(rows_test),
            "mae": round(mae, 4),
            "mape_percent": round(mape, 4) if mape is not None else None,
        })

    # write version + state
    write_version_and_state(trained_at, latest_id)

    avg_mae = float(pd.Series(maes).mean()) if maes else None
    avg_mape = float(pd.Series(mapes).mean()) if mapes else None

    payload = {
        "trained_at_utc": trained_at,
        "latest_allocation_id": int(latest_id),
        "models_dir": MODELS_DIR,
        "series_trained": int(series_trained),
        "series_skipped": int(series_skipped),
        "total_rows": int(len(df)),
        "avg_mae": round(avg_mae, 4) if avg_mae is not None else None,
        "avg_mape_percent": round(avg_mape, 4) if avg_mape is not None else None,
        "series_metrics": series_metrics,
    }

    save_metrics(payload)

    print("✅ Multi-model training complete")
    print(f"🧠 Series trained: {series_trained} | skipped: {series_skipped}")
    print(f"📦 Models saved to: {MODELS_DIR}")
    print(f"🕒 Model version saved to: {VERSION_PATH}")
    print(f"🧠 Training state updated in: {STATE_PATH}")
    print(f"📊 Metrics saved to: {METRICS_JSON_PATH} and {METRICS_CSV_PATH}")


if __name__ == "__main__":
    main()