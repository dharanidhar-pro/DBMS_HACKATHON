from datetime import timedelta

import pytest
from sqlalchemy import select

from app.core.security import hasher
from app.db import SessionLocal
from app.models import AuthSession, User, now
from conftest import PASSWORD, login


def test_register_login_logout_hash_and_cookie(client):
    response = client.post(
        "/api/v1/auth/register",
        json={"name": "New Customer", "email": "new@example.com", "password": PASSWORD},
    )
    assert response.status_code == 201
    assert response.json()["role"] == "CUSTOMER"
    assert "password" not in response.text
    assert client.get("/api/v1/auth/me").status_code == 401
    response = client.post(
        "/api/v1/auth/login/customer", json={"email": "new@example.com", "password": PASSWORD}
    )
    assert response.status_code == 200
    assert "HttpOnly" in response.headers["set-cookie"]
    assert "SameSite=lax" in response.headers["set-cookie"]
    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.email == "new@example.com"))
        assert user.password_hash != PASSWORD and hasher.verify(user.password_hash, PASSWORD)
        session = db.scalar(select(AuthSession))
        assert session.token_hash != client.cookies.get("parkly_session")
    assert client.get("/api/v1/auth/me").status_code == 200
    assert client.post("/api/v1/auth/logout").status_code == 200
    assert client.get("/api/v1/auth/me").status_code == 401


@pytest.mark.parametrize("role", ["ADMIN", "OPERATOR"])
def test_registration_cannot_assign_privileged_role(client, role):
    response = client.post(
        "/api/v1/auth/register",
        json={"name": "Intruder", "email": "x@example.com", "password": PASSWORD, "role": role},
    )
    assert response.status_code == 422


@pytest.mark.parametrize("who", ["customer", "operator", "admin"])
def test_three_role_logins(client, inventory, who):
    assert login(client, who)["role"] == who.upper()


def test_wrong_portal_and_invalid_password(client, inventory):
    assert (
        client.post(
            "/api/v1/auth/login/admin", json={"email": "customer@example.com", "password": PASSWORD}
        ).status_code
        == 401
    )
    assert (
        client.post(
            "/api/v1/auth/login/customer", json={"email": "customer@example.com", "password": "wrong"}
        ).status_code
        == 401
    )
    assert client.get("/api/v1/admin/users").status_code == 401


def test_unauthorized_and_customer_role_enforcement(client, inventory):
    for endpoint in ("/vehicles", "/reservations", "/admin/users", "/analytics/overview"):
        assert client.get("/api/v1" + endpoint).status_code == 401
    login(client)
    for endpoint in ("/admin/users", "/management/facilities", "/analytics/overview", "/admin/settings"):
        assert client.get("/api/v1" + endpoint).status_code == 403


def test_operator_cannot_access_admin(client, inventory):
    login(client, "operator")
    assert client.get("/api/v1/admin/users").status_code == 403
    assert client.put("/api/v1/admin/settings", json={}).status_code == 403


def test_expired_session_and_invalid_token(client, inventory):
    login(client)
    with SessionLocal.begin() as db:
        for session in db.scalars(select(AuthSession)):
            session.expires_at = now() - timedelta(seconds=1)
    assert client.get("/api/v1/auth/me").status_code == 401
    client.cookies.set("parkly_session", "invalid", domain="testserver.local", path="/")
    assert client.get("/api/v1/auth/me").status_code == 401


def test_inactive_account_rejected(client, inventory):
    login(client)
    with SessionLocal.begin() as db:
        db.get(User, inventory["users"]["customer"]).active = False
    assert client.get("/api/v1/vehicles").status_code == 401


def test_csrf_and_origin_protection(client, inventory):
    login(client)
    assert (
        client.post(
            "/api/v1/vehicles",
            json={"registration": "TEST123", "vehicle_type": "CAR"},
            headers={"X-CSRF-Token": "bad"},
        ).status_code
        == 403
    )
    assert client.post("/api/v1/auth/logout", headers={"Origin": "https://evil.example"}).status_code == 403
    assert client.post("/api/v1/auth/logout", headers={"X-Parkly-Request": ""}).status_code == 403


def test_duplicate_email_and_password_rules(client):
    data = {"name": "New Customer", "email": "new@example.com", "password": PASSWORD}
    assert client.post("/api/v1/auth/register", json=data).status_code == 201
    assert client.post("/api/v1/auth/register", json=data).status_code == 409
    assert (
        client.post(
            "/api/v1/auth/register", json={**data, "email": "weak@example.com", "password": "weak"}
        ).status_code
        == 422
    )


def test_rate_limit(client):
    data = {"email": "absent@example.com", "password": "invalid"}
    for _ in range(10):
        assert client.post("/api/v1/auth/login/customer", json=data).status_code == 401
    response = client.post("/api/v1/auth/login/customer", json=data)
    assert response.status_code == 429 and response.headers["retry-after"] == "900"


def test_last_admin_guard_and_session_revocation(client, inventory):
    login(client, "admin")
    target = inventory["users"]["admin"]
    assert client.patch(f"/api/v1/admin/users/{target}", json={"active": False}).status_code == 409
    assert client.patch(f"/api/v1/admin/users/{target}", json={"role": "CUSTOMER"}).status_code == 409


def test_profile_cannot_change_role_and_password_revokes_sessions(client, inventory):
    login(client)
    assert client.patch("/api/v1/auth/me", json={"name": "Updated", "role": "ADMIN"}).status_code == 422
    assert client.patch("/api/v1/auth/me", json={"name": "Updated Name"}).json()["name"] == "Updated Name"
    old_token = client.cookies.get("parkly_session")
    assert (
        client.post(
            "/api/v1/auth/password",
            json={"current_password": PASSWORD, "new_password": "NewSecurePassword567"},
        ).status_code
        == 200
    )
    assert client.cookies.get("parkly_session") != old_token
    assert client.get("/api/v1/auth/me").status_code == 200
