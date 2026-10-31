import logging
import secrets

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError, OperationalError

from app.api import admin, analytics, auth, parking
from app.core.config import settings
from app.db import engine

logger = logging.getLogger("parkly")
app = FastAPI(
    title="PARKLY API",
    version="1.0.0",
    description="Parking discovery, secure portals, and transactional intelligent allocation.",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "X-CSRF-Token", "X-Parkly-Request"],
)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    if request.method not in ("GET", "HEAD", "OPTIONS"):
        origin = request.headers.get("origin")
        if (origin and origin.rstrip("/") not in settings.origins) or request.headers.get(
            "X-Parkly-Request"
        ) != "1":
            return JSONResponse({"detail": "Request origin could not be verified."}, status_code=403)
    request_id = secrets.token_hex(8)
    response = await call_next(request)
    response.headers.update(
        {
            "X-Content-Type-Options": "nosniff",
            "X-Frame-Options": "DENY",
            "Referrer-Policy": "strict-origin-when-cross-origin",
            "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
            "X-Request-ID": request_id,
            "Cache-Control": "no-store",
        }
    )
    if settings.app_env == "production":
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response


@app.exception_handler(IntegrityError)
async def integrity_error(request, error):
    constraint = getattr(getattr(error.orig, "diag", None), "constraint_name", "") or ""
    if "no_overlap" in constraint:
        message = "This space or vehicle was just reserved for that time. Refresh availability and try again."
    elif "registration" in constraint:
        message = "This vehicle registration is already registered. Contact support if it belongs to you."
    elif "email" in constraint:
        message = "An account with this email already exists. Please sign in."
    else:
        message = "This change conflicts with an existing record. Check the details and try again."
    return JSONResponse({"detail": message}, status_code=409)


@app.exception_handler(OperationalError)
async def unavailable(request, error):
    logger.error("database_unavailable path=%s", request.url.path)
    return JSONResponse(
        {"detail": "The parking service is temporarily unavailable. Please try again shortly."},
        status_code=503,
    )


@app.exception_handler(Exception)
async def unexpected(request, error):
    logger.error("unhandled_error path=%s type=%s", request.url.path, type(error).__name__)
    return JSONResponse({"detail": "Something went wrong. Please try again."}, status_code=500)


@app.get("/health", tags=["Health"])
def health():
    return {"status": "ok"}


@app.get("/ready", tags=["Health"])
def ready():
    with engine.connect() as connection:
        connection.execute(text("SELECT id FROM system_settings WHERE id = 1"))
    return {"status": "ready", "database": "postgresql"}


for router in (auth.router, parking.router, admin.router, analytics.router):
    app.include_router(router, prefix="/api/v1")
