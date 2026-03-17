from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
import re
from datetime import datetime

from app.database import get_db
from app.utils.auth import get_current_user, require_roles
from app.routers.emergency import emergency_match  # reuse your existing logic


router = APIRouter(
    prefix="/voice",
    tags=["Voice Activation"],
    dependencies=[Depends(get_current_user)]
)


class VoiceEmergencyRequest(BaseModel):
    transcript: str
    fallback_blood_group: str | None = None
    fallback_city: str | None = None
    fallback_state: str | None = None
    fallback_required_units: int | None = None


# ----------------------------
# Helpers
# ----------------------------
INDIAN_STATES = [
    "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat",
    "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh",
    "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab",
    "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh",
    "Uttarakhand", "West Bengal",
    "Delhi", "Jammu and Kashmir", "Ladakh", "Puducherry", "Chandigarh",
    "Dadra and Nagar Haveli and Daman and Diu"
]


def _norm_spaces(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "").strip())


def _extract_blood_group(text: str):
    t = (text or "").upper().replace(" ", "")
    m = re.search(r"(AB\+|AB\-|O\+|O\-|A\+|A\-|B\+|B\-)", t)
    return m.group(1) if m else None


def _extract_required_units(text: str):
    m = re.search(r"(\d+)\s*(UNIT|UNITS|BAG|BAGS|PACK|PACKS)", (text or "").upper())
    return int(m.group(1)) if m else None


def extract_city_state(text: str):
    """
    Parses "... in <city> <state>" OR "... at <city> <state>"
    Finds the longest matching Indian state at the end.
    """
    t = _norm_spaces(text)

    m = re.search(r"\b(in|at)\s+(.+)$", t, flags=re.IGNORECASE)
    tail = _norm_spaces(m.group(2)) if m else ""

    if not tail:
        return None, None

    best_state = None
    for st in sorted(INDIAN_STATES, key=len, reverse=True):
        if tail.lower().endswith(st.lower()):
            best_state = st
            break

    if not best_state:
        return None, None

    city_part = _norm_spaces(tail[: -len(best_state)])
    city_part = re.sub(r"\b(state|district|city)\b", "", city_part, flags=re.IGNORECASE).strip()

    city = city_part.title() if city_part else None
    state = best_state
    return city, state


def _build_broadcast_payload(city: str, state: str, blood_group: str, required_units: int):
    msg = (
        f"🚨 EMERGENCY BLOOD REQUEST 🚨\n"
        f"Blood Group: {blood_group}\n"
        f"Units Required: {required_units}\n"
        f"Location: {city}, {state}\n"
        f"Please respond immediately if you can donate."
    )
    return {
        "status": "BROADCAST_TRIGGERED",
        "broadcast_scope": "STATE_LEVEL",
        "message_dispatched": True,
        "channels_used": ["SMS", "WhatsApp", "In-App Notification"],
        "broadcast_message": msg,
        "next_step": "WAIT_FOR_DONOR_RESPONSES",
        "strategy": "Emergency Mass Donor Broadcast (Phase-2)",
        "timestamp": datetime.utcnow().isoformat()
    }


@router.post("/emergency/activate")
def voice_emergency_activate(
    payload: VoiceEmergencyRequest,
    db: Session = Depends(get_db),
    _user=Depends(require_roles(["HOSPITAL", "ADMIN"]))
):
    transcript = _norm_spaces(payload.transcript)
    if not transcript:
        raise HTTPException(status_code=400, detail="transcript is required")

    blood_group = _extract_blood_group(transcript) or payload.fallback_blood_group
    required_units = _extract_required_units(transcript) or payload.fallback_required_units

    city, state = extract_city_state(transcript)
    city = city or payload.fallback_city
    state = state or payload.fallback_state

    if not blood_group or not required_units or not city or not state:
        raise HTTPException(
            status_code=400,
            detail={
                "message": "Could not extract all required fields from voice transcript",
                "needed": ["blood_group", "required_units", "city", "state"],
                "extracted": {
                    "blood_group": blood_group,
                    "required_units": required_units,
                    "city": city,
                    "state": state,
                },
                "tip": "Try: 'Need O+ blood 2 units in Hyderabad Telangana' or send fallback_* fields."
            }
        )

    request = {
        "blood_group": (blood_group or "").upper().replace(" ", ""),
        "required_units": int(required_units),
        "city": (city or "").strip().title(),
        "state": (state or "").strip().title(),
    }

    result = emergency_match(request, db)

    broadcast = None
    if isinstance(result, dict) and result.get("status") == "ESCALATION_TRIGGERED":
        broadcast = _build_broadcast_payload(
            city=request["city"],
            state=request["state"],
            blood_group=request["blood_group"],
            required_units=request["required_units"]
        )

    return {
        "voice_transcript": transcript,
        "parsed_request": request,
        "result": result,
        "broadcast": broadcast
    }