from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.security import current_user, roles
from app.db import get_db
from app.models import Facility, Notification, Reservation, Slot, StatusHistory, User, Vehicle, Zone, now
from app.schemas import (
    BookingInput,
    FacilityInput,
    SlotInput,
    SlotUpdate,
    StatusUpdate,
    VehicleInput,
    ZoneInput,
)
from app.services import (
    BLOCKING,
    audit,
    change_status,
    ensure_operator,
    estimate_cost,
    facility_scope,
    get_reservation,
    make_reservation,
    managed_facility,
    notify,
    owned_vehicle,
    page_response,
    paginate,
    rank_candidates,
    reservation_data,
    reservation_query,
    row_data,
    slot_data,
    validate_booking,
)

router = APIRouter(tags=["Parking"])
customer = roles("CUSTOMER")
staff = roles("OPERATOR", "ADMIN", "SUPER_ADMIN")
admin = roles("ADMIN", "SUPER_ADMIN")


@router.get("/vehicles")
def vehicles(user: User = Depends(customer), db: Session = Depends(get_db, scope="function")):
    return [
        row_data(v)
        for v in db.scalars(
            select(Vehicle)
            .where(Vehicle.user_id == user.id, Vehicle.active.is_(True))
            .order_by(Vehicle.created_at)
        )
    ]


@router.post("/vehicles", status_code=201)
def add_vehicle(
    data: VehicleInput, user: User = Depends(customer), db: Session = Depends(get_db, scope="function")
):
    vehicle = Vehicle(**data.model_dump(), user_id=user.id)
    db.add(vehicle)
    db.flush()
    audit(db, user, "vehicle.created", vehicle.id)
    return row_data(vehicle)


@router.put("/vehicles/{vehicle_id}")
def update_vehicle(
    vehicle_id: str,
    data: VehicleInput,
    user: User = Depends(customer),
    db: Session = Depends(get_db, scope="function"),
):
    vehicle = owned_vehicle(db, vehicle_id, user, lock=True)
    if db.scalar(
        select(Reservation.id)
        .where(
            Reservation.vehicle_id == vehicle_id,
            Reservation.status.in_(BLOCKING),
            Reservation.departure > now(),
        )
        .limit(1)
    ):
        raise HTTPException(409, "Complete or cancel this vehicle's upcoming bookings before editing it.")
    for key, value in data.model_dump().items():
        setattr(vehicle, key, value)
    audit(db, user, "vehicle.updated", vehicle.id)
    return row_data(vehicle)


@router.delete("/vehicles/{vehicle_id}")
def remove_vehicle(
    vehicle_id: str, user: User = Depends(customer), db: Session = Depends(get_db, scope="function")
):
    vehicle = owned_vehicle(db, vehicle_id, user, lock=True)
    if db.scalar(
        select(Reservation.id)
        .where(
            Reservation.vehicle_id == vehicle_id,
            Reservation.status.in_(BLOCKING),
            Reservation.departure > now(),
        )
        .limit(1)
    ):
        raise HTTPException(409, "Complete or cancel this vehicle's upcoming bookings before removing it.")
    vehicle.active = False
    audit(db, user, "vehicle.deactivated", vehicle.id)
    return {"message": "Vehicle removed. Its booking history is preserved."}


def facility_data(db, facility, management=False):
    slots = select(Slot.id).where(Slot.facility_id == facility.id)
    total = db.scalar(select(func.count()).select_from(slots.subquery()))
    busy = select(Reservation.slot_id).where(
        Reservation.facility_id == facility.id,
        Reservation.status.in_(BLOCKING),
        Reservation.arrival <= now(),
        Reservation.departure > now(),
    )
    available = (
        db.scalar(
            select(func.count())
            .select_from(Slot)
            .where(Slot.facility_id == facility.id, Slot.state == "AVAILABLE", Slot.id.not_in(busy))
        )
        if facility.active
        else 0
    )
    return {
        **row_data(facility, () if management else ("operator_id", "admin_id")),
        "total_slots": total,
        "available_slots": available,
        "zones": [
            row_data(z)
            for z in db.scalars(select(Zone).where(Zone.facility_id == facility.id).order_by(Zone.name))
        ],
    }


