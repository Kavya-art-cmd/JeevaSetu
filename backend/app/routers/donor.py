from fastapi import APIRouter, Depends, status, HTTPException, Query
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from datetime import date, datetime, timedelta

from app.database import get_db
from app import models
from app.schemas.donor import DonorCreate, DonorResponse

from app.utils.auth import get_current_user, require_roles
from app.routers import donor_health


router = APIRouter(
    prefix="/donors",
    tags=["Donors"],
    dependencies=[Depends(get_current_user)]
)

COOLDOWN_DAYS = 90


# ---------------------------------------------------
# 🧠 Donor Lifecycle Status
# ---------------------------------------------------
def calculate_donor_status(donor: models.Donor) -> str:
    today = date.today()

    # 🔴 IMPORTANT FIX
    # If workflow status exists (DONOR_ACCEPTED etc), return it
    if donor.status:
        return donor.status

    if donor.has_chronic_disease:
        return "INACTIVE"

    if donor.is_locked:
        return "EMERGENCY_RESERVED"

    if donor.cooldown_until and donor.cooldown_until.date() > today:
        return "COOLDOWN"

    if donor.is_active:
        return "ACTIVE"

    return "INACTIVE"


def _user_role(user: models.User) -> str:
    role = (getattr(user, "role", None) or "DONOR").upper()

    if getattr(user, "is_admin", False):
        role = "ADMIN"

    return role


def _require_owner_or_staff(donor: models.Donor, user: models.User):
    role = _user_role(user)

    if role in ("ADMIN", "HOSPITAL"):
        return

    if donor.user_id is None or donor.user_id != user.id:
        raise HTTPException(
            status_code=403,
            detail="Access denied: not your donor profile"
        )


# ---------------------------------------------------
# 🙋 Get My Donor Profile
# ---------------------------------------------------
@router.get("/me")
def get_my_donor_profile(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):

    donor = db.query(models.Donor).filter(
        models.Donor.user_id == current_user.id
    ).first()

    if not donor:
        raise HTTPException(
            status_code=404,
            detail="Donor profile not found"
        )

    donor_dict = donor.__dict__.copy()
    donor_dict.pop("_sa_instance_state", None)

    donor_dict["status"] = calculate_donor_status(donor)

    return donor_dict


# ---------------------------------------------------
# 🩸 Register Donor
# ---------------------------------------------------
@router.post("", response_model=DonorResponse, status_code=status.HTTP_201_CREATED)
def register_donor(
    donor: DonorCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles(["DONOR"]))
):

    existing = db.query(models.Donor).filter(
        models.Donor.user_id == current_user.id
    ).first()

    if existing:
        raise HTTPException(
            status_code=400,
            detail="You are already registered as a donor"
        )

    donor_data = donor.model_dump()

    donor_data["user_id"] = current_user.id
    donor_data["email"] = current_user.email
    donor_data["full_name"] = current_user.full_name

    if donor_data.get("has_chronic_disease"):
        donor_data["is_active"] = False

    new_donor = models.Donor(**donor_data)

    try:
        db.add(new_donor)
        db.commit()
        db.refresh(new_donor)

    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail="Phone number or email already registered"
        )

    donor_dict = new_donor.__dict__.copy()
    donor_dict.pop("_sa_instance_state", None)

    donor_dict["status"] = calculate_donor_status(new_donor)

    return donor_dict


# ---------------------------------------------------
# 📋 List All Donors
# ---------------------------------------------------
@router.get("", response_model=List[DonorResponse])
def list_donors(
    db: Session = Depends(get_db),
    _user: models.User = Depends(require_roles(["ADMIN", "HOSPITAL"]))
):

    donors = db.query(models.Donor).all()

    response = []

    for donor in donors:

        donor_dict = donor.__dict__.copy()
        donor_dict.pop("_sa_instance_state", None)

        donor_dict["status"] = calculate_donor_status(donor)

        response.append(donor_dict)

    return response


