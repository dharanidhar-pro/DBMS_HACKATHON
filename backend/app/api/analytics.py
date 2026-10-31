import csv
import io
from datetime import datetime, time, timedelta
from datetime import date as Date

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import Date as SQLDate, cast, extract, func, select
from sqlalchemy.orm import Session

from app.core.security import current_user, roles
from app.db import get_db
from app.models import Facility, Reservation, Slot, User, Vehicle, now
from app.services import BLOCKING, managed_facility, facility_scope, reservation_data, reservation_query

router = APIRouter(tags=["Analytics"])


@router.get("/dashboard")
def dashboard(user: User = Depends(current_user), db: Session = Depends(get_db, scope="function")):
    query = reservation_query(user)
    count = db.scalar(select(func.count()).select_from(query.subquery()))
    upcoming = db.scalars(
        query.where(Reservation.status.in_(BLOCKING), Reservation.departure > now())
        .order_by(Reservation.arrival)
        .limit(5)
    ).all()
    recent = db.scalars(query.order_by(Reservation.created_at.desc()).limit(5)).all()
    vehicles = db.scalar(
        select(func.count()).select_from(Vehicle).where(Vehicle.user_id == user.id, Vehicle.active.is_(True))
    )
    return {
        "reservations": count,
        "vehicles": vehicles,
        "upcoming": [reservation_data(db, r) for r in upcoming],
        "recent": [reservation_data(db, r) for r in recent],
    }


def report(db, user, start, end, facility_id):
    end = end or now().date()
    start = start or end - timedelta(days=29)
    if start > end or (end - start).days > 366:
        raise HTTPException(422, "Choose an ordered date range of up to 367 days.")
    start_at = datetime.combine(start, time.min, tzinfo=now().tzinfo)
    end_at = datetime.combine(end + timedelta(days=1), time.min, tzinfo=now().tzinfo)
    if facility_id:
        managed_facility(db, facility_id, user)
    facilities = facility_scope(select(Facility.id), user, Facility.id)
    if facility_id:
        facilities = facilities.where(Facility.id == facility_id)
    base = [
        Reservation.facility_id.in_(facilities),
        Reservation.arrival >= start_at,
        Reservation.arrival < end_at,
    ]
    total = db.scalar(select(func.count()).select_from(Reservation).where(*base))
    cancellations = db.scalar(
        select(func.count()).select_from(Reservation).where(*base, Reservation.status == "CANCELLED")
    )
    duration = db.scalar(
        select(func.avg(extract("epoch", Reservation.departure - Reservation.arrival) / 3600)).where(*base)
    )
    slots = db.scalar(select(func.count()).select_from(Slot).where(Slot.facility_id.in_(facilities)))
    occupied = db.scalar(
        select(func.count(func.distinct(Reservation.slot_id))).where(
            Reservation.facility_id.in_(facilities),
            Reservation.status == "ACTIVE",
            Reservation.arrival <= now(),
            Reservation.departure > now(),
        )
    )
    reserved = db.scalar(
        select(func.count(func.distinct(Reservation.slot_id))).where(
            Reservation.facility_id.in_(facilities),
            Reservation.status == "CONFIRMED",
            Reservation.arrival <= now(),
            Reservation.departure > now(),
        )
    )
    maintenance = db.scalar(
        select(func.count())
        .select_from(Slot)
        .where(Slot.facility_id.in_(facilities), Slot.state != "AVAILABLE")
    )
    daily_rows = db.execute(
        select(cast(Reservation.arrival, SQLDate), func.count())
        .where(*base)
        .group_by(cast(Reservation.arrival, SQLDate))
    ).all()
    daily_lookup = {str(d): n for d, n in daily_rows}
    daily = [
        {
            "date": str(start + timedelta(days=i)),
            "reservations": daily_lookup.get(str(start + timedelta(days=i)), 0),
        }
        for i in range((end - start).days + 1)
    ]
    types = db.execute(
        select(Vehicle.vehicle_type, func.count())
        .join(Reservation, Reservation.vehicle_id == Vehicle.id)
        .where(*base)
        .group_by(Vehicle.vehicle_type)
    ).all()
    peaks = db.execute(
        select(extract("hour", Reservation.arrival), func.count())
        .where(*base)
        .group_by(extract("hour", Reservation.arrival))
        .order_by(extract("hour", Reservation.arrival))
    ).all()
    booked_seconds = func.extract(
        "epoch", func.least(Reservation.departure, end_at) - func.greatest(Reservation.arrival, start_at)
    )
    usage = (
        db.scalar(
            select(func.sum(booked_seconds)).where(
                Reservation.facility_id.in_(facilities),
                Reservation.status.in_(("CONFIRMED", "ACTIVE", "COMPLETED")),
                Reservation.arrival < end_at,
                Reservation.departure > start_at,
            )
        )
        or 0
    )
    performance = db.execute(
        select(Facility.name, func.count(Reservation.id))
        .join(Reservation, Reservation.facility_id == Facility.id)
        .where(*base)
        .group_by(Facility.id, Facility.name)
    ).all()
    return {
        "start": start,
        "end": end,
        "total_reservations": total,
        "cancellations": cancellations,
        "cancellation_rate": round(cancellations / total * 100, 1) if total else 0,
        "average_duration_hours": round(float(duration or 0), 2),
        "total_slots": slots,
        "occupied_slots": occupied,
        "reserved_slots": reserved,
        "maintenance_slots": maintenance,
        "available_slots": max(0, slots - occupied - reserved - maintenance),
        "occupancy_percent": round(100 * occupied / slots, 1) if slots else 0,
        "reserved_utilization_percent": round(
            100 * float(usage) / (slots * (end_at - start_at).total_seconds()), 2
        )
        if slots
        else 0,
        "total_facilities": db.scalar(select(func.count()).select_from(facilities.subquery())),
        "total_users": db.scalar(select(func.count()).select_from(User)) if user.role == "SUPER_ADMIN" else (db.scalar(select(func.count()).select_from(User).where(User.role == "OPERATOR", User.admin_id == user.id)) if user.role == "ADMIN" else None),
        "daily": daily,
        "vehicle_types": [{"name": t, "value": n} for t, n in types],
        "peak_hours": [{"hour": int(h), "reservations": n} for h, n in peaks],
        "facility_performance": [{"name": n, "reservations": count} for n, count in performance],
    }


@router.get("/analytics/overview")
def overview(
    start: Date | None = None,
    end: Date | None = None,
    facility_id: str | None = None,
    user: User = Depends(roles("OPERATOR", "ADMIN", "SUPER_ADMIN")),
    db: Session = Depends(get_db, scope="function"),
):
    return report(db, user, start, end, facility_id)


@router.get("/analytics/export")
def export(
    start: Date | None = None,
    end: Date | None = None,
    facility_id: str | None = None,
    user: User = Depends(roles("OPERATOR", "ADMIN", "SUPER_ADMIN")),
    db: Session = Depends(get_db, scope="function"),
):
    data = report(db, user, start, end, facility_id)
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["date_utc", "reservations"])
    writer.writerows((row["date"], row["reservations"]) for row in data["daily"])
    return Response(
        buffer.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="parkly-reservations.csv"'},
    )
