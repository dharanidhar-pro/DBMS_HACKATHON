import math
from datetime import timedelta

from fastapi import HTTPException
from sqlalchemy import func, select

from app.models import (
    AllocationHistory,
    AuditLog,
    Facility,
    Notification,
    Reservation,
    Slot,
    StatusHistory,
    SystemSettings,
    User,
    Vehicle,
    Zone,
    now,
)

BLOCKING = ("CONFIRMED", "ACTIVE")


def row_data(row, exclude=()):
    return {c.name: getattr(row, c.name) for c in row.__table__.columns if c.name not in exclude}


def audit(db, user, action, entity_id=None, **details):
    db.add(AuditLog(actor_id=user.id if user else None, action=action, entity_id=entity_id, details=details))


def notify(db, user_id, title, message, reservation_id=None):
    db.add(Notification(user_id=user_id, title=title, message=message, reservation_id=reservation_id))


def get_settings(db):
    return db.get(SystemSettings, 1)


def facility_scope(query, user, column):
    if user.role == "OPERATOR":
        return query.where(column.in_(select(Facility.id).where(Facility.operator_id == user.id)))
    if user.role == "ADMIN":
        return query.where(column.in_(select(Facility.id).where(Facility.admin_id == user.id)))
    return query


def managed_facility(db, facility_id, user, lock=False):
    query = select(Facility).where(Facility.id == facility_id)
    if lock:
        query = query.with_for_update()
    facility = db.scalar(query)
    if not facility or (user.role == "OPERATOR" and facility.operator_id != user.id) or (user.role == "ADMIN" and facility.admin_id != user.id):
        raise HTTPException(404, "Facility not found in your workspace.")
    return facility


def owned_vehicle(db, vehicle_id, user, lock=False):
    query = select(Vehicle).where(
        Vehicle.id == vehicle_id, Vehicle.user_id == user.id, Vehicle.active.is_(True)
    )
    if lock:
        query = query.with_for_update()
    vehicle = db.scalar(query)
    if not vehicle:
        raise HTTPException(404, "Choose an active vehicle belonging to your account.")
    return vehicle


def validate_booking(db, data, user, lock=False):
    config = get_settings(db)
    if data.arrival < now() - timedelta(minutes=5):
        raise HTTPException(422, "Arrival cannot be in the past.")
    if data.arrival > now() + timedelta(days=365):
        raise HTTPException(422, "Bookings can be made up to one year ahead.")
    if (data.departure - data.arrival).total_seconds() > config.max_booking_hours * 3600:
        raise HTTPException(422, f"A reservation may last up to {config.max_booking_hours} hours.")
    facility = managed_facility(db, data.facility_id, user, lock)
    if not facility.active:
        raise HTTPException(409, "This facility is not accepting reservations.")
    vehicle = owned_vehicle(db, data.vehicle_id, user, lock)
    if data.charging and not vehicle.electric:
        raise HTTPException(422, "Charging spaces require an electric vehicle.")
    conflict = db.scalar(
        select(Reservation.id)
        .where(
            Reservation.vehicle_id == vehicle.id,
            Reservation.status.in_(BLOCKING),
            Reservation.arrival < data.departure,
            Reservation.departure > data.arrival,
        )
        .limit(1)
    )
    if conflict:
        raise HTTPException(409, "This vehicle already has a reservation during that time.")
    return facility, vehicle, config


def compatible(slot, vehicle):
    return slot.vehicle_type == vehicle.vehicle_type or (
        vehicle.vehicle_type == "CAR" and slot.vehicle_type == "SUV"
    )


def hard_reason(slot, vehicle, accessible, charging):
    if slot.state != "AVAILABLE":
        return "Under maintenance" if slot.state == "MAINTENANCE" else "Slot inactive"
    if vehicle and not compatible(slot, vehicle):
        return "Not compatible with your vehicle"
    if accessible and not slot.accessible:
        return "Accessible space required"
    if charging and not slot.charging:
        return "EV charging required"
    return None


