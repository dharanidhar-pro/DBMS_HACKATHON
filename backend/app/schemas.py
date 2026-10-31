import re
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator

Role = Literal["CUSTOMER", "OPERATOR", "ADMIN", "SUPER_ADMIN"]
VehicleType = Literal["CAR", "SUV", "MOTORCYCLE"]


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class Register(Input):
    name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(min_length=12, max_length=128)

    @field_validator("password")
    @classmethod
    def strong_password(cls, value):
        if not re.search(r"[a-zA-Z]", value) or not re.search(r"[0-9]", value):
            raise ValueError("Use at least 12 characters with a letter and a number.")
        return value


class Login(Input):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class ProfileUpdate(Input):
    name: str = Field(min_length=2, max_length=100)


class PasswordUpdate(Input):
    current_password: str = Field(max_length=128)
    new_password: str = Field(min_length=12, max_length=128)
    _password = field_validator("new_password")(Register.strong_password.__func__)


class VehicleInput(Input):
    registration: str = Field(min_length=3, max_length=20, pattern=r"^[A-Za-z0-9 -]+$")
    vehicle_type: VehicleType = "CAR"
    make: str = Field(default="", max_length=50)
    model: str = Field(default="", max_length=50)
    electric: bool = False

    @field_validator("registration")
    @classmethod
    def normalize(cls, value):
        return re.sub(r"[ -]", "", value.upper())


class FacilityInput(Input):
    name: str = Field(min_length=2, max_length=100)
    address: str = Field(min_length=5, max_length=240)
    city: str = Field(min_length=2, max_length=80)
    description: str = Field(default="", max_length=2000)
    hourly_rate: int = Field(default=6000, ge=0, le=10000000)
    active: bool = True
    operator_id: str | None = None
    admin_id: str | None = None


class ZoneInput(Input):
    name: str = Field(min_length=1, max_length=60)
    level: str = Field(default="Ground", max_length=20)


class SlotInput(Input):
    facility_id: str
    zone_id: str
    label: str = Field(min_length=1, max_length=20, pattern=r"^[A-Za-z0-9 -]+$")
    vehicle_type: VehicleType = "CAR"
    accessible: bool = False
    charging: bool = False
    covered: bool = True
    distance_m: int = Field(default=20, ge=0, le=10000)
    state: Literal["AVAILABLE", "MAINTENANCE", "INACTIVE"] = "AVAILABLE"
    position: int = Field(default=0, ge=0, le=100000)


class SlotUpdate(Input):
    label: str | None = Field(default=None, min_length=1, max_length=20, pattern=r"^[A-Za-z0-9 -]+$")
    vehicle_type: VehicleType | None = None
    accessible: bool | None = None
    charging: bool | None = None
    covered: bool | None = None
    distance_m: int | None = Field(default=None, ge=0, le=10000)
    state: Literal["AVAILABLE", "MAINTENANCE", "INACTIVE"] | None = None

    @model_validator(mode="after")
    def not_null(self):
        if any(getattr(self, key) is None for key in self.model_fields_set):
            raise ValueError("Slot attributes cannot be null.")
        return self


class BookingInput(Input):
    facility_id: str
    vehicle_id: str
    arrival: datetime
    departure: datetime
    accessible: bool = False
    charging: bool = False
    prefer_covered: bool = True
    slot_id: str | None = None

    @model_validator(mode="after")
    def interval(self):
        if self.arrival.tzinfo is None or self.departure.tzinfo is None:
            raise ValueError("Arrival and departure must include a timezone.")
        if self.arrival >= self.departure:
            raise ValueError("Departure must be after arrival.")
        return self


class StatusUpdate(Input):
    status: Literal["ACTIVE", "COMPLETED", "CANCELLED", "NO_SHOW"]


class UserUpdate(Input):
    active: bool | None = None
    role: Role | None = None

    @model_validator(mode="after")
    def not_null(self):
        if any(getattr(self, key) is None for key in self.model_fields_set):
            raise ValueError("Account fields cannot be null.")
        return self


class Weights(Input):
    compatibility: float = Field(ge=0, le=100)
    distance: float = Field(ge=0, le=100)
    accessibility: float = Field(ge=0, le=100)
    charging: float = Field(ge=0, le=100)
    covered: float = Field(ge=0, le=100)

    @model_validator(mode="after")
    def positive_sum(self):
        if sum(self.model_dump().values()) <= 0:
            raise ValueError("At least one allocation weight must be positive.")
        return self


class SettingsInput(Input):
    weights: Weights
    cancellation_minutes: int = Field(ge=0, le=1440)
    max_booking_hours: int = Field(ge=1, le=720)
