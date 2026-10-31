"""Explicit account provisioning and optional demonstration inventory."""

import argparse
import getpass

from sqlalchemy import select

from app.core.security import hasher
from app.db import SessionLocal
from app.models import Facility, Slot, User, Zone
from app.schemas import Register


def seed(db):
    if db.scalar(select(Facility.id).where(Facility.demo.is_(True)).limit(1)):
        print("Demonstration inventory already exists; skipped.")
        return
    locations = [
        (
            "The Exchange",
            "12 Residency Road, Ashok Nagar",
            "Bengaluru",
            6000,
            "Covered city parking, a short walk from the heart of the neighbourhood.",
        ),
        (
            "Greenway Commons",
            "48 Indiranagar, 100 Feet Road",
            "Bengaluru",
            4500,
            "An easy arrival, with EV-ready spaces and room to recharge.",
        ),
        (
            "Central Station",
            "Station Road, Majestic",
            "Bengaluru",
            4000,
            "Well-connected parking for your next connection.",
        ),
    ]
    for name, address, city, rate, description in locations:
        facility = Facility(
            name=name, address=address, city=city, hourly_rate=rate, description=description, demo=True
        )
        db.add(facility)
        db.flush()
        for prefix in ("A", "B"):
            zone = Zone(
                facility_id=facility.id, name=f"Zone {prefix}", level="Ground" if prefix == "A" else "Level 1"
            )
            db.add(zone)
            db.flush()
            for number in range(1, 13):
                db.add(
                    Slot(
                        facility_id=facility.id,
                        zone_id=zone.id,
                        label=f"{prefix}-{number:02}",
                        vehicle_type="MOTORCYCLE"
                        if number > 10
                        else "SUV"
                        if number in (8, 9, 10)
                        else "CAR",
                        accessible=number in (1, 2),
                        charging=number in (3, 4),
                        covered=True,
                        distance_m=number * 8 + (20 if prefix == "B" else 0),
                        position=(0 if prefix == "A" else 12) + number,
                        state="MAINTENANCE" if prefix == "B" and number == 12 else "AVAILABLE",
                    )
                )
    print(
        "Created three clearly labelled demonstration facilities. No customer data or bookings were fabricated."
    )


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("seed-demo", help="Add labelled demonstration inventory; creates no accounts.")
    provision = commands.add_parser("create-user", help="Provision a user with a password entered securely.")
    provision.add_argument("--email", required=True)
    provision.add_argument("--name", required=True)
    provision.add_argument("--role", choices=["CUSTOMER"], required=True)
    args = parser.parse_args()
    with SessionLocal.begin() as db:
        if args.command == "seed-demo":
            seed(db)
        else:
            password = getpass.getpass("Password (at least 12 characters, letter and number): ")
            if password != getpass.getpass("Confirm password: "):
                raise SystemExit("Passwords do not match.")
            data = Register(name=args.name, email=args.email, password=password)
            if db.scalar(select(User.id).where(User.email == str(data.email).lower())):
                raise SystemExit("Account already exists; no changes made.")
            db.add(
                User(
                    name=data.name,
                    email=str(data.email).lower(),
                    password_hash=hasher.hash(password),
                    role=args.role,
                )
            )
            print(f"Created {args.role.lower()} account. Sign in through its portal.")


if __name__ == "__main__":
    main()