def rank_candidates(db, data, vehicle, config):
    conflicts = select(Reservation.slot_id).where(
        Reservation.status.in_(BLOCKING),
        Reservation.arrival < data.departure,
        Reservation.departure > data.arrival,
    )
    slots = db.scalars(
        select(Slot).where(Slot.facility_id == data.facility_id, Slot.id.not_in(conflicts))
    ).all()
    candidates = []
    total_weight = sum(config.weights.values())
    for slot in slots:
        if hard_reason(slot, vehicle, data.accessible, data.charging):
            continue
        factors = {
            "compatibility": 1.0 if slot.vehicle_type == vehicle.vehicle_type else 0.85,
            "distance": 1 / (1 + slot.distance_m / 50),
            "accessibility": float(slot.accessible == data.accessible),
            "charging": float(slot.charging == data.charging),
            "covered": float(slot.covered) if data.prefer_covered else 1.0,
        }
        score = round(
            100 * sum(factors[key] * weight for key, weight in config.weights.items()) / total_weight, 2
        )
        explanation = {
            "score": score,
            "factors": factors,
            "weights": {key: round(value / total_weight, 6) for key, value in config.weights.items()},
            "compatible": True,
            "distance_m": slot.distance_m,
            "reasons": [
                f"Fits your {vehicle.vehicle_type.lower()}",
                f"{slot.distance_m} m from the entrance",
                "Covered parking" if slot.covered else "Open-air parking",
            ]
            + (["Accessible space"] if slot.accessible else [])
            + (["EV charging available"] if slot.charging else []),
        }
        candidates.append({"slot": row_data(slot), "explanation": explanation})
    candidates.sort(
        key=lambda c: (
            -c["explanation"]["score"],
            c["slot"]["distance_m"],
            c["slot"]["label"],
            c["slot"]["id"],
        )
    )
    return candidates


def estimate_cost(rate, arrival, departure):
    # Exact integer arithmetic; round a started minute up and the final paise up.
    minutes = math.ceil((departure - arrival).total_seconds() / 60)
    return (rate * minutes + 59) // 60


def make_reservation(db, data, user):
    facility, vehicle, config = validate_booking(db, data, user, lock=True)
    candidates = rank_candidates(db, data, vehicle, config)
    chosen = (
        next((item for item in candidates if item["slot"]["id"] == data.slot_id), None)
        if data.slot_id
        else (candidates[0] if candidates else None)
    )
    if not chosen:
        raise HTTPException(409, "No eligible space is available. Try another time, space, or facility.")
    # Facility lock serializes inventory mutation; exclusion constraints are the final independent guarantee.
    db.scalar(select(Slot).where(Slot.id == chosen["slot"]["id"]).with_for_update())
    explanation = {
        **chosen["explanation"],
        "selection": "Your selected eligible space" if data.slot_id else "Highest ranked eligible space",
        "eligible_candidates": len(candidates),
    }
    reservation = Reservation(
        user_id=user.id,
        vehicle_id=vehicle.id,
        facility_id=facility.id,
        slot_id=chosen["slot"]["id"],
        arrival=data.arrival,
        departure=data.departure,
        status="CONFIRMED",
        hourly_rate=facility.hourly_rate,
        estimated_cost=estimate_cost(facility.hourly_rate, data.arrival, data.departure),
        explanation=explanation,
    )
    db.add(reservation)
    db.flush()
    db.add(AllocationHistory(reservation_id=reservation.id, details=explanation))
    db.add(
        StatusHistory(
            reservation_id=reservation.id, actor_id=user.id, previous_status=None, status="CONFIRMED"
        )
    )
    notify(
        db,
        user.id,
        "Your space is reserved",
        f"{facility.name} · {chosen['slot']['label']}. You're all set.",
        reservation.id,
    )
    audit(db, user, "reservation.created", reservation.id, slot_id=reservation.slot_id)
    db.flush()
    return reservation_data(db, reservation)


def reservation_query(user):
    query = select(Reservation)
    if user.role == "CUSTOMER":
        return query.where(Reservation.user_id == user.id)
    return facility_scope(query, user, Reservation.facility_id)


