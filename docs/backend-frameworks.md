# Backend framework choices

FastAPI provides typed HTTP request validation, dependency-based authorization, and OpenAPI. SQLAlchemy 2 provides explicit transactional sessions and SQL aggregation; PostgreSQL provides referential integrity and interval exclusion constraints. Alembic owns schema revisions. Argon2 hashes passwords. Pytest exercises the API against a real isolated PostgreSQL database.

This implementation uses synchronous SQLAlchemy operations in FastAPI sync handlers, which run in the framework's thread pool. No additional backend framework or database is needed for the implemented workflows.
