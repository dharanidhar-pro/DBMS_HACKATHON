from datetime import timedelta

from app.models import now
from conftest import login
from test_parking import booking


def test_analytics_from_records_filters_export_and_pagination(client, inventory):
    login(client)
    reservation = client.post("/api/v1/reservations", json=booking(inventory)).json()
    client.post(f"/api/v1/reservations/{reservation['id']}/cancel")
    client.post("/api/v1/auth/logout")
    login(client, "admin")
    end = (now() + timedelta(days=1)).date().isoformat()
    response = client.get(f"/api/v1/analytics/overview?end={end}")
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["total_reservations"] == 1
    assert data["cancellation_rate"] == 100
    assert sum(d["reservations"] for d in data["daily"]) == 1
    assert data["total_users"] == 5 and data["total_slots"] == 7
    assert data["vehicle_types"] == [{"name": "CAR", "value": 1}]
    assert (
        client.get("/api/v1/analytics/overview?start=2020-01-01&end=2020-01-05").json()["total_reservations"]
        == 0
    )
    assert client.get("/api/v1/analytics/overview?start=2026-12-01&end=2026-01-01").status_code == 422
    assert client.get("/api/v1/analytics/overview?start=2020-01-01&end=2026-01-01").status_code == 422
    assert "date_utc,reservations" in client.get("/api/v1/analytics/export").text
    assert client.get("/api/v1/admin/users?page_size=2&page=2").json()["total"] == 5
    assert len(client.get("/api/v1/admin/users?page_size=2&page=2").json()["items"]) == 2
    assert client.get("/api/v1/admin/users?page=-1").status_code == 422


def test_facility_zone_slot_crud_and_settings(client, inventory):
    login(client, "admin")
    facility = {
        "name": "New Garage",
        "address": "55 New Road",
        "city": "City",
        "hourly_rate": 1000,
        "operator_id": inventory["users"]["operator"],
    }
    response = client.post("/api/v1/facilities", json=facility)
    assert response.status_code == 201, response.text
    data = response.json()
    assert data["zones"][0]["name"] == "Zone A"
    zone = client.post(
        f"/api/v1/facilities/{data['id']}/zones", json={"name": "Zone C", "level": "Level 2"}
    ).json()
    slot = {"facility_id": data["id"], "zone_id": zone["id"], "label": "C-01", "vehicle_type": "SUV"}
    new_slot = client.post("/api/v1/slots", json=slot)
    assert new_slot.status_code == 201
    assert (
        client.post(
            "/api/v1/slots", json={**slot, "zone_id": inventory["other_zone"], "label": "BAD"}
        ).status_code
        == 422
    )
    assert (
        client.put(f"/api/v1/facilities/{data['id']}", json={**facility, "hourly_rate": 2000}).json()[
            "hourly_rate"
        ]
        == 2000
    )
    assert (
        client.put(f"/api/v1/facilities/{data['id']}", json={**facility, "active": False}).json()["active"]
        is False
    )
    settings = {
        "weights": {"compatibility": 2, "distance": 1, "accessibility": 1, "charging": 0, "covered": 0},
        "cancellation_minutes": 30,
        "max_booking_hours": 24,
    }
    result = client.put("/api/v1/admin/settings", json=settings)
    assert result.status_code == 200, result.text
    assert result.json()["weights"]["compatibility"] == 50
    assert (
        client.put(
            "/api/v1/admin/settings", json={**settings, "weights": {k: 0 for k in settings["weights"]}}
        ).status_code
        == 422
    )
    logs = client.get("/api/v1/admin/audit-logs?q=facility").json()
    assert logs["total"] >= 3


def test_assigned_operator_cannot_be_disabled_and_reports_scoped(client, inventory):
    login(client, "admin")
    assert (
        client.patch(
            f"/api/v1/admin/users/{inventory['users']['operator']}", json={"active": False}
        ).status_code
        == 409
    )
    client.post("/api/v1/auth/logout")
    login(client, "operator")
    data = client.get("/api/v1/analytics/overview").json()
    assert data["total_facilities"] == 1 and data["total_slots"] == 6 and data["total_users"] is None
    assert (
        client.get(f"/api/v1/analytics/overview?facility_id={inventory['other_facility']}").status_code == 404
    )
