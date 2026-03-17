from fastapi import APIRouter, HTTPException, Depends
from datetime import date, datetime, timedelta
from typing import Dict, List
from sqlalchemy.orm import Session
import asyncio

from app.database import get_db
from app import models
from app.utils.donor_lifecycle import update_donor_status
from app.routers.donor_health import calculate_donor_readiness
from app.utils.retrain_trigger import trigger_retrain_if_needed

# ✅ EXOTEL SMS
from services.exotel_service import send_sms, check_sms_status, extract_sms_status
from services.twilio_call_service import make_call

# ✅ AUTH + RBAC
from app.utils.auth import get_current_user, require_roles

# ✅ EMAIL ALERT
from services.email_service import send_emergency_email

from services.google_maps_service import get_dynamic_eta_minutes


# ---------------------------------------------------
# 🔐 SECURED ROUTER
# Every endpoint in this router requires valid JWT
# ---------------------------------------------------
router = APIRouter(
    tags=["Emergency"],
    dependencies=[Depends(get_current_user)]
)

COOLDOWN_DAYS = 90
CITY_ETA_MINUTES = 45
STATE_ETA_MINUTES = 150


# ---------------------------------------------------
# 🧬 Blood Compatibility Logic
# ---------------------------------------------------
def is_blood_compatible(donor_bg: str, patient_bg: str) -> bool:
    compatibility = {
        "O-": ["O-", "O+", "A-", "A+", "B-", "B+", "AB-", "AB+", "AB+"],
        "O+": ["O+", "A+", "B+", "AB+"],
        "A-": ["A-", "A+", "AB-", "AB+"],
        "A+": ["A+", "AB+"],
        "B-": ["B-", "B+", "AB-", "AB+"],
        "B+": ["B+", "AB+"],
        "AB-": ["AB-", "AB+"],
        "AB+": ["AB+"],
    }
    return patient_bg in compatibility.get(donor_bg, [])


def _priority_score(distance_level: str, days_since_last_donation: int, readiness_score: float) -> float:
    score = 0
    score += 50 if distance_level == "CITY" else 30
    score += 30 if days_since_last_donation > 180 else 20
    score += readiness_score * 0.5
    return float(score)


def _is_eligible(donor: models.Donor, patient_blood: str, today: date) -> bool:
    # auto-update based on last_donation_date (your lifecycle logic)
    update_donor_status(donor)

    if not donor.is_active or donor.has_chronic_disease:
        return False

    # locked donors cannot be picked again
    if donor.is_locked:
        return False

    # cooldown date blocks donation
    if donor.cooldown_until and donor.cooldown_until.date() >= today:
        return False

    if not is_blood_compatible(donor.blood_group, patient_blood):
        return False

    twin = calculate_donor_readiness(donor)
    if twin["next_eligible_date"] > today:
        return False

    return True