@router.get("/facilities")
def facilities(
    q: str = Query("", max_length=100),
    available_only: bool = False,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db, scope="function"),
):
    query = select(Facility).where(Facility.active.is_(True))
    if q:
        query = query.where(
            Facility.name.ilike(f"%{q}%") | Facility.city.ilike(f"%{q}%") | Facility.address.ilike(f"%{q}%")
        )
    if available_only:
        busy = select(Reservation.slot_id).where(
            Reservation.status.in_(BLOCKING), Reservation.arrival <= now(), Reservation.departure > now()
        )
        query = query.where(
            Facility.id.in_(select(Slot.facility_id).where(Slot.state == "AVAILABLE", Slot.id.not_in(busy)))
        )
    items, total = paginate(db, query.order_by(Facility.name), page, page_size)
    return page_response([facility_data(db, f) for f in items], total, page, page_size)


@router.get("/facilities/{facility_id}")
def facility(facility_id: str, db: Session = Depends(get_db, scope="function")):
    item = db.get(Facility, facility_id)
    if not item or not item.active:
        raise HTTPException(404, "Facility not found.")
    return facility_data(db, item)


@router.get("/management/facilities")
def managed_facilities(
    user: User = Depends(staff),
    db: Session = Depends(get_db, scope="function"),
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=100),
):
    items, total = paginate(
        db, facility_scope(select(Facility), user, Facility.id).order_by(Facility.name), page, page_size
    )
    return page_response([facility_data(db, f, True) for f in items], total, page, page_size)


@router.post("/facilities", status_code=201)
def add_facility(
    data: FacilityInput, user: User = Depends(admin), db: Session = Depends(get_db, scope="function")
):
    owner_id = user.id if user.role == "ADMIN" else data.admin_id
    if data.admin_id and data.admin_id != owner_id:
        raise HTTPException(403, "You can create facilities only in your own workspace.")
    owner = db.get(User, owner_id) if owner_id else None
    if not owner or owner.role != "ADMIN" or not owner.active:
        raise HTTPException(422, "Choose an active administrator to own this facility.")
    ensure_operator(db, data.operator_id, owner_id)
    facility = Facility(**data.model_dump(exclude={"admin_id"}), admin_id=owner_id)
    db.add(facility)
    db.flush()
    db.add(Zone(facility_id=facility.id, name="Zone A"))
    audit(db, user, "facility.created", facility.id)
    db.flush()
    return facility_data(db, facility, True)


@router.put("/facilities/{facility_id}")
def edit_facility(
    facility_id: str,
    data: FacilityInput,
    user: User = Depends(admin),
    db: Session = Depends(get_db, scope="function"),
):
    facility = managed_facility(db, facility_id, user, lock=True)
    if data.admin_id is not None and data.admin_id != facility.admin_id:
        raise HTTPException(422, "Facility ownership cannot be transferred through this form.")
    ensure_operator(db, data.operator_id, facility.admin_id)
    if not data.active and db.scalar(
        select(Reservation.id)
        .where(
            Reservation.facility_id == facility_id,
            Reservation.status.in_(BLOCKING),
            Reservation.departure > now(),
        )
        .limit(1)
    ):
        raise HTTPException(
            409, "This facility has active or upcoming bookings. Resolve them before deactivating it."
        )
    for key, value in data.model_dump(exclude={"admin_id"}).items():
        setattr(facility, key, value)
    audit(db, user, "facility.updated", facility.id, active=facility.active)
    return facility_data(db, facility, True)


