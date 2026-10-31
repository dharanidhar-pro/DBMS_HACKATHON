"""Integration tests are permitted only in a dedicated database ending in _test."""

import os
from pathlib import Path

import pytest
from dotenv import dotenv_values
from sqlalchemy.engine import make_url

project = Path(__file__).resolve().parents[2]
config = dotenv_values(project / ".env")
source = os.environ.get("TEST_DATABASE_URL")
if not source:
    development = make_url(os.environ.get("DATABASE_URL") or config["DATABASE_URL"])
    source = development.set(database="parkly_test").render_as_string(hide_password=False)
test_url = make_url(source)
if not test_url.database or not test_url.database.endswith("_test"):
    raise RuntimeError("Refusing to run tests outside a dedicated *_test PostgreSQL database.")
os.environ["DATABASE_URL"] = source
os.environ["APP_ENV"] = "test"

from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import text  # noqa: E402
from app.core.security import hasher  # noqa: E402
from app.db import Base, SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Facility, Slot, User, Vehicle, Zone  # noqa: E402

PASSWORD = "TestParkingPassword42"


@pytest.fixture(scope="session", autouse=True)
def migrate():
    command.upgrade(Config(str(project / "backend" / "alembic.ini")), "head")


@pytest.fixture(autouse=True)
def clean_database(migrate):
    assert make_url(str(engine.url)).database.endswith("_test")
    names = [table.name for table in Base.metadata.sorted_tables if table.name != "system_settings"]
    with engine.begin() as connection:
        connection.execute(text("TRUNCATE " + ", ".join(names) + " CASCADE"))
        connection.exec_driver_sql(
            """UPDATE system_settings SET weights = '{"compatibility":35,"distance":25,"accessibility":20,"charging":10,"covered":10}', cancellation_minutes=15, max_booking_hours=72 WHERE id=1"""
        )


class Client(TestClient):
    def request(self, method, url, **kwargs):
        headers = {"X-Parkly-Request": "1", **(kwargs.pop("headers", None) or {})}
        if self.cookies.get("parkly_csrf"):
            headers.setdefault("X-CSRF-Token", self.cookies.get("parkly_csrf"))
        return super().request(method, url, headers=headers, **kwargs)


@pytest.fixture
def client():
    with Client(app) as client:
        yield client


@pytest.fixture
def inventory():
    with SessionLocal.begin() as db:
        users = {}
        for name, role in [
            ("customer", "CUSTOMER"),
            ("other", "CUSTOMER"),
            ("operator", "OPERATOR"),
            ("outsider", "OPERATOR"),
            ("admin", "ADMIN"),
        ]:
            user = User(
                name=name.title(), email=f"{name}@example.com", password_hash=hasher.hash(PASSWORD), role=role
            )
            db.add(user)
            db.flush()
            users[name] = user.id
        facility = Facility(
            name="Test Garage",
            address="12 Test Street",
            city="Test City",
            operator_id=users["operator"],
            hourly_rate=6000,
        )
        other_facility = Facility(
            name="Other Garage",
            address="34 Test Street",
            city="Test City",
            operator_id=users["outsider"],
            hourly_rate=4000,
        )
        db.add_all([facility, other_facility])
        db.flush()
        zone = Zone(facility_id=facility.id, name="Zone A")
        other_zone = Zone(facility_id=other_facility.id, name="Zone B")
        db.add_all([zone, other_zone])
        db.flush()
        slots = []
        for label, kind, accessible, charging, state, distance in [
            ("A-01", "CAR", False, False, "AVAILABLE", 10),
            ("A-02", "CAR", True, False, "AVAILABLE", 5),
            ("A-03", "CAR", False, True, "AVAILABLE", 20),
            ("A-04", "SUV", False, False, "AVAILABLE", 30),
            ("A-05", "MOTORCYCLE", False, False, "AVAILABLE", 10),
            ("A-06", "CAR", False, False, "MAINTENANCE", 0),
        ]:
            slot = Slot(
                facility_id=facility.id,
                zone_id=zone.id,
                label=label,
                vehicle_type=kind,
                accessible=accessible,
                charging=charging,
                state=state,
                distance_m=distance,
            )
            db.add(slot)
            db.flush()
            slots.append(slot.id)
        other_slot = Slot(
            facility_id=other_facility.id, zone_id=other_zone.id, label="B-01", vehicle_type="CAR"
        )
        db.add(other_slot)
        vehicles = {}
        for person in ("customer", "other"):
            vehicle = Vehicle(
                user_id=users[person], registration=f"TEST{person.upper()}", vehicle_type="CAR", electric=True
            )
            db.add(vehicle)
            db.flush()
            vehicles[person] = vehicle.id
        db.flush()
        return {
            "users": users,
            "facility": facility.id,
            "other_facility": other_facility.id,
            "zone": zone.id,
            "other_zone": other_zone.id,
            "slots": slots,
            "other_slot": other_slot.id,
            "vehicles": vehicles,
        }


def login(client, who="customer", portal=None):
    portal = portal or (
        who if who in ("operator", "admin") else "operator" if who == "outsider" else "customer"
    )
    response = client.post(
        f"/api/v1/auth/login/{portal}", json={"email": f"{who}@example.com", "password": PASSWORD}
    )
    assert response.status_code == 200, response.text
    return response.json()
