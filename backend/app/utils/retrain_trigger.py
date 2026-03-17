import os
import json
import subprocess
import sys
from datetime import datetime, timezone

from sqlalchemy import text
from app.database import engine


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _get_backend_dir() -> str:
    # backend/app/utils/retrain_trigger.py -> backend/
    return os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def _get_ml_dir() -> str:
    return os.path.join(_get_backend_dir(), "ml_model")


def _state_path() -> str:
    return os.path.join(_get_ml_dir(), "train_state.json")


def _load_state() -> dict:
    path = _state_path()
    if not os.path.exists(path):
        return {
            "last_trained_at_utc": None,
            "last_seen_allocation_id": 0,
            "min_new_allocations_to_retrain": 10,
            "max_hours_without_retrain": 24
        }
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def _save_state(state: dict) -> None:
    path = _state_path()
    with open(path, "w", encoding="utf-8") as f:
        json.dump(state, f, indent=2)


def _get_latest_allocation_id() -> int:
    # SQLAlchemy 2.x safe execution
    with engine.connect() as conn:
        result = conn.execute(text("SELECT COALESCE(MAX(id), 0) AS max_id FROM emergency_allocations"))
        row = result.first()
        return int(row[0]) if row else 0


def _hours_since(iso_dt: str | None) -> float:
    if not iso_dt:
        return 1e9  # very large so first time triggers
    dt = datetime.fromisoformat(iso_dt)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    delta = datetime.now(timezone.utc) - dt
    return delta.total_seconds() / 3600.0


def _run_training_script() -> None:
    backend_dir = _get_backend_dir()
    train_script = os.path.join(backend_dir, "ml_model", "train_model.py")

    # Use current venv python to run training script
    subprocess.run([sys.executable, train_script], check=True)


def trigger_retrain_if_needed() -> dict:
    """
    Smart retrain trigger:
    - Retrains only if new allocations >= threshold OR time since last train >= max_hours.
    - Uses SQLAlchemy 2.x compatible DB query (no engine.execute).
    """
    state = _load_state()

    latest_id = _get_latest_allocation_id()
    last_seen = int(state.get("last_seen_allocation_id", 0))

    new_allocations = max(0, latest_id - last_seen)

    min_new = int(state.get("min_new_allocations_to_retrain", 10))
    max_hours = float(state.get("max_hours_without_retrain", 24))
    hours_since_last = _hours_since(state.get("last_trained_at_utc"))

    should_retrain = (new_allocations >= min_new) or (hours_since_last >= max_hours)

    if not should_retrain:
        msg = f"ℹ Retraining not required (new_allocations={new_allocations}/{min_new}, hours_since_last={hours_since_last:.2f}/{max_hours})"
        print(msg)
        return {"retrained": False, "message": msg, "new_allocations": new_allocations, "latest_allocation_id": latest_id}

    print(f"🔁 Smart retraining triggered (new_allocations={new_allocations}, hours_since_last={hours_since_last:.2f})")
    _run_training_script()

    # Update state AFTER successful training
    state["last_trained_at_utc"] = _utc_now_iso()
    state["last_seen_allocation_id"] = latest_id
    _save_state(state)

    msg = "✅ Retraining completed and state updated"
    print(msg)
    return {"retrained": True, "message": msg, "new_allocations": new_allocations, "latest_allocation_id": latest_id}