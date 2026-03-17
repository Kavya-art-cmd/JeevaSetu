from fastapi import APIRouter
from sqlalchemy import text
from datetime import datetime
from app.database import engine

router = APIRouter(tags=["System"])


@router.get("/health")
def health_check():
    """
    System health monitoring endpoint.
    Checks API status and database connectivity.
    """

    db_status = "unknown"

    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception:
        db_status = "disconnected"

    return {
        "system": "JeevaSetu API",
        "status": "running",
        "database": db_status,
        "timestamp": datetime.utcnow(),
        "version": "1.0"
    }