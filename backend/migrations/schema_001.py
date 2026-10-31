from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    JSON,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


def now():
    return datetime.now(timezone.utc)


def uid():
    return str(uuid4())


class Entity:
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class User(Entity, Base):
    __tablename__ = "users"
    name: Mapped[str] = mapped_column(String(100))
    email: Mapped[str] = mapped_column(String(254), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(Text)
    role: Mapped[str] = mapped_column(String(16), default="CUSTOMER")
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    __table_args__ = (CheckConstraint("role IN ('CUSTOMER','OPERATOR','ADMIN')"),)


class AuthSession(Entity, Base):
    __tablename__ = "auth_sessions"
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    csrf_hash: Mapped[str] = mapped_column(String(64))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)


class AuthAttempt(Entity, Base):
    __tablename__ = "auth_attempts"
    key: Mapped[str] = mapped_column(String(64), index=True)


class Vehicle(Entity, Base):
    __tablename__ = "vehicles"
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    registration: Mapped[str] = mapped_column(String(20), unique=True)
    vehicle_type: Mapped[str] = mapped_column(String(16))
    make: Mapped[str] = mapped_column(String(50), default="")
    model: Mapped[str] = mapped_column(String(50), default="")
    electric: Mapped[bool] = mapped_column(Boolean, default=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    __table_args__ = (CheckConstraint("vehicle_type IN ('CAR','SUV','MOTORCYCLE')"),)


class Facility(Entity, Base):
    __tablename__ = "parking_facilities"
    name: Mapped[str] = mapped_column(String(100))
    address: Mapped[str] = mapped_column(String(240))
    city: Mapped[str] = mapped_column(String(80), index=True)
    description: Mapped[str] = mapped_column(Text, default="")
    hourly_rate: Mapped[int] = mapped_column(Integer, default=6000)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    demo: Mapped[bool] = mapped_column(Boolean, default=False)
    operator_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    __table_args__ = (CheckConstraint("hourly_rate >= 0"),)


class Zone(Entity, Base):
    __tablename__ = "parking_zones"
    facility_id: Mapped[str] = mapped_column(ForeignKey("parking_facilities.id"), index=True)
    name: Mapped[str] = mapped_column(String(60))
    level: Mapped[str] = mapped_column(String(20), default="Ground")
    __table_args__ = (UniqueConstraint("facility_id", "name"),)


class Slot(Entity, Base):
    __tablename__ = "parking_slots"
    facility_id: Mapped[str] = mapped_column(ForeignKey("parking_facilities.id"), index=True)
    zone_id: Mapped[str] = mapped_column(ForeignKey("parking_zones.id"), index=True)
    label: Mapped[str] = mapped_column(String(20))
    vehicle_type: Mapped[str] = mapped_column(String(16), default="CAR")
    accessible: Mapped[bool] = mapped_column(Boolean, default=False)
    charging: Mapped[bool] = mapped_column(Boolean, default=False)
    covered: Mapped[bool] = mapped_column(Boolean, default=True)
    distance_m: Mapped[int] = mapped_column(Integer, default=20)
    state: Mapped[str] = mapped_column(String(16), default="AVAILABLE")
    position: Mapped[int] = mapped_column(Integer, default=0)
    __table_args__ = (
        UniqueConstraint("facility_id", "label"),
        CheckConstraint("vehicle_type IN ('CAR','SUV','MOTORCYCLE')"),
        CheckConstraint("state IN ('AVAILABLE','MAINTENANCE','INACTIVE')"),
        CheckConstraint("distance_m >= 0"),
    )


class Reservation(Entity, Base):
    __tablename__ = "reservations"
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    vehicle_id: Mapped[str] = mapped_column(ForeignKey("vehicles.id"), index=True)
    facility_id: Mapped[str] = mapped_column(ForeignKey("parking_facilities.id"), index=True)
    slot_id: Mapped[str] = mapped_column(ForeignKey("parking_slots.id"), index=True)
    arrival: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    departure: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(16), default="CONFIRMED", index=True)
    estimated_cost: Mapped[int] = mapped_column(Integer)
    hourly_rate: Mapped[int] = mapped_column(Integer)
    explanation: Mapped[dict] = mapped_column(JSON)
    __table_args__ = (
        CheckConstraint("arrival < departure"),
        CheckConstraint("estimated_cost >= 0 AND hourly_rate >= 0"),
        CheckConstraint("status IN ('CONFIRMED','ACTIVE','COMPLETED','CANCELLED','NO_SHOW')"),
        Index("ix_reservations_user_arrival", "user_id", "arrival"),
        Index("ix_reservations_interval", "arrival", "departure"),
    )


class AllocationHistory(Entity, Base):
    __tablename__ = "allocation_history"
    reservation_id: Mapped[str] = mapped_column(ForeignKey("reservations.id"), unique=True)
    details: Mapped[dict] = mapped_column(JSON)


class StatusHistory(Entity, Base):
    __tablename__ = "reservation_status_history"
    reservation_id: Mapped[str] = mapped_column(ForeignKey("reservations.id"), index=True)
    actor_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    previous_status: Mapped[str | None] = mapped_column(String(16), nullable=True)
    status: Mapped[str] = mapped_column(String(16))


class Notification(Entity, Base):
    __tablename__ = "notifications"
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    title: Mapped[str] = mapped_column(String(120))
    message: Mapped[str] = mapped_column(Text)
    reservation_id: Mapped[str | None] = mapped_column(ForeignKey("reservations.id"), nullable=True)
    read: Mapped[bool] = mapped_column(Boolean, default=False)


class AuditLog(Entity, Base):
    __tablename__ = "audit_logs"
    actor_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    action: Mapped[str] = mapped_column(String(80), index=True)
    entity_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    details: Mapped[dict] = mapped_column(JSON, default=dict)


class SystemSettings(Base):
    __tablename__ = "system_settings"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    weights: Mapped[dict] = mapped_column(
        JSON,
        default=lambda: {
            "compatibility": 35,
            "distance": 25,
            "accessibility": 20,
            "charging": 10,
            "covered": 10,
        },
    )
    cancellation_minutes: Mapped[int] = mapped_column(Integer, default=15)
    max_booking_hours: Mapped[int] = mapped_column(Integer, default=72)
    __table_args__ = (
        CheckConstraint("id = 1"),
        CheckConstraint("cancellation_minutes >= 0"),
        CheckConstraint("max_booking_hours > 0"),
    )
