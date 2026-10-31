from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import delete, func, select, text
from sqlalchemy.orm import Session

from app.core.security import roles, user_data
from app.db import get_db
from app.models import AuditLog, AuthSession, Facility, User
from app.schemas import Register, SettingsInput, UserUpdate
from app.core.security import hasher
from app.services import audit, get_settings, page_response, paginate, row_data

router = APIRouter(prefix="/admin", tags=["Administration"], dependencies=[Depends(roles("ADMIN", "SUPER_ADMIN"))])


@router.get("/users")
def users(
    q: str = Query("", max_length=100),
    role: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: User = Depends(roles("ADMIN", "SUPER_ADMIN")),
    db: Session = Depends(get_db, scope="function"),
):
    query = select(User)
    if user.role == "ADMIN":
        query = query.where(User.role == "OPERATOR", User.admin_id == user.id)
    if q:
        query = query.where(User.name.ilike(f"%{q}%") | User.email.ilike(f"%{q}%"))
    if role:
        query = query.where(User.role == role)
    items, total = paginate(db, query.order_by(User.created_at.desc()), page, page_size)
    return page_response([user_data(u) for u in items], total, page, page_size)


@router.patch("/users/{user_id}")
def update_user(
    user_id: str,
    data: UserUpdate,
    user: User = Depends(roles("ADMIN", "SUPER_ADMIN")),
    db: Session = Depends(get_db, scope="function"),
):
    # Serialize the last-admin invariant across all administrator updates.
    db.execute(text("SELECT pg_advisory_xact_lock(7070777)"))
    target = db.scalar(select(User).where(User.id == user_id).with_for_update())
    if not target or (user.role == "ADMIN" and (target.role != "OPERATOR" or target.admin_id != user.id)):
        raise HTTPException(404, "Account not found.")
    role = data.role if data.role is not None else target.role
    active = data.active if data.active is not None else target.active
    if target.role == "SUPER_ADMIN" and target.active and (role != "SUPER_ADMIN" or not active):
        remaining = db.scalar(
            select(func.count())
            .select_from(User)
            .where(User.role == "SUPER_ADMIN", User.active.is_(True), User.id != target.id)
        )
        if not remaining:
            raise HTTPException(409, "The last active administrator cannot be disabled or demoted.")
    if role != target.role:
        raise HTTPException(403, "Account roles are fixed. Create an administrator or operator through its dedicated form.")
    if target.role == "OPERATOR" and (role != "OPERATOR" or not active):
        if db.scalar(select(Facility.id).where(Facility.operator_id == target.id).limit(1)):
            raise HTTPException(409, "Reassign this operator's facilities before changing their access.")
    target.role, target.active = role, active
    db.execute(delete(AuthSession).where(AuthSession.user_id == target.id))
    if target.role == "ADMIN" and not active:
        db.execute(delete(AuthSession).where(AuthSession.user_id.in_(select(User.id).where(User.admin_id == target.id))))
    audit(db, user, "account.access_updated", target.id, role=role, active=active)
    return user_data(target)


@router.get("/roles")
def role_definitions():
    return [
        {
            "role": "CUSTOMER",
            "permissions": [
                "Manage own vehicles",
                "Reserve compatible spaces",
                "View and cancel own bookings",
                "Read own notifications",
            ],
        },
        {
            "role": "OPERATOR",
            "permissions": [
                "View assigned facilities",
                "Maintain assigned slot inventory",
                "Check vehicles in and out",
                "View and export assigned-facility reports",
            ],
        },
        {
            "role": "ADMIN",
            "permissions": [
                "Create and manage own operators",
                "Manage own facilities, zones and slots",
                "Assign only own operators",
                "View own facility bookings and reports",
                "View own staff audit logs; no customer account directory",
            ],
        },
        {"role": "SUPER_ADMIN", "permissions": ["Create and manage administrators", "Oversee all workspaces", "Configure platform booking rules"]},
    ]


@router.get("/audit-logs")
def logs(
    q: str = Query("", max_length=100),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: User = Depends(roles("ADMIN", "SUPER_ADMIN")),
    db: Session = Depends(get_db, scope="function"),
):
    query = select(AuditLog)
    if user.role == "ADMIN":
        query = query.where(AuditLog.actor_id.in_(select(User.id).where((User.id == user.id) | ((User.role == "OPERATOR") & (User.admin_id == user.id)))))
    if q:
        query = query.where(AuditLog.action.ilike(f"%{q}%"))
    items, total = paginate(db, query.order_by(AuditLog.created_at.desc()), page, page_size)
    return page_response([row_data(a) for a in items], total, page, page_size)


@router.get("/settings")
def system_settings(user: User = Depends(roles("SUPER_ADMIN")), db: Session = Depends(get_db, scope="function")):
    return row_data(get_settings(db))


@router.put("/settings")
def update_settings(
    data: SettingsInput, user: User = Depends(roles("SUPER_ADMIN")), db: Session = Depends(get_db, scope="function")
):
    config = get_settings(db)
    weights = data.weights.model_dump()
    total = sum(weights.values())
    config.weights = {key: value * 100 / total for key, value in weights.items()}
    config.cancellation_minutes = data.cancellation_minutes
    config.max_booking_hours = data.max_booking_hours
    audit(
        db,
        user,
        "settings.updated",
        weights=config.weights,
        cancellation_minutes=config.cancellation_minutes,
        max_booking_hours=config.max_booking_hours,
    )
    return row_data(config)


@router.post("/operators", status_code=201)
def create_operator(
    data: Register, user: User = Depends(roles("ADMIN")), db: Session = Depends(get_db, scope="function")
):
    if db.scalar(select(User.id).where(User.email == str(data.email).lower())):
        raise HTTPException(409, "An account with this email already exists.")
    operator = User(
        name=data.name,
        email=str(data.email).lower(),
        password_hash=hasher.hash(data.password),
        role="OPERATOR",
        admin_id=user.id,
    )
    db.add(operator)
    db.flush()
    audit(db, user, "account.operator_created", operator.id)
    return user_data(operator)


@router.post("/administrators", status_code=201)
def create_administrator(
    data: Register, user: User = Depends(roles("SUPER_ADMIN")), db: Session = Depends(get_db, scope="function")
):
    if db.scalar(select(User.id).where(User.email == str(data.email).lower())):
        raise HTTPException(409, "An account with this email already exists.")
    administrator = User(name=data.name, email=str(data.email).lower(), password_hash=hasher.hash(data.password), role="ADMIN")
    db.add(administrator)
    db.flush()
    audit(db, user, "account.administrator_created", administrator.id)
    return user_data(administrator)