# ---------------------------------------------------
# 🚨 Fully Automatic Emergency Match + Allocation
# (HOSPITAL/ADMIN only)
# ---------------------------------------------------
@router.post("/emergency/match")
def emergency_match(
    request: Dict,
    db: Session = Depends(get_db),
    _user=Depends(require_roles(["HOSPITAL", "ADMIN"]))
):
    try:
        patient_blood = request["blood_group"]
        required_units = int(request["required_units"])
        patient_city = request["city"]
        patient_state = request["state"]
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid request payload")

    today = date.today()
    now = datetime.utcnow()

    donors = db.query(models.Donor).all()
    eligible_donors: List[Dict] = []

    for donor in donors:
        if not _is_eligible(donor, patient_blood, today):
            continue

        # Days since last donation
        if donor.last_donation_date:
            days_since = (today - donor.last_donation_date).days
        else:
            days_since = 999

        twin = calculate_donor_readiness(donor)

        donor_data = donor.__dict__.copy()
        donor_data.pop("_sa_instance_state", None)

        donor_data["days_since_last_donation"] = days_since
        donor_data["readiness_score"] = twin["readiness_score"]

        eligible_donors.append(donor_data)

    db.commit()

    # Distance filtering
    city_donors = []
    state_donors = []

    for donor in eligible_donors:
        if donor["city"].lower() == patient_city.lower():
            donor["eta_minutes"] = CITY_ETA_MINUTES
            donor["distance_level"] = "CITY"
            donor["priority_score"] = _priority_score(
                "CITY", donor["days_since_last_donation"], donor["readiness_score"]
            )
            city_donors.append(donor)

        elif donor["state"].lower() == patient_state.lower():
            donor["eta_minutes"] = STATE_ETA_MINUTES
            donor["distance_level"] = "STATE"
            donor["priority_score"] = _priority_score(
                "STATE", donor["days_since_last_donation"], donor["readiness_score"]
            )
            state_donors.append(donor)

    final_donors = sorted(
        city_donors + state_donors,
        key=lambda d: (-d["priority_score"], d["eta_minutes"])
    )[:required_units]

    if not final_donors:
        return {
            "status": "ESCALATION_TRIGGERED",
            "matched_units": 0,
            "matched_donors": [],
            "message": "No eligible donors found."
        }

    # Lock + store allocation audit
    for donor_data in final_donors:
        donor_obj = db.query(models.Donor).filter(models.Donor.id == donor_data["id"]).first()
        if not donor_obj:
            continue

        donor_obj.is_locked = True
        donor_obj.is_active = False
        donor_obj.status = "EMERGENCY_RESERVED"
        donor_obj.allocated_at = now
        donor_obj.cooldown_until = now + timedelta(days=COOLDOWN_DAYS)
        donor_obj.last_donation_date = today

        allocation_record = models.EmergencyAllocation(
            donor_id=donor_obj.id,
            blood_group=patient_blood,
            patient_city=patient_city,
            patient_state=patient_state,
            readiness_score=donor_data["readiness_score"],
            priority_score=donor_data["priority_score"],
            allocated_at=now,
            status="ALLOCATED"
        )
        db.add(allocation_record)

    db.commit()

    # ✅ Send SMS to all allocated donors after successful commit
    sms_results = []
    for donor_data in final_donors:
        try:
            sms_response = send_sms(
                donor_data["phone_number"],
                f"""
Hello. This is JeevaSetu emergency blood network.

A patient in {patient_city} urgently requires blood group {patient_blood}.

If you are available to donate, please contact the nearest hospital or respond on the JeevaSetu website within the next 15 to 20 minutes.

Thank you for supporting life saving blood donation.
"""
            )

            sms_item = {
                "donor_id": donor_data["id"],
                "phone_number": donor_data["phone_number"],
                "sms_status_code": sms_response["status_code"],
                "sms_sid": sms_response.get("sms_sid")
            }

            # If SMS send succeeded, check delivery status
            if sms_response["status_code"] == 200 and sms_response.get("sms_sid"):
                status_check = check_sms_status(sms_response["sms_sid"])
                parsed_status = extract_sms_status(status_check.get("response", ""))

                sms_item["delivery_status"] = parsed_status.get("status")
                sms_item["detailed_status"] = parsed_status.get("detailed_status")

                if parsed_status.get("status") == "failed":
                    asyncio.run(
                        send_emergency_email(
                            donor_data["email"],
                            "JeevaSetu Emergency Blood Request",
                            f"""
Hello. This is JeevaSetu emergency blood network.

A patient in {patient_city} urgently requires blood group {patient_blood}.

If you are available to donate, please contact the nearest hospital or respond on the JeevaSetu website within the next 15 to 20 minutes.

Thank you for supporting life saving blood donation.
"""
                        )
                    )
                    call_result = make_call(
                        donor_data["phone_number"],
                        f"""
Hello. This is JeevaSetu emergency blood network.

A patient in {patient_city} urgently requires blood group {patient_blood}.

If you are available to donate, please contact the nearest hospital or respond on the JeevaSetu website within the next 15 to 20 minutes.

Thank you for supporting life saving blood donation.
"""
                    )
                    sms_item["call_result"] = call_result

            # If SMS sending itself fails, trigger call immediately
            elif sms_response["status_code"] != 200:
                asyncio.run(
                    send_emergency_email(
                        donor_data["email"],
                        "JeevaSetu Emergency Blood Request",
                        f"""
Hello. This is JeevaSetu emergency blood network.

A patient in {patient_city} urgently requires blood group {patient_blood}.

If you are available to donate, please contact the nearest hospital or respond on the JeevaSetu website within the next 15 to 20 minutes.

Thank you for supporting life saving blood donation.
"""
                    )
                )
                call_result = make_call(
                    donor_data["phone_number"],
                    f"""
Hello. This is JeevaSetu emergency blood network.

A patient in {patient_city} urgently requires blood group {patient_blood}.

If you are available to donate, please contact the nearest hospital or respond on the JeevaSetu website within the next 15 to 20 minutes.

Thank you for supporting life saving blood donation.
"""
                )
                sms_item["call_result"] = call_result

            sms_results.append(sms_item)

        except Exception as e:
            error_item = {
                "donor_id": donor_data["id"],
                "phone_number": donor_data.get("phone_number"),
                "sms_error": str(e)
            }

            try:
                asyncio.run(
                    send_emergency_email(
                        donor_data["email"],
                        "JeevaSetu Emergency Blood Request",
                        f"""
Hello. This is JeevaSetu emergency blood network.

A patient in {patient_city} urgently requires blood group {patient_blood}.

If you are available to donate, please contact the nearest hospital or respond on the JeevaSetu website within the next 15 to 20 minutes.

Thank you for supporting life saving blood donation.
"""
                    )
                )
                call_result = make_call(
                    donor_data["phone_number"],
                    f"""
Hello. This is JeevaSetu emergency blood network.

A patient in {patient_city} urgently requires blood group {patient_blood}.

If you are available to donate, please contact the nearest hospital or respond on the JeevaSetu website within the next 15 to 20 minutes.

Thank you for supporting life saving blood donation.
"""
                )
                error_item["call_result"] = call_result
            except Exception as call_e:
                error_item["call_error"] = str(call_e)

            sms_results.append(error_item)

    fastest_eta = min(d["eta_minutes"] for d in final_donors)

    return {
        "status": "SUCCESS",
        "matched_units": len(final_donors),
        "matched_donors": final_donors,
        "fastest_eta_minutes": fastest_eta,
        "sms_results": sms_results
    }


