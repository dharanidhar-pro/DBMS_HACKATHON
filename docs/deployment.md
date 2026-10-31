# Deployment

Use the frontend and backend Dockerfiles with `compose.yaml`. PostgreSQL is internal-only. Migrations complete before the backend starts; frontend startup waits for database readiness. Both application images use non-root runtime users. PostgreSQL data uses a named volume.

Set a unique URL-safe POSTGRES_PASSWORD, APP_ENV=production, COOKIE_SECURE=true, and an exact HTTPS ALLOWED_ORIGINS list. Place the frontend behind a trusted HTTPS reverse proxy. Do not expose database credentials or the database port. Restrict API documentation at the edge if required. Use separate credentials for deployment migrations and runtime least-privilege database access in a managed production environment.

Bootstrap the first administrator using `python -m app.bootstrap` in a trusted deployment shell. Create operators through the authenticated admin UI. Add real facilities and assign operators. Do not load demo accounts into production.

GitHub Actions runs backend tests/lint, frontend tests/build, and Chromium E2E using isolated databases. It does not automatically publish or deploy the app. Configure deployment-specific secrets and release approval according to the hosting organization.

Docker execution and public hosting have not been verified in the current environment because Docker is not installed. The locally running Windows/PostgreSQL application is separately tested. Configure backups and test restore, monitoring, HTTPS, real support contacts, and retention before public use.