# ---------------------------------------------------
# 🔍 Search Donors
# ---------------------------------------------------
@router.get("/search", response_model=List[DonorResponse])
def search_donors(
    blood_group: Optional[str] = Query(None),
    city: Optional[str] = Query(None),
    state: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    db: Session = Depends(get_db),
    _user: models.User = Depends(require_roles(["ADMIN", "HOSPITAL"]))
):

    donors = db.query(models.Donor).all()

    results = []

    for donor in donors:

        donor_status = calculate_donor_status(donor)

        if blood_group and donor.blood_group != blood_group:
            continue

        if city and donor.city.lower() != city.lower():
            continue

        if state and donor.state.lower() != state.lower():
            continue

        if status_filter and donor_status != status_filter:
            continue

        donor_dict = donor.__dict__.copy()
        donor_dict.pop("_sa_instance_state", None)

        donor_dict["status"] = donor_status

        results.append(donor_dict)

    return results


# ---------------------------------------------------
# 🩸 Donate Blood
# ---------------------------------------------------
@router.post("/{donor_id}/donate")
def donate_blood(
    donor_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):

    donor = db.query(models.Donor).filter(
        models.Donor.id == donor_id
    ).first()

    if not donor:
        raise HTTPException(
            status_code=404,
            detail="Donor not found"
        )

    _require_owner_or_staff(donor, current_user)

    current_status = calculate_donor_status(donor)

    if current_status != "ACTIVE":
        raise HTTPException(
            status_code=400,
            detail=f"Donor not eligible. Current status: {current_status}"
        )

    donor.last_donation_date = date.today()

    donor.cooldown_until = datetime.now() + timedelta(days=COOLDOWN_DAYS)

    db.commit()
    db.refresh(donor)

    return {
        "message": "Donation recorded successfully",
        "donor_id": donor.id,
        "next_eligible_date": donor.cooldown_until.date()
    }


# ---------------------------------------------------
# 🚨 Reserve Donor
# ---------------------------------------------------
@router.post("/{donor_id}/reserve")
def reserve_donor(
    donor_id: int,
    db: Session = Depends(get_db),
    _user: models.User = Depends(require_roles(["ADMIN", "HOSPITAL"]))
):

    donor = db.query(models.Donor).filter(
        models.Donor.id == donor_id
    ).first()

    if not donor:
        raise HTTPException(
            status_code=404,
            detail="Donor not found"
        )

    current_status = calculate_donor_status(donor)

    if current_status != "ACTIVE":
        raise HTTPException(
            status_code=400,
            detail=f"Donor cannot be reserved. Current status: {current_status}"
        )

    donor.is_locked = True
    donor.allocated_at = datetime.now()

    db.commit()
    db.refresh(donor)

    return {
        "message": "Donor reserved for emergency",
        "donor_id": donor.id,
        "reserved_at": donor.allocated_at
    }


# ---------------------------------------------------
# 🧪 Donor Health Twin
# ---------------------------------------------------
@router.get("/{donor_id}/health_twin")
def get_donor_health_twin(
    donor_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):

    donor = db.query(models.Donor).filter(
        models.Donor.id == donor_id
    ).first()

    if not donor:
        raise HTTPException(
            status_code=404,
            detail="Donor not found"
        )

    _require_owner_or_staff(donor, current_user)

    twin = donor_health.calculate_donor_readiness(donor)

    return {
        "donor_id": donor.id,
        "full_name": donor.full_name,
        "blood_group": donor.blood_group,
        "city": donor.city,
        "state": donor.state,
        "status": calculate_donor_status(donor),
        "health_twin": twin,
        "readiness_score": twin.get("readiness_score"),
        "is_eligible": twin.get("is_eligible"),
        "cooldown_remaining_days": twin.get("cooldown_remaining_days"),
        "next_eligible_date": twin.get("next_eligible_date"),
        "health_insights": twin.get("health_insights"),
    }