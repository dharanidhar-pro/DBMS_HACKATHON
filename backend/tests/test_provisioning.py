import pytest
from app.bootstrap import create_initial_admin
from app.db import SessionLocal
from app.schemas import Register
from conftest import PASSWORD, login


def test_initial_admin_bootstrap_closes_after_first_account(client):
    data = Register(name="Initial Admin", email="initial@example.com", password=PASSWORD)
    with SessionLocal.begin() as db:
        create_initial_admin(db, data)
    with SessionLocal.begin() as db:
        with pytest.raises(ValueError, match="Bootstrap is closed"):
            create_initial_admin(db, data)


def test_admin_operator_creation_and_role_enforcement(client, inventory):
    data = {"name": "New Operator", "email": "newoperator@example.com", "password": PASSWORD}
    assert client.post("/api/v1/admin/operators", json=data).status_code == 401
    login(client)
    assert client.post("/api/v1/admin/operators", json=data).status_code == 403
    client.post("/api/v1/auth/logout")
    login(client, "operator")
    assert client.post("/api/v1/admin/operators", json=data).status_code == 403
    client.post("/api/v1/auth/logout")
    login(client, "admin")
    result = client.post("/api/v1/admin/operators", json=data)
    assert result.status_code == 201 and result.json()["role"] == "OPERATOR"
    assert client.post("/api/v1/admin/operators", json=data).status_code == 409
    assert client.post("/api/v1/admin/operators", json={**data, "role": "ADMIN"}).status_code == 422
    client.post("/api/v1/auth/logout")
    assert (
        client.post(
            "/api/v1/auth/login/operator", json={"email": data["email"], "password": PASSWORD}
        ).status_code
        == 200
    )
