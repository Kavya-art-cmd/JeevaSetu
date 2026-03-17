from sqlalchemy import (
    Column,
    Integer,
    String,
    Boolean,
    DateTime,
    Float,
    Date,
    func,
    ForeignKey,
)
from sqlalchemy.orm import relationship
from app.database import Base
from datetime import datetime


# =====================================================
# 👤 User Model (Auth) + RBAC
# =====================================================
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)

    full_name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False, index=True)

    hashed_password = Column(String, nullable=False)

    is_active = Column(Boolean, default=True)

    # legacy flag
    is_admin = Column(Boolean, default=False)

    # RBAC role
    role = Column(String, nullable=False, server_default="DONOR")

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    donor_profile = relationship(
        "Donor",
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan"
    )

    def __repr__(self):
        return f"<User(id={self.id}, email={self.email}, role={self.role})>"


# =====================================================
# 🩸 Donor Model
# =====================================================
class Donor(Base):
    __tablename__ = "donors"

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=True, index=True)

    user = relationship("User", back_populates="donor_profile")

    full_name = Column(String, nullable=False)
    phone_number = Column(String, unique=True, nullable=False)
    email = Column(String, unique=True, nullable=False)

    blood_group = Column(String, nullable=False)
    age = Column(Integer, nullable=False)
    weight_kg = Column(Float, nullable=False)
    gender = Column(String, nullable=False)

    city = Column(String, nullable=False)
    state = Column(String, nullable=False)

    last_donation_date = Column(Date, nullable=True)

    has_chronic_disease = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)

    # 🔴 NEW FIELD (fix for emergency response workflow)
    status = Column(String, default="AVAILABLE")

    is_locked = Column(Boolean, default=False)
    allocated_at = Column(DateTime, nullable=True)
    cooldown_until = Column(DateTime, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    allocations = relationship("EmergencyAllocation", back_populates="donor")

    def __repr__(self):
        return f"<Donor(id={self.id}, user_id={self.user_id}, name={self.full_name}, blood_group={self.blood_group})>"


# =====================================================
# 🚨 Emergency Allocation Audit Model
# =====================================================
class EmergencyAllocation(Base):
    __tablename__ = "emergency_allocations"

    id = Column(Integer, primary_key=True, index=True)

    donor_id = Column(Integer, ForeignKey("donors.id"), nullable=False, index=True)

    blood_group = Column(String, nullable=False)
    patient_city = Column(String, nullable=False)
    patient_state = Column(String, nullable=False)

    readiness_score = Column(Float, nullable=True)
    priority_score = Column(Float, nullable=True)

    allocated_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    status = Column(String, default="ALLOCATED")  # ALLOCATED / COMPLETED / CANCELLED

    # -------------------------------------------------
    # NEW: Donor Response Tracking
    # -------------------------------------------------
    response_status = Column(String, default="PENDING")
    response_time = Column(DateTime, nullable=True)
    response_note = Column(String, nullable=True)

    donor = relationship("Donor", back_populates="allocations")

    def __repr__(self):
        return f"<EmergencyAllocation(id={self.id}, donor_id={self.donor_id}, status={self.status})>"