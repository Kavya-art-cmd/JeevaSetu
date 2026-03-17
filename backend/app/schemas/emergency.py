from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class EmergencyCreate(BaseModel):
    patient_name: str
    blood_group: str
    required_units: int = Field(..., gt=0)
    hospital_name: str
    city: str
    state: str
    emergency_level: str  # High / Medium / Low
    contact_number: str
    requested_at: Optional[datetime] = None
    is_active: bool = True


class EmergencyResponse(EmergencyCreate):
    id: int