def get_reservation(db, reservation_id, user, lock=False):
    query = reservation_query(user).where(Reservation.id == reservation_id)
    if lock:
        query = query.with_for_update()
    reservation = db.scalar(query)
    if not reservation:
        raise HTTPException(404, "Reservation not found.")
    return reservation


def reservation_data(db, reservation):
    facility = db.get(Facility, reservation.facility_id)
    slot = db.get(Slot, reservation.slot_id)
    vehicle = db.get(Vehicle, reservation.vehicle_id)
    return {
        **row_data(reservation),
        "facility_name": facility.name,
        "facility_address": facility.address,
        "facility_demo": facility.demo,
        "slot_label": slot.label,
        "registration": vehicle.registration,
        "vehicle_type": vehicle.vehicle_type,
        "cancellation_deadline": reservation.arrival
        - timedelta(minutes=get_settings(db).cancellation_minutes),
    }


def change_status(db, reservation_id, status, user):
    reservation = get_reservation(db, reservation_id, user, lock=True)
    allowed = {"CONFIRMED": {"ACTIVE", "CANCELLED", "NO_SHOW"}, "ACTIVE": {"COMPLETED"}}
    if status not in allowed.get(reservation.status, set()):
        raise HTTPException(409, f"Cannot change {reservation.status.lower()} to {status.lower()}.")
    if user.role == "CUSTOMER":
        if status != "CANCELLED":
            raise HTTPException(403, "Only parking staff can check vehicles in or out.")
        if now() >= reservation.arrival - timedelta(minutes=get_settings(db).cancellation_minutes):
            raise HTTPException(409, "The cancellation window has closed. Contact the facility operator.")
    if status == "ACTIVE" and not reservation.arrival <= now() < reservation.departure:
        raise HTTPException(409, "Check-in is allowed during the booked interval.")
    if status == "NO_SHOW" and now() < reservation.arrival:
        raise HTTPException(409, "A reservation cannot be marked no-show before arrival.")
    previous = reservation.status
    reservation.status = status
    db.add(
        StatusHistory(
            reservation_id=reservation.id, actor_id=user.id, previous_status=previous, status=status
        )
    )
    notify(
        db,
        reservation.user_id,
        f"Reservation {status.lower().replace('_', ' ')}",
        f"Booking {reservation.id[:8].upper()} has been updated.",
        reservation.id,
    )
    audit(db, user, "reservation.status_changed", reservation.id, previous=previous, status=status)
    db.flush()
    return reservation_data(db, reservation)


def paginate(db, query, page=1, page_size=20):
    total = db.scalar(select(func.count()).select_from(query.order_by(None).subquery()))
    items = db.scalars(query.offset((page - 1) * page_size).limit(page_size)).all()
    return items, total


def page_response(items, total, page, page_size):
    return {"items": items, "total": total, "page": page, "page_size": page_size}


def slot_data(db, slot, arrival, departure, vehicle=None, accessible=False, charging=False):
    reservation = db.scalar(
        select(Reservation)
        .where(
            Reservation.slot_id == slot.id,
            Reservation.status.in_(BLOCKING),
            Reservation.arrival < departure,
            Reservation.departure > arrival,
        )
        .order_by(Reservation.arrival)
        .limit(1)
    )
    reason = hard_reason(slot, vehicle, accessible, charging)
    status = slot.state
    if reservation and slot.state == "AVAILABLE":
        status = "OCCUPIED" if reservation.status == "ACTIVE" else "RESERVED"
        reason = "Reserved during the selected interval"
    if not db.get(Facility, slot.facility_id).active:
        reason, status = "Facility is inactive", "INACTIVE"
    return {
        **row_data(slot),
        "availability": status,
        "eligible": not reason,
        "unavailable_reason": reason,
        "zone_name": db.get(Zone, slot.zone_id).name,
    }


def ensure_operator(db, operator_id, admin_id):
    if operator_id:
        operator = db.get(User, operator_id)
        if not operator or not operator.active or operator.role != "OPERATOR" or operator.admin_id != admin_id:
            raise HTTPException(422, "Assign an active operator belonging to this administrator.")
