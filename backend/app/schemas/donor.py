from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import date


class DonorBase(BaseModel):
    full_name: str = Field(..., example="Rahul Sharma")
    phone_number: str = Field(..., example="9876543210")
    email: Optional[EmailStr] = Field(None, example="rahul@gmail.com")

    blood_group: str = Field(..., example="O+")
    age: int = Field(..., ge=18, le=65, example=28)
    weight_kg: float = Field(..., ge=45, example=62.5)
    gender: str = Field(..., example="Male")

    city: str = Field(..., example="Hyderabad")
    state: str = Field(..., example="Telangana")

    last_donation_date: Optional[date] = Field(
        None, example="2024-10-12"
    )

    has_chronic_disease: bool = Field(
        False, example=False
    )

    is_active: bool = Field(
        True, example=True
    )


class DonorCreate(DonorBase):
    pass


class DonorResponse(DonorBase):
    id: int
    status: Optional[str] = None  # 👈 computed field from router

    class Config:
        from_attributes = True