# ---------------------------------------------------
# ✅ Manual Allocate (hospital selects donor_id)
# (HOSPITAL/ADMIN only)
# ---------------------------------------------------
@router.post("/emergency/allocate")
def emergency_allocate(
    request: Dict,
    db: Session = Depends(get_db),
    _user=Depends(require_roles(["HOSPITAL", "ADMIN"]))
):
    try:
        donor_id = int(request["donor_id"])
        patient_blood = request["blood_group"]
        patient_city = request["city"]
        patient_state = request["state"]
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid request payload")

    donor = db.query(models.Donor).filter(models.Donor.id == donor_id).first()
    if not donor:
        raise HTTPException(status_code=404, detail="Donor not found")

    today = date.today()
    now = datetime.utcnow()

    if not _is_eligible(donor, patient_blood, today):
        raise HTTPException(status_code=400, detail="Donor is not eligible")

    # dynamic ETA using Google Maps
    if donor.city.lower() == patient_city.lower():
        distance_level = "CITY"
    elif donor.state.lower() == patient_state.lower():
        distance_level = "STATE"
    else:
        raise HTTPException(status_code=400, detail="Donor not in same city/state")

    origin = f"{donor.city}, {donor.state}"
    destination = f"{patient_city}, {patient_state}"

    eta = get_dynamic_eta_minutes(origin, destination)

    # fallback to rule-based ETA if Google Maps fails
    if eta is None:
        eta = CITY_ETA_MINUTES if distance_level == "CITY" else STATE_ETA_MINUTES

    # days since last donation
    if donor.last_donation_date:
        days_since = (today - donor.last_donation_date).days
    else:
        days_since = 999

    twin = calculate_donor_readiness(donor)
    priority = _priority_score(distance_level, days_since, twin["readiness_score"])

    # lock + create allocation row
    donor.is_locked = True
    donor.is_active = False
    donor.status = "EMERGENCY_RESERVED"
    donor.allocated_at = now
    donor.cooldown_until = now + timedelta(days=COOLDOWN_DAYS)
    donor.last_donation_date = today

    allocation = models.EmergencyAllocation(
        donor_id=donor.id,
        blood_group=patient_blood,
        patient_city=patient_city,
        patient_state=patient_state,
        readiness_score=twin["readiness_score"],
        priority_score=priority,
        allocated_at=now,
        status="ALLOCATED"
    )
    db.add(allocation)
    db.commit()
    db.refresh(allocation)

    # ✅ Send SMS after successful manual allocation
    sms_result = None
    call_result = None
    alert_message = f"""
Hello. This is JeevaSetu emergency blood network.

A patient in {patient_city} urgently requires blood group {patient_blood}.

If you are available to donate, please contact the nearest hospital or respond on the JeevaSetu website within the next 15 to 20 minutes.

Thank you for supporting life saving blood donation.
"""

    try:
        sms_response = send_sms(donor.phone_number, alert_message)

        sms_result = {
            "donor_id": donor.id,
            "phone_number": donor.phone_number,
            "sms_status_code": sms_response["status_code"],
            "sms_sid": sms_response.get("sms_sid")
        }

        # If SMS sending itself fails, trigger call immediately
        if sms_response["status_code"] != 200:
            asyncio.run(
                send_emergency_email(
                    donor.email,
                    "JeevaSetu Emergency Blood Request",
                    alert_message
                )
            )
            call_result = make_call(donor.phone_number, alert_message)

        # If SMS send succeeded, check delivery status
        elif sms_response.get("sms_sid"):
            status_check = check_sms_status(sms_response["sms_sid"])
            parsed_status = extract_sms_status(status_check.get("response", ""))

            sms_result["delivery_status"] = parsed_status.get("status")
            sms_result["detailed_status"] = parsed_status.get("detailed_status")

            if parsed_status.get("status") == "failed":
                asyncio.run(
                    send_emergency_email(
                        donor.email,
                        "JeevaSetu Emergency Blood Request",
                        alert_message
                    )
                )
                call_result = make_call(donor.phone_number, alert_message)

    except Exception as e:
        sms_result = {
            "donor_id": donor.id,
            "phone_number": donor.phone_number,
            "sms_error": str(e)
        }
        asyncio.run(
            send_emergency_email(
                donor.email,
                "JeevaSetu Emergency Blood Request",
                alert_message
            )
        )
        call_result = make_call(donor.phone_number, alert_message)

    return {
        "status": "ALLOCATED",
        "allocation_id": allocation.id,
        "donor_id": donor.id,
        "eta_minutes": eta,
        "priority_score": priority,
        "sms_result": sms_result,
        "call_result": call_result
    }


