import hashlib
import secrets
from datetime import timedelta

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError
from fastapi import Depends, HTTPException, Request, Response
from sqlalchemy import delete, func, select, text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db import get_db
from app.models import AuthAttempt, AuthSession, User, now

hasher = PasswordHasher()
dummy_hash = hasher.hash(secrets.token_urlsafe(24))
COOKIE = "parkly_session"


def digest(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


def verify(password, hashed):
    try:
        return hasher.verify(hashed, password)
    except (VerificationError, InvalidHashError):
        return False


def user_data(user):
    return {key: getattr(user, key) for key in ("id", "name", "email", "role", "active", "created_at", "admin_id")}


def issue_session(db: Session, user: User, response: Response):
    token, csrf = secrets.token_urlsafe(48), secrets.token_urlsafe(32)
    duration = settings.session_hours * 3600
    db.add(
        AuthSession(
            user_id=user.id,
            token_hash=digest(token),
            csrf_hash=digest(csrf),
            expires_at=now() + timedelta(seconds=duration),
        )
    )
    db.execute(delete(AuthSession).where(AuthSession.expires_at < now()))
    for key, value, httponly in [(COOKIE, token, True), ("parkly_csrf", csrf, False)]:
        response.set_cookie(
            key,
            value,
            httponly=httponly,
            secure=settings.cookie_secure,
            samesite="lax",
            max_age=duration,
            path="/",
        )


def clear_cookies(response):
    response.delete_cookie(COOKIE, path="/", secure=settings.cookie_secure, httponly=True, samesite="lax")
    response.delete_cookie("parkly_csrf", path="/", secure=settings.cookie_secure, samesite="lax")


def current_user(request: Request, db: Session = Depends(get_db, scope="function")) -> User:
    token = request.cookies.get(COOKIE, "")
    session = (
        db.scalar(
            select(AuthSession).where(AuthSession.token_hash == digest(token), AuthSession.expires_at > now())
        )
        if token
        else None
    )
    if not session:
        raise HTTPException(401, "Your session has expired. Please sign in.")
    user = db.get(User, session.user_id)
    if not user or not user.active:
        raise HTTPException(401, "This account is unavailable. Please contact your administrator.")
    if user.role == "OPERATOR":
        owner = db.get(User, user.admin_id) if user.admin_id else None
        if not owner or not owner.active or owner.role != "ADMIN":
            raise HTTPException(403, "Your administrator account is unavailable.")
    if request.method not in ("GET", "HEAD", "OPTIONS"):
        csrf = request.headers.get("X-CSRF-Token", "")
        if not csrf or not secrets.compare_digest(digest(csrf), session.csrf_hash):
            raise HTTPException(403, "Security verification failed. Refresh this page and try again.")
    request.state.auth_session = session
    return user


def roles(*allowed):
    def dependency(user: User = Depends(current_user)):
        if user.role not in allowed:
            raise HTTPException(403, "Your account does not have access to this action.")
        return user

    return dependency


def throttle(db, request, email):
    # Shared across API workers. Never trust an arbitrary X-Forwarded-For header.
    ip = request.client.host if request.client else "unknown"
    keys = [(digest(f"ip:{ip}"), 100), (digest(f"login:{ip}:{email.lower()}"), 10)]
    cutoff = now() - timedelta(minutes=15)
    for key, limit in sorted(keys):
        db.execute(text("SELECT pg_advisory_xact_lock(:key)"), {"key": int(key[:15], 16)})
        count = db.scalar(
            select(func.count())
            .select_from(AuthAttempt)
            .where(AuthAttempt.key == key, AuthAttempt.created_at > cutoff)
        )
        if count >= limit:
            db.commit()
            raise HTTPException(
                429, "Too many sign-in attempts. Try again in 15 minutes.", headers={"Retry-After": "900"}
            )
        db.add(AuthAttempt(key=key))
    db.execute(delete(AuthAttempt).where(AuthAttempt.created_at < cutoff))
    db.commit()  # Failed credentials must not roll back their rate-limit record.