@router.post("/facilities/{facility_id}/zones", status_code=201)
def add_zone(
    facility_id: str,
    data: ZoneInput,
    user: User = Depends(admin),
    db: Session = Depends(get_db, scope="function"),
):
    managed_facility(db, facility_id, user, lock=True)
    zone = Zone(facility_id=facility_id, **data.model_dump())
    db.add(zone)
    db.flush()
    audit(db, user, "zone.created", zone.id)
    return row_data(zone)


@router.get("/slots")
def slots(
    facility_id: str,
    arrival: datetime | None = None,
    departure: datetime | None = None,
    vehicle_id: str | None = None,
    zone_id: str | None = None,
    q: str = Query("", max_length=30),
    vehicle_type: str | None = None,
    accessible: bool = False,
    charging: bool = False,
    available_only: bool = False,
    state: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=200),
    user: User = Depends(current_user),
    db: Session = Depends(get_db, scope="function"),
):
    managed_facility(db, facility_id, user)
    arrival, departure = arrival or now(), departure or (arrival or now()) + timedelta(hours=1)
    if not arrival.tzinfo or not departure.tzinfo or arrival >= departure:
        raise HTTPException(422, "Choose a valid timezone-aware time interval.")
    vehicle = owned_vehicle(db, vehicle_id, user) if vehicle_id else None
    query = select(Slot).where(Slot.facility_id == facility_id)
    if q:
        query = query.where(Slot.label.ilike(f"%{q}%"))
    if zone_id:
        query = query.where(Slot.zone_id == zone_id)
    if vehicle_type:
        query = query.where(Slot.vehicle_type == vehicle_type)
    if state:
        query = query.where(Slot.state == state)
    if accessible:
        query = query.where(Slot.accessible.is_(True))
    if charging:
        query = query.where(Slot.charging.is_(True))
    if available_only:
        conflicts = select(Reservation.slot_id).where(
            Reservation.status.in_(BLOCKING), Reservation.arrival < departure, Reservation.departure > arrival
        )
        query = query.where(Slot.state == "AVAILABLE", Slot.id.not_in(conflicts))
    items, total = paginate(db, query.order_by(Slot.position, Slot.label), page, page_size)
    return page_response(
        [slot_data(db, s, arrival, departure, vehicle, accessible, charging) for s in items],
        total,
        page,
        page_size,
    )


@router.post("/slots", status_code=201)
def add_slot(data: SlotInput, user: User = Depends(admin), db: Session = Depends(get_db, scope="function")):
    managed_facility(db, data.facility_id, user, lock=True)
    zone = db.get(Zone, data.zone_id)
    if not zone or zone.facility_id != data.facility_id:
        raise HTTPException(422, "Choose a zone in this facility.")
    slot = Slot(**data.model_dump())
    db.add(slot)
    db.flush()
    audit(db, user, "slot.created", slot.id)
    return row_data(slot)


@router.patch("/slots/{slot_id}")
def update_slot(
    slot_id: str,
    data: SlotUpdate,
    user: User = Depends(staff),
    db: Session = Depends(get_db, scope="function"),
):
    slot = db.get(Slot, slot_id)
    if not slot:
        raise HTTPException(404, "Slot not found.")
    facility = managed_facility(db, slot.facility_id, user, lock=True)
    db.refresh(slot, with_for_update=True)
    changes = data.model_dump(exclude_unset=True)
    if user.role == "OPERATOR" and (set(changes) - {"state"} or changes.get("state") == "INACTIVE"):
        raise HTTPException(403, "Operators may set or restore maintenance status only.")
    if changes and db.scalar(
        select(Reservation.id)
        .where(
            Reservation.slot_id == slot_id, Reservation.status.in_(BLOCKING), Reservation.departure > now()
        )
        .limit(1)
    ):
        raise HTTPException(
            409, "This space has active or upcoming bookings. Resolve them before changing it."
        )
    for key, value in changes.items():
        setattr(slot, key, value)
    audit(db, user, "slot.updated", slot.id, changes=changes)
    if facility.operator_id:
        notify(
            db,
            facility.operator_id,
            "Parking inventory updated",
            f"{facility.name} · {slot.label}: {slot.state.lower()}.",
        )
    return row_data(slot)


