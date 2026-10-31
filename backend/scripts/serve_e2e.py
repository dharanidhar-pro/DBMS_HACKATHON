"""Start an isolated E2E server. Never points at the development or production database."""

import os
import sys
from pathlib import Path

from dotenv import dotenv_values
from sqlalchemy.engine import make_url

backend = Path(__file__).resolve().parents[1]
os.chdir(backend)
sys.path.insert(0, str(backend))
config = dotenv_values(backend.parent / ".env")
source = os.environ.get("E2E_DATABASE_URL")
if not source:
    source = (
        make_url(os.environ.get("DATABASE_URL") or config["DATABASE_URL"])
        .set(database="parkly_e2e")
        .render_as_string(hide_password=False)
    )
if not make_url(source).database.endswith("_e2e"):
    raise SystemExit("Refusing to reset a database whose name does not end in _e2e.")
os.environ["DATABASE_URL"] = source
os.environ["APP_ENV"] = "test"
os.environ["COOKIE_SECURE"] = "false"
os.environ["ALLOWED_ORIGINS"] = "http://127.0.0.1:5174"

from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402
from sqlalchemy import select, text  # noqa: E402
import uvicorn  # noqa: E402
from app.cli import seed  # noqa: E402
from app.core.security import hasher  # noqa: E402
from app.db import Base, SessionLocal, engine  # noqa: E402
from app.models import Facility, User  # noqa: E402

command.upgrade(Config("alembic.ini"), "head")
with engine.begin() as connection:
    names = [table.name for table in Base.metadata.sorted_tables if table.name != "system_settings"]
    connection.execute(text("TRUNCATE " + ", ".join(names) + " CASCADE"))
with SessionLocal.begin() as db:
    seed(db)
    for name, role in [("operator", "OPERATOR"), ("admin", "ADMIN")]:
        user = User(
            name=f"E2E {name.title()}",
            email=f"{name}@e2e.example.com",
            password_hash=hasher.hash("E2eIsolatedPassword42"),
            role=role,
        )
        db.add(user)
        db.flush()
        if role == "OPERATOR":
            facility = db.scalar(select(Facility).order_by(Facility.name))
            facility.operator_id = user.id

uvicorn.run("app.main:app", host="127.0.0.1", port=8001, log_level="warning")
