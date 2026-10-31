from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str
    app_env: str = "development"
    cookie_secure: bool = False
    allowed_origins: str = "http://localhost:5173,http://127.0.0.1:5173,http://localhost:8080"
    session_hours: int = 8
    model_config = SettingsConfigDict(env_file=Path(__file__).resolve().parents[3] / ".env", extra="ignore")

    @property
    def origins(self) -> list[str]:
        return [origin.strip().rstrip("/") for origin in self.allowed_origins.split(",")]


settings = Settings()
if settings.app_env == "production" and not settings.cookie_secure:
    raise RuntimeError("Production requires COOKIE_SECURE=true and HTTPS.")
if not settings.database_url.startswith("postgresql+psycopg://"):
    raise RuntimeError("PARKLY requires PostgreSQL with the psycopg driver.")
