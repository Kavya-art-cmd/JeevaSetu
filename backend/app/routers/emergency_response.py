from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from datetime import datetime
from sqlalchemy.orm import Session

from app.database import get_db
from app import models
from app.utils.auth import get_current_user


router = APIRouter(
    prefix="/emergency",
    tags=["Emergency Response"],
    dependencies=[Depends(get_current_user)]
)


class EmergencyResponseRequest(BaseModel):
    donor_id: int
    response: str
    note: str | None = None


@router.post("/response")
def emergency_response(
    payload: EmergencyResponseRequest,
    db: Session = Depends(get_db)
):
    donor = db.query(models.Donor).filter(
        models.Donor.id == payload.donor_id
    ).first()

    if not donor:
        raise HTTPException(status_code=404, detail="Donor not found")

    resp = (payload.response or "").strip().upper()
    now = datetime.utcnow()

    latest_allocation = db.query(models.EmergencyAllocation).filter(
        models.EmergencyAllocation.donor_id == donor.id
    ).order_by(models.EmergencyAllocation.id.desc()).first()

    before_status = donor.status
    before_active = donor.is_active
    before_locked = donor.is_locked

    if resp == "ACCEPTED":
        donor.status = "DONOR_ACCEPTED"
        donor.is_locked = True
        donor.is_active = False

        if latest_allocation:
            latest_allocation.response_status = "ACCEPTED"
            latest_allocation.response_time = now
            latest_allocation.response_note = payload.note
            latest_allocation.status = "ACCEPTED"

    elif resp == "DECLINED":
        donor.status = "DONOR_DECLINED"
        donor.is_locked = False
        donor.is_active = True

        if latest_allocation:
            latest_allocation.response_status = "DECLINED"
            latest_allocation.response_time = now
            latest_allocation.response_note = payload.note
            latest_allocation.status = "DECLINED"

    else:
        raise HTTPException(
            status_code=400,
            detail="response must be either 'accepted' or 'declined'"
        )

    db.commit()
    db.refresh(donor)

    donor_check = db.query(models.Donor).filter(
        models.Donor.id == payload.donor_id
    ).first()

    return {
        "message": "Emergency response processed",
        "before": {
            "status": before_status,
            "is_active": before_active,
            "is_locked": before_locked
        },
        "after_refresh": {
            "status": donor.status,
            "is_active": donor.is_active,
            "is_locked": donor.is_locked
        },
        "after_requery": {
            "status": donor_check.status,
            "is_active": donor_check.is_active,
            "is_locked": donor_check.is_locked
        },
        "allocation_found": latest_allocation is not None,
        "allocation_status": latest_allocation.status if latest_allocation else None,
        "timestamp": now.isoformat()
    }