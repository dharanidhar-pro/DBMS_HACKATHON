"""One-time administrator bootstrap, requiring trusted database/server access."""

import argparse
import getpass
from sqlalchemy import select, text
from app.core.security import hasher
from app.db import SessionLocal
from app.models import User
from app.schemas import Register
from app.services import audit


def create_initial_admin(db, data):
    db.execute(text("SELECT pg_advisory_xact_lock(7070777)"))
    if db.scalar(select(User.id).where(User.role == "SUPER_ADMIN").limit(1)):
        raise ValueError(
            "Bootstrap is closed: an administrator already exists. Use authorized account management."
        )
    user = User(
        name=data.name, email=str(data.email).lower(), password_hash=hasher.hash(data.password), role="SUPER_ADMIN"
    )
    db.add(user)
    db.flush()
    audit(db, user, "account.admin_bootstrapped", user.id)
    return user


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--email", required=True)
    parser.add_argument("--name", required=True)
    args = parser.parse_args()
    password = getpass.getpass("Administrator password: ")
    if password != getpass.getpass("Confirm password: "):
        raise SystemExit("Passwords do not match.")
    data = Register(name=args.name, email=args.email, password=password)
    with SessionLocal.begin() as db:
        try:
            create_initial_admin(db, data)
        except ValueError as error:
            raise SystemExit(str(error)) from None
    print("Initial administrator created. Bootstrap is now closed.")


if __name__ == "__main__":
    main()