# ---------------------------------------------------
# ✅ Smart Allocate Endpoint
# (same behavior as /emergency/match)
# ---------------------------------------------------
@router.post("/emergency/allocate/smart")
def emergency_allocate_smart(
    request: Dict,
    db: Session = Depends(get_db),
    _user=Depends(require_roles(["HOSPITAL", "ADMIN"]))
):
    return emergency_match(request, db)


# ---------------------------------------------------
# ✅ Complete Allocation by allocation_id
# FIX: even if already completed, still unlock donor
# ---------------------------------------------------
@router.post("/emergency/{allocation_id}/complete")
def complete_allocation(
    allocation_id: int,
    db: Session = Depends(get_db),
    _user=Depends(require_roles(["HOSPITAL", "ADMIN"]))
):
    allocation = db.query(models.EmergencyAllocation).filter(
        models.EmergencyAllocation.id == allocation_id
    ).first()

    if not allocation:
        raise HTTPException(status_code=404, detail="Allocation not found")

    donor = db.query(models.Donor).filter(models.Donor.id == allocation.donor_id).first()

    # ✅ If already completed, still unlock donor defensively
    if allocation.status == "COMPLETED":
        if donor:
            donor.is_locked = False
            donor.is_active = True
            donor.status = "AVAILABLE"
            donor.allocated_at = None
        db.commit()
        return {"message": "Allocation already completed", "donor_unlocked": True}

    allocation.status = "COMPLETED"
    allocation.completed_at = datetime.utcnow()

    if donor:
        donor.is_locked = False
        donor.is_active = True
        donor.status = "AVAILABLE"
        donor.allocated_at = None

    db.commit()

    try:
        result = trigger_retrain_if_needed()
        print("🧠 Retrain Trigger Result:", result)
    except Exception as e:
        print("⚠ Smart retrain check failed:", e)

    return {
        "status": "COMPLETED",
        "allocation_id": allocation.id,
        "donor_unlocked": True
    }


