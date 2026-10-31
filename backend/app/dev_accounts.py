"""Development-only demo accounts. Passwords stay in ignored local files."""

import json
import os
import secrets
from pathlib import Path
from sqlalchemy import select, text
from app.core.config import settings
from app.core.security import hasher, verify
from app.db import SessionLocal
from app.models import Facility, User
from app.schemas import Login
from app.cli import seed


def main():
    if settings.app_env != "development":
        raise SystemExit("Demo accounts are allowed only with APP_ENV=development.")
    folder = Path(__file__).resolve().parents[2] / ".local"
    folder.mkdir(exist_ok=True)
    destination = folder / "demo-accounts.json"
    saved = json.loads(destination.read_text()) if destination.exists() else {}
    credentials = {}
    with SessionLocal.begin() as db:
        db.execute(text("SELECT pg_advisory_xact_lock(7070777)"))
        seed(db)
        for role in ("CUSTOMER", "OPERATOR", "ADMIN"):
            email = f"{role.lower()}@parkly.demo"
            password = (
                os.environ.get(f"DEMO_{role}_PASSWORD")
                or saved.get(role, {}).get("password")
                or secrets.token_urlsafe(24) + "9a"
            )
            # Development fixtures may use shorter demo passwords. Public registration
            # and production provisioning retain their separate 12-character policy.
            Login(email=email, password=password)
            if len(password) < 8:
                raise SystemExit("Development demo passwords must have at least 8 characters.")
            user = db.scalar(select(User).where(User.email == email))
            if user:
                if user.role != role or not user.active or not verify(password, user.password_hash):
                    raise SystemExit(
                        f"{email} already exists with different access or credentials. No account changes committed."
                    )
            else:
                user = User(
                    name=f"Demo {role.title()}", email=email, password_hash=hasher.hash(password), role=role
                )
                db.add(user)
                db.flush()
            credentials[role] = {"email": email, "password": password}
            if role == "OPERATOR":
                for facility in db.scalars(
                    select(Facility).where(Facility.demo.is_(True), Facility.operator_id.is_(None))
                ):
                    facility.operator_id = user.id
    destination.write_text(json.dumps(credentials, indent=2), encoding="utf-8")
    (folder / "DEMO_ACCOUNTS.md").write_text(
        "# Local development credentials — do not commit\n\n"
        + "\n".join(f"- {r}: `{c['email']}` — password: `{c['password']}`" for r, c in credentials.items())
        + "\n",
        encoding="utf-8",
    )
    print("Demo accounts ready. Passwords: .local/DEMO_ACCOUNTS.md (git-ignored).")


if __name__ == "__main__":
    main()
