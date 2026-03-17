from fastapi import APIRouter, Depends, Body
from pydantic import BaseModel
from app.utils.auth import get_current_user


router = APIRouter(
    prefix="/emergency",
    tags=["Emergency Broadcast"],
    dependencies=[Depends(get_current_user)]
)


# -------------------------
# Request Model (JSON body support)
# -------------------------
class BroadcastRequest(BaseModel):
    city: str
    state: str
    blood_group: str
    required_units: int


def _norm_bg(bg: str) -> str:
    return (bg or "").strip().upper().replace(" ", "")


def _norm_city(city: str) -> str:
    return (city or "").strip().title()


def _norm_state(state: str) -> str:
    return (state or "").strip().title()


@router.post("/broadcast")
def emergency_donor_broadcast(
    city: str | None = None,
    state: str | None = None,
    blood_group: str | None = None,
    required_units: int | None = None,
    payload: BroadcastRequest | None = Body(default=None),
):
    """
    STEP-8: Emergency Donor Broadcast
    Triggered when no donors are matched in STEP-7

    ✅ Supports BOTH:
    1) Query params (Swagger friendly): /emergency/broadcast?city=...&state=...&blood_group=...&required_units=...
    2) JSON body (frontend friendly)
    """

    # Prefer JSON body if provided
    if payload is not None:
        city = payload.city
        state = payload.state
        blood_group = payload.blood_group
        required_units = payload.required_units

    city_n = _norm_city(city or "")
    state_n = _norm_state(state or "")
    bg_n = _norm_bg(blood_group or "")

    if not city_n or not state_n or not bg_n or required_units is None:
        return {
            "status": "ERROR",
            "detail": "city, state, blood_group, required_units are required (query params or JSON body)."
        }

    broadcast_message = (
        f"🚨 EMERGENCY BLOOD REQUEST 🚨\n"
        f"Blood Group: {bg_n}\n"
        f"Units Required: {int(required_units)}\n"
        f"Location: {city_n}, {state_n}\n"
        f"Please respond immediately if you can donate."
    )

    return {
        "status": "BROADCAST_TRIGGERED",
        "broadcast_scope": "STATE_LEVEL",
        "message_dispatched": True,
        "channels_used": [
            "SMS",
            "WhatsApp",
            "In-App Notification"
        ],
        "broadcast_message": broadcast_message,
        "next_step": "WAIT_FOR_DONOR_RESPONSES",
        "strategy": "Emergency Mass Donor Broadcast (Phase-2)"
    }