# ---------------------------------------------------
# ✅ Complete Emergency by donor_id (UNIQUE PATH - no conflict)
# FIX: do not 404 if already completed; always unlock donor
# ---------------------------------------------------
@router.post("/emergency/donor/{donor_id}/complete")
def complete_emergency_by_donor(
    donor_id: int,
    db: Session = Depends(get_db),
    _user=Depends(require_roles(["HOSPITAL", "ADMIN"]))
):
    donor = db.query(models.Donor).filter(models.Donor.id == donor_id).first()
    if not donor:
        raise HTTPException(status_code=404, detail="Donor not found")

    # latest allocation (ALLOCATED or COMPLETED)
    allocation = db.query(models.EmergencyAllocation).filter(
        models.EmergencyAllocation.donor_id == donor_id
    ).order_by(models.EmergencyAllocation.id.desc()).first()

    # ✅ No allocation found: still unlock donor
    if not allocation:
        donor.is_locked = False
        donor.is_active = True
        donor.status = "AVAILABLE"
        donor.allocated_at = None
        db.commit()
        return {"message": "No allocation found. Donor unlocked.", "donor_unlocked": True}

    # ✅ If allocation exists but already completed: still unlock donor
    if allocation.status == "COMPLETED":
        donor.is_locked = False
        donor.is_active = True
        donor.status = "AVAILABLE"
        donor.allocated_at = None
        db.commit()
        return {
            "message": "Allocation already completed. Donor unlocked.",
            "allocation_id": allocation.id,
            "donor_id": donor.id,
            "donor_unlocked": True
        }

    # mark completed
    allocation.status = "COMPLETED"
    allocation.completed_at = datetime.utcnow()

    # always unlock donor
    donor.is_locked = False
    donor.is_active = True
    donor.status = "AVAILABLE"
    donor.allocated_at = None

    db.commit()

    try:
        result = trigger_retrain_if_needed()
        print("🧠 Retrain Trigger Result:", result)
    except Exception as e:
        print("⚠ Smart retrain check failed:", e)

    return {
        "status": "COMPLETED",
        "allocation_id": allocation.id,
        "donor_id": donor.id,
        "donor_unlocked": True
    }


# ---------------------------------------------------
# ✅ Check SMS Delivery Status
# (HOSPITAL/ADMIN only)
# ---------------------------------------------------
@router.get("/emergency/sms-status/{sms_sid}")
def get_sms_status(
    sms_sid: str,
    _user=Depends(require_roles(["HOSPITAL", "ADMIN"]))
):
    result = check_sms_status(sms_sid)
    parsed_status = extract_sms_status(result.get("response", ""))

    return {
        "sms_sid": sms_sid,
        "status_code": result["status_code"],
        "delivery_status": parsed_status.get("status"),
        "detailed_status": parsed_status.get("detailed_status"),
        "raw_response": result.get("response")
    }


@router.post("/emergency/respond/{allocation_id}")
def respond_to_emergency(
    allocation_id: int,
    request: Dict,
    db: Session = Depends(get_db),
    _user=Depends(require_roles(["DONOR", "HOSPITAL", "ADMIN"]))
):
    allocation = db.query(models.EmergencyAllocation).filter(
        models.EmergencyAllocation.id == allocation_id
    ).first()

    if not allocation:
        raise HTTPException(status_code=404, detail="Allocation not found")

    response_status = request.get("response_status")
    response_note = request.get("response_note")

    allowed = ["ACCEPTED", "DECLINED", "NO_RESPONSE"]
    if response_status not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"response_status must be one of {allowed}"
        )

    allocation.response_status = response_status
    allocation.response_time = datetime.utcnow()
    allocation.response_note = response_note

    db.commit()
    db.refresh(allocation)

    return {
        "message": "Donor response recorded successfully",
        "allocation_id": allocation.id,
        "response_status": allocation.response_status,
        "response_time": allocation.response_time,
        "response_note": allocation.response_note
    }


@router.post("/emergency/check-no-response")
def check_no_response(
    db: Session = Depends(get_db),
    _user=Depends(require_roles(["ADMIN", "HOSPITAL"]))
):

    now = datetime.utcnow()

    pending_allocations = db.query(models.EmergencyAllocation).filter(
        models.EmergencyAllocation.response_status == "PENDING",
        models.EmergencyAllocation.status == "ALLOCATED"
    ).all()

    triggered_calls = []

    for allocation in pending_allocations:

        minutes_passed = (now - allocation.allocated_at).total_seconds() / 60

        # wait 15 minutes for donor response
        if minutes_passed >= 2:

            donor = db.query(models.Donor).filter(
                models.Donor.id == allocation.donor_id
            ).first()

            if donor:

                alert_message = f"""
Hello. This is JeevaSetu emergency blood network.

A patient in {allocation.patient_city} urgently requires blood group {allocation.blood_group}.

If you are available to donate please contact the nearest hospital or respond on the JeevaSetu website within the next 15 to 20 minutes.

Thank you for supporting life saving blood donation.
"""

                call_result = make_call(
                    donor.phone_number,
                    alert_message
                )

                allocation.response_status = "NO_RESPONSE"

                triggered_calls.append({
                    "allocation_id": allocation.id,
                    "donor_id": donor.id,
                    "phone_number": donor.phone_number,
                    "call_result": call_result
                })

    db.commit()

    return {
        "checked_pending_allocations": len(pending_allocations),
        "calls_triggered": triggered_calls
    }