@router.post("/allocation/recommend")
def recommend(
    data: BookingInput, user: User = Depends(customer), db: Session = Depends(get_db, scope="function")
):
    facility, vehicle, config = validate_booking(db, data, user)
    candidates = rank_candidates(db, data, vehicle, config)
    if not candidates:
        raise HTTPException(409, "No eligible spaces match this request. Try another time or facility.")
    return {
        "recommendation": candidates[0],
        "alternatives": candidates[1:5],
        "eligible_count": len(candidates),
        "estimated_cost": estimate_cost(facility.hourly_rate, data.arrival, data.departure),
        "message": "Availability is checked again when you confirm your reservation.",
    }


@router.post("/reservations", status_code=201)
def reserve(
    data: BookingInput, user: User = Depends(customer), db: Session = Depends(get_db, scope="function")
):
    return make_reservation(db, data, user)


@router.get("/reservations")
def reservations(
    status: str | None = None,
    facility_id: str | None = None,
    history: bool = False,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: User = Depends(current_user),
    db: Session = Depends(get_db, scope="function"),
):
    query = reservation_query(user)
    if status:
        query = query.where(Reservation.status == status)
    if facility_id:
        query = query.where(Reservation.facility_id == facility_id)
    if history:
        query = query.where(
            (Reservation.departure < now()) | Reservation.status.in_(("CANCELLED", "COMPLETED", "NO_SHOW"))
        )
    items, total = paginate(db, query.order_by(Reservation.created_at.desc()), page, page_size)
    return page_response([reservation_data(db, r) for r in items], total, page, page_size)


@router.get("/reservations/{reservation_id}")
def reservation(
    reservation_id: str, user: User = Depends(current_user), db: Session = Depends(get_db, scope="function")
):
    item = get_reservation(db, reservation_id, user)
    return {
        **reservation_data(db, item),
        "history": [
            row_data(h, ("actor_id",))
            for h in db.scalars(
                select(StatusHistory)
                .where(StatusHistory.reservation_id == item.id)
                .order_by(StatusHistory.created_at)
            )
        ],
    }


@router.post("/reservations/{reservation_id}/cancel")
def cancel(
    reservation_id: str, user: User = Depends(current_user), db: Session = Depends(get_db, scope="function")
):
    return change_status(db, reservation_id, "CANCELLED", user)


@router.patch("/reservations/{reservation_id}/status")
def status(
    reservation_id: str,
    data: StatusUpdate,
    user: User = Depends(staff),
    db: Session = Depends(get_db, scope="function"),
):
    return change_status(db, reservation_id, data.status, user)


@router.get("/notifications")
def notifications(
    unread: bool = False,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: User = Depends(current_user),
    db: Session = Depends(get_db, scope="function"),
):
    query = select(Notification).where(Notification.user_id == user.id)
    unread_count = db.scalar(
        select(func.count())
        .select_from(Notification)
        .where(Notification.user_id == user.id, Notification.read.is_(False))
    )
    if unread:
        query = query.where(Notification.read.is_(False))
    items, total = paginate(db, query.order_by(Notification.created_at.desc()), page, page_size)
    return {
        **page_response([row_data(n) for n in items], total, page, page_size),
        "unread_count": unread_count,
    }


@router.post("/notifications/{notification_id}/read")
def read_notification(
    notification_id: str, user: User = Depends(current_user), db: Session = Depends(get_db, scope="function")
):
    item = db.scalar(
        select(Notification).where(Notification.id == notification_id, Notification.user_id == user.id)
    )
    if not item:
        raise HTTPException(404, "Notification not found.")
    item.read = True
    return row_data(item)
