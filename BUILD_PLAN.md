# PARKLY build plan

## Inspection
- Cloned the supplied repository into the empty workspace. Initial HEAD: `23b353b67d6a01eed74f376c43171fe9414f2fea`.
- The repository contains only `README.md`; no application, dependencies, endpoints, or existing user modifications.
- Available: Git, Node 25, Python 3.14, PostgreSQL 18 binaries. Docker CLI is not installed.

## Architecture and decisions
- React + TypeScript + Vite, Tailwind tokens, React Router, TanStack Query, React Hook Form/Zod, Lucide, Motion, and Recharts.
- FastAPI/Pydantic request boundary; SQLAlchemy services; Alembic migrations; PostgreSQL is the only application database.
- Same-origin frontend/API proxy. Random opaque session tokens in HttpOnly cookies, stored hashed in PostgreSQL; CSRF tokens, origin checking, Argon2 passwords, database-backed authentication throttling, and server-enforced role/ownership checks.
- PostgreSQL exclusion constraints on `[arrival, departure)` for both slots and vehicles. Slot/facility/vehicle locks coordinate reservations with inventory changes; allocation and history commit atomically.
- Explainable weighted allocation filters hard requirements first. Monetary estimates use integer paise. Times are timezone-aware and stored in UTC.
- Three token-driven themes; custom SVG parking illustration; operational lot visualization uses API data and 30-second polling.
- Seeded facilities are explicitly labelled demonstration inventory. No fabricated bookings or analytics and no payment/email/GPS claims.
- Sites hosting uses Workers and cannot run the required FastAPI/PostgreSQL services. Deliver the requested stack locally and with Docker/CI deployment preparation.

## Implementation phases
1. Foundation: dependency manifests, environment, relational models, Alembic migration, isolated local PostgreSQL.
2. Security: registration, role-specific login, sessions, CSRF, authorization, privileged-account setup CLI.
3. Business services: vehicles, facilities/zones/slots, ranking, reservation lifecycle, notifications, audit, settings, SQL analytics and CSV.
4. UI: design system, landing, portal selection and separate login layouts, customer booking and account workflows.
5. Operations: scoped operator workspace and administrative management, charts and reports.
6. Verification: PostgreSQL integration and concurrency tests, component tests, browser E2E, responsive and theme inspection, production build.
7. Delivery: Docker Compose, CI, run scripts, architecture/security/database/API/deployment/testing documentation and acceptance results.

Verification outcomes and environment limits are recorded in `docs/testing.md` as checks run.

## Implemented and verified
- Full-stack application, isolated PostgreSQL migrations, demo inventory, three role workspaces, real booking and management workflows, Docker/CI preparation, and technical documentation are in place.
- Follow-up flow repair: direct customer sign-in, registration followed by login, hidden public admin access, shared authorized Back navigation, guest guards, scrollable sidebar, and protected workspace indexes.
- Added repeatable development account seeding with ignored random passwords, one-time administrator bootstrap, and an administrator-only operator creation form/API.
- Verification: 40 backend tests, 18 frontend tests, four isolated Chromium journeys, and actual seeded-account browser checks passed. Ruff and frontend production build passed.
- Docker runtime and public deployment remain unverified; no external payment, mail, SMS, or GPS provider is configured.
