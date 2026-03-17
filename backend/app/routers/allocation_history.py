from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app import models
from app.utils.auth import get_current_user

router = APIRouter(
    prefix="/allocation-history",
    tags=["Allocation History"],
    dependencies=[Depends(get_current_user)]
)


@router.get("/")
def get_allocation_history(db: Session = Depends(get_db)):
    """
    Secured allocation history endpoint.
    Returns latest-first allocation records with donor summary fields.
    """

    rows = (
        db.query(models.EmergencyAllocation)
        .order_by(models.EmergencyAllocation.id.desc())
        .all()
    )

    results = []
    for a in rows:
        donor = db.query(models.Donor).filter(models.Donor.id == a.donor_id).first()

        results.append({
            "id": a.id,
            "donor_id": a.donor_id,
            "donor_name": donor.full_name if donor else None,
            "donor_phone": donor.phone_number if donor else None,
            "donor_email": donor.email if donor else None,
            "donor_city": donor.city if donor else None,
            "donor_state": donor.state if donor else None,

            "blood_group": a.blood_group,
            "patient_city": a.patient_city,
            "patient_state": a.patient_state,

            "readiness_score": a.readiness_score,
            "priority_score": a.priority_score,

            "allocated_at": a.allocated_at.isoformat() if a.allocated_at else None,
            "completed_at": a.completed_at.isoformat() if a.completed_at else None,

            "status": a.status,
        })

    return results