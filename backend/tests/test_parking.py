from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from threading import Barrier

import pytest
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from app.db import SessionLocal
from app.main import app
from app.models import AllocationHistory, Notification, Reservation, StatusHistory, Vehicle, now
from conftest import Client, login


def booking(inventory, **changes):
    arrival = now() + timedelta(hours=2)
    return {
        "facility_id": inventory["facility"],
        "vehicle_id": inventory["vehicles"]["customer"],
        "arrival": arrival.isoformat(),
        "departure": (arrival + timedelta(hours=2)).isoformat(),
        **changes,
    }


def test_facilities_search_pagination_and_slots(client, inventory):
    result = client.get("/api/v1/facilities?q=Test&page_size=1").json()
    assert result["total"] == 2 and len(result["items"]) == 1
    assert "operator_id" not in result["items"][0]
    login(client)
    slots = client.get("/api/v1/slots", params={"facility_id": inventory["facility"]}).json()["items"]
    assert len(slots) == 6
    assert next(s for s in slots if s["label"] == "A-06")["availability"] == "MAINTENANCE"


@pytest.mark.parametrize(
    "preferences,label", [({}, "A-01"), ({"accessible": True}, "A-02"), ({"charging": True}, "A-03")]
)
def test_allocation_constraints_and_explanation(client, inventory, preferences, label):
    login(client)
    response = client.post("/api/v1/allocation/recommend", json=booking(inventory, **preferences))
    assert response.status_code == 200, response.text
    rec = response.json()["recommendation"]
    assert rec["slot"]["label"] == label
    assert rec["explanation"]["compatible"] is True
    assert sum(rec["explanation"]["weights"].values()) == pytest.approx(1)
    expected = (
        sum(rec["explanation"]["factors"][k] * v for k, v in rec["explanation"]["weights"].items()) * 100
    )
    assert rec["explanation"]["score"] == pytest.approx(expected, abs=0.01)


def test_vehicle_compatibility_and_no_eligible_space(client, inventory):
    login(client)
    with SessionLocal.begin() as db:
        db.get(Vehicle, inventory["vehicles"]["customer"]).vehicle_type = "SUV"
    assert (
        client.post("/api/v1/allocation/recommend", json=booking(inventory)).json()["recommendation"]["slot"][
            "label"
        ]
        == "A-04"
    )
    assert (
        client.post("/api/v1/allocation/recommend", json=booking(inventory, accessible=True)).status_code
        == 409
    )


def test_non_ev_cannot_request_charging(client, inventory):
    login(client)
    with SessionLocal.begin() as db:
        db.get(Vehicle, inventory["vehicles"]["customer"]).electric = False
    assert client.post("/api/v1/reservations", json=booking(inventory, charging=True)).status_code == 422


def test_create_history_notification_cancel(client, inventory):
    login(client)
    response = client.post("/api/v1/reservations", json=booking(inventory))
    assert response.status_code == 201, response.text
    data = response.json()
    assert data["status"] == "CONFIRMED" and data["estimated_cost"] == 12000
    detail = client.get(f"/api/v1/reservations/{data['id']}").json()
    assert detail["history"][0]["status"] == "CONFIRMED"
    with SessionLocal() as db:
        assert db.scalar(select(func.count()).select_from(AllocationHistory)) == 1
        assert db.scalar(select(func.count()).select_from(StatusHistory)) == 1
        assert db.scalar(select(func.count()).select_from(Notification)) == 1
    assert client.post(f"/api/v1/reservations/{data['id']}/cancel").json()["status"] == "CANCELLED"
    assert client.post(f"/api/v1/reservations/{data['id']}/cancel").status_code == 409
    assert client.get("/api/v1/reservations?history=true").json()["total"] == 1


@pytest.mark.parametrize("case", ["reversed", "past", "long", "naive", "future"])
def test_invalid_time_intervals(client, inventory, case):
    login(client)
    data = booking(inventory)
    if case == "reversed":
        data["departure"] = data["arrival"]
    if case == "past":
        data["arrival"] = (now() - timedelta(hours=1)).isoformat()
    if case == "long":
        data["departure"] = (now() + timedelta(days=5)).isoformat()
    if case == "naive":
        data["arrival"] = now().replace(tzinfo=None).isoformat()
    if case == "future":
        data["arrival"] = (now() + timedelta(days=400)).isoformat()
        data["departure"] = (now() + timedelta(days=401)).isoformat()
    assert client.post("/api/v1/reservations", json=data).status_code == 422


def test_ownership_and_selected_slot_validation(client, inventory):
    login(client)
    assert (
        client.post(
            "/api/v1/reservations", json=booking(inventory, vehicle_id=inventory["vehicles"]["other"])
        ).status_code
        == 404
    )
    assert (
        client.post(
            "/api/v1/reservations", json=booking(inventory, slot_id=inventory["other_slot"])
        ).status_code
        == 409
    )
    assert (
        client.post(
            "/api/v1/reservations", json=booking(inventory, slot_id=inventory["slots"][5])
        ).status_code
        == 409
    )
    result = client.post("/api/v1/reservations", json=booking(inventory)).json()
    client.post("/api/v1/auth/logout")
    login(client, "other")
    assert client.get(f"/api/v1/reservations/{result['id']}").status_code == 404
    assert client.post(f"/api/v1/reservations/{result['id']}/cancel").status_code == 404
    assert client.get("/api/v1/reservations").json()["total"] == 0


def test_overlap_conflict_adjacent_and_cancellation_releases(client, inventory):
    login(client)
    data = booking(inventory, slot_id=inventory["slots"][0])
    result = client.post("/api/v1/reservations", json=data).json()
    assert (
        client.post("/api/v1/reservations", json={**data, "slot_id": inventory["slots"][3]}).status_code
        == 409
    )
    client.post("/api/v1/auth/logout")
    login(client, "other")
    other = {**data, "vehicle_id": inventory["vehicles"]["other"]}
    assert client.post("/api/v1/reservations", json=other).status_code == 409
    adjacent = {**other, "arrival": data["departure"], "departure": (now() + timedelta(hours=6)).isoformat()}
    assert client.post("/api/v1/reservations", json=adjacent).status_code == 201
    client.post("/api/v1/auth/logout")
    login(client)
    assert client.post(f"/api/v1/reservations/{result['id']}/cancel").status_code == 200
    client.post("/api/v1/auth/logout")
    login(client, "other")
    assert client.post("/api/v1/reservations", json=other).status_code == 201


def test_concurrent_reservations_one_winner(inventory):
    data = booking(inventory, slot_id=inventory["slots"][0])
    barrier = Barrier(2)

    def attempt(who):
        with Client(app) as c:
            login(c, who)
            barrier.wait(timeout=10)
            return c.post(
                "/api/v1/reservations", json={**data, "vehicle_id": inventory["vehicles"][who]}
            ).status_code

    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(attempt, ["customer", "other"]))
    assert sorted(results) == [201, 409]
    with SessionLocal() as db:
        assert db.scalar(select(func.count()).select_from(Reservation)) == 1


def test_database_exclusion_independent_of_api(client, inventory):
    login(client)
    result = client.post(
        "/api/v1/reservations", json=booking(inventory, slot_id=inventory["slots"][0])
    ).json()
    with SessionLocal() as db:
        original = db.get(Reservation, result["id"])
        clone = Reservation(
            user_id=inventory["users"]["other"],
            vehicle_id=inventory["vehicles"]["other"],
            facility_id=original.facility_id,
            slot_id=original.slot_id,
            arrival=original.arrival,
            departure=original.departure,
            status="CONFIRMED",
            estimated_cost=0,
            hourly_rate=0,
            explanation={},
        )
        db.add(clone)
        with pytest.raises(IntegrityError):
            db.flush()
        db.rollback()


def test_operator_scope_maintenance_and_protected_inventory(client, inventory):
    login(client)
    booking_result = client.post(
        "/api/v1/reservations", json=booking(inventory, slot_id=inventory["slots"][0])
    ).json()
    assert client.delete(f"/api/v1/vehicles/{inventory['vehicles']['customer']}").status_code == 409
    client.post("/api/v1/auth/logout")
    login(client, "operator")
    facilities = client.get("/api/v1/management/facilities").json()
    assert facilities["total"] == 1 and facilities["items"][0]["id"] == inventory["facility"]
    assert client.get("/api/v1/slots", params={"facility_id": inventory["other_facility"]}).status_code == 404
    assert (
        client.patch(f"/api/v1/slots/{inventory['other_slot']}", json={"state": "MAINTENANCE"}).status_code
        == 404
    )
    assert (
        client.patch(f"/api/v1/slots/{inventory['slots'][0]}", json={"state": "MAINTENANCE"}).status_code
        == 409
    )
    assert (
        client.patch(f"/api/v1/slots/{inventory['slots'][1]}", json={"state": "MAINTENANCE"}).status_code
        == 200
    )
    assert (
        client.patch(f"/api/v1/slots/{inventory['slots'][1]}", json={"state": "AVAILABLE"}).status_code == 200
    )
    assert client.patch(f"/api/v1/slots/{inventory['slots'][1]}", json={"charging": True}).status_code == 403
    assert (
        client.patch(
            f"/api/v1/reservations/{booking_result['id']}/status", json={"status": "ACTIVE"}
        ).status_code
        == 409
    )


def test_vehicle_crud_and_notification_ownership(client, inventory):
    login(client)
    result = client.post(
        "/api/v1/vehicles", json={"registration": "ka 01 ab 1234", "vehicle_type": "SUV"}
    ).json()
    assert result["registration"] == "KA01AB1234"
    assert (
        client.put(
            f"/api/v1/vehicles/{result['id']}",
            json={"registration": "KA01AB1234", "vehicle_type": "CAR", "make": "Test"},
        ).json()["make"]
        == "Test"
    )
    assert client.delete(f"/api/v1/vehicles/{result['id']}").status_code == 200
    client.post("/api/v1/reservations", json=booking(inventory))
    notification = client.get("/api/v1/notifications").json()["items"][0]
    assert client.post(f"/api/v1/notifications/{notification['id']}/read").status_code == 200
    assert client.get("/api/v1/notifications?unread=true").json()["unread_count"] == 0
    client.post("/api/v1/auth/logout")
    login(client, "other")
    assert client.post(f"/api/v1/notifications/{notification['id']}/read").status_code == 404


def test_current_checkin_checkout_and_lifecycle(client, inventory):
    login(client)
    data = booking(
        inventory,
        arrival=(now() - timedelta(minutes=1)).isoformat(),
        departure=(now() + timedelta(hours=1)).isoformat(),
    )
    result = client.post("/api/v1/reservations", json=data)
    assert result.status_code == 201, result.text
    rid = result.json()["id"]
    assert client.post(f"/api/v1/reservations/{rid}/cancel").status_code == 409
    client.post("/api/v1/auth/logout")
    login(client, "operator")
    assert (
        client.patch(f"/api/v1/reservations/{rid}/status", json={"status": "ACTIVE"}).json()["status"]
        == "ACTIVE"
    )
    assert client.patch(f"/api/v1/reservations/{rid}/status", json={"status": "CANCELLED"}).status_code == 409
    assert (
        client.patch(f"/api/v1/reservations/{rid}/status", json={"status": "COMPLETED"}).json()["status"]
        == "COMPLETED"
    )
    assert client.patch(f"/api/v1/reservations/{rid}/status", json={"status": "ACTIVE"}).status_code == 409
