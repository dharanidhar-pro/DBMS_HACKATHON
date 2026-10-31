from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.security import (
    clear_cookies,
    current_user,
    dummy_hash,
    hasher,
    issue_session,
    throttle,
    user_data,
    verify,
)
from app.db import get_db
from app.models import AuthSession, User
from app.schemas import Login, PasswordUpdate, ProfileUpdate, Register
from app.services import audit

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", status_code=201)
def register(
    data: Register, request: Request, response: Response, db: Session = Depends(get_db, scope="function")
):
    throttle(db, request, str(data.email))
    if db.scalar(select(User.id).where(User.email == str(data.email).lower())):
        raise HTTPException(409, "An account with this email already exists. Please sign in.")
    user = User(
        name=data.name,
        email=str(data.email).lower(),
        password_hash=hasher.hash(data.password),
        role="CUSTOMER",
    )
    db.add(user)
    db.flush()
    clear_cookies(response)
    audit(db, user, "account.registered", user.id)
    return user_data(user)


@router.post("/login/{portal}")
def login(
    portal: str,
    data: Login,
    request: Request,
    response: Response,
    db: Session = Depends(get_db, scope="function"),
):
    if portal not in ("customer", "operator", "admin"):
        raise HTTPException(404, "Portal not found.")
    throttle(db, request, str(data.email))
    user = db.scalar(select(User).where(User.email == str(data.email).lower()))
    valid = verify(data.password, user.password_hash if user else dummy_hash)
    if not valid or not user or not user.active or user.role not in (("ADMIN", "SUPER_ADMIN") if portal == "admin" else (portal.upper(),)):
        audit(db, None, "auth.failed")
        db.commit()
        raise HTTPException(401, "Email or password is incorrect for this portal.")
    if hasher.check_needs_rehash(user.password_hash):
        user.password_hash = hasher.hash(data.password)
    issue_session(db, user, response)
    audit(db, user, "auth.signed_in", user.id)
    return user_data(user)


@router.get("/me")
def me(user: User = Depends(current_user)):
    return user_data(user)


@router.patch("/me")
def update_profile(
    data: ProfileUpdate, user: User = Depends(current_user), db: Session = Depends(get_db, scope="function")
):
    user.name = data.name
    audit(db, user, "account.profile_updated", user.id)
    return user_data(user)


@router.post("/password")
def password(
    data: PasswordUpdate,
    response: Response,
    user: User = Depends(current_user),
    db: Session = Depends(get_db, scope="function"),
):
    if not verify(data.current_password, user.password_hash):
        raise HTTPException(400, "Current password is incorrect.")
    user.password_hash = hasher.hash(data.new_password)
    db.execute(delete(AuthSession).where(AuthSession.user_id == user.id))
    issue_session(db, user, response)
    audit(db, user, "account.password_changed", user.id)
    return {"message": "Password updated. Other sessions have been signed out."}


@router.post("/logout")
def logout(
    request: Request,
    response: Response,
    user: User = Depends(current_user),
    db: Session = Depends(get_db, scope="function"),
):
    db.delete(request.state.auth_session)
    clear_cookies(response)
    audit(db, user, "auth.signed_out", user.id)
    return {"message": "Signed out."}
