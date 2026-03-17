from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from datetime import datetime, date, timedelta

from app.database import get_db
from app import models

# ✅ AUTH + RBAC
from app.utils.auth import get_current_user, require_roles

# ✅ Smart retrain hook (lightweight trigger)
from app.utils.retrain_trigger import trigger_retrain_if_needed


router = APIRouter(
    tags=["Emergency"],
    dependencies=[Depends(get_current_user)],
)

DONATION_GAP_DAYS = 90


@router.post("/emergency/donor/{donor_id}/complete")
def complete_emergency_by_donor(
    donor_id: int,
    db: Session = Depends(get_db),
    _user=Depends(require_roles(["HOSPITAL", "ADMIN"]))
):
    """
    Completes the latest emergency allocation for a donor.
    - Marks latest ALLOCATED allocation -> COMPLETED
    - Always unlocks donor (defensive)
    - Moves donor into cooldown window (90 days)
    """

    donor = db.query(models.Donor).filter(models.Donor.id == donor_id).first()
    if not donor:
        raise HTTPException(status_code=404, detail="Donor not found")

    now = datetime.utcnow()
    today = date.today()

    # ✅ Find latest allocation for this donor (ALLOCATED or COMPLETED)
    allocation = (
        db.query(models.EmergencyAllocation)
        .filter(models.EmergencyAllocation.donor_id == donor_id)
        .order_by(models.EmergencyAllocation.id.desc())
        .first()
    )

    # ✅ If there is an ALLOCATED one, complete it
    if allocation and allocation.status == "ALLOCATED":
        allocation.status = "COMPLETED"
        allocation.completed_at = now

    # ✅ Always unlock donor defensively
    donor.is_locked = False
    donor.allocated_at = None

    # ✅ Donor goes to cooldown because donation happened
    donor.last_donation_date = today
    donor.cooldown_until = now + timedelta(days=DONATION_GAP_DAYS)

    # ✅ Keep ineligible during cooldown (your lifecycle can auto-reactivate later)
    donor.is_active = False

    db.commit()
    db.refresh(donor)

    # ✅ Trigger retrain check (safe)
    try:
        result = trigger_retrain_if_needed()
        print("🧠 Retrain Trigger Result:", result)
    except Exception as e:
        print("⚠ Smart retrain check failed:", e)

    return {
        "status": "EMERGENCY_COMPLETED",
        "donor_id": donor.id,
        "allocation_id": allocation.id if allocation else None,
        "allocation_status": allocation.status if allocation else None,
        "donor_locked": donor.is_locked,
        "cooldown_until": donor.cooldown_until,
        "message": "Emergency completion processed. Donor unlocked and moved to cooldown."
    }