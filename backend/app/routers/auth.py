from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from typing import Optional

from app.database import get_db
from app import models
from app.utils.auth import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


# ----------------------------------------
# Request Schemas
# ----------------------------------------
class SignupRequest(BaseModel):
    full_name: str
    email: EmailStr
    password: str
    role: Optional[str] = "DONOR"   # ✅ DONOR or HOSPITAL only


# ----------------------------------------
# Signup (JSON)
# ----------------------------------------
@router.post("/signup")
def signup(request: SignupRequest, db: Session = Depends(get_db)):

    role = (request.role or "DONOR").strip().upper()

    # ✅ allow direct signup only for DONOR / HOSPITAL
    # ❌ block ADMIN self-signup
    if role not in {"DONOR", "HOSPITAL"}:
        raise HTTPException(status_code=400, detail="Invalid role. Use DONOR or HOSPITAL")

    existing_user = db.query(models.User).filter(models.User.email == request.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    user = models.User(
        full_name=request.full_name,
        email=request.email,
        hashed_password=hash_password(request.password),
        role=role,
        is_admin=False,
        is_active=True,
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    return {"message": "User created successfully", "role": user.role}


# ----------------------------------------
# Login (OAuth2 password flow form-data)
# Swagger "Authorize" uses username + password
# ----------------------------------------
@router.post("/login")
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    user = db.query(models.User).filter(models.User.email == form_data.username).first()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_access_token(
        data={
            "user_id": user.id,
            "email": user.email,
            "role": getattr(user, "role", "DONOR"),  # ✅ include role
        }
    )

    return {"access_token": token, "token_type": "bearer"}


# ----------------------------------------
# Current user (Protected)
# ----------------------------------------
@router.get("/me")
def me(current_user: models.User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "full_name": current_user.full_name,
        "email": current_user.email,
        "role": getattr(current_user, "role", "DONOR"),
        "is_active": current_user.is_active,
        "is_admin": getattr(current_user, "is_admin", False),
    }