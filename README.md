# PARKLY

Find your space. Move smarter.

React/TypeScript parking application with FastAPI, SQLAlchemy, Alembic, and PostgreSQL. Includes customer vehicle management, explainable allocation, conflict-safe reservations, notifications, assigned-facility operations, administrative management, audit logs, analytics, and three themes.

## Run on this Windows workspace

Prerequisites: Python 3.14, Node 24 or newer, PostgreSQL 18. Run from the repository root:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend\requirements.lock.txt
cd frontend
npm.cmd ci
cd ..
powershell -ExecutionPolicy Bypass -File scripts\init-local.ps1
powershell -ExecutionPolicy Bypass -File scripts\start.ps1 -SeedDemo
```

Open http://127.0.0.1:5173. The local PostgreSQL instance uses port 55432 and `.local/pgdata`, independently of existing PostgreSQL services. Its random credentials are stored in git-ignored `.env`. Stop app services with `scripts/stop.ps1`; add `-Database` to stop this isolated database while preserving its data.

## Development accounts

From the root, run:

```powershell
cd backend
..\.venv\Scripts\python.exe -m app.dev_accounts
cd ..
Get-Content .local\DEMO_ACCOUNTS.md
```

This actually creates `customer@parkly.demo`, `operator@parkly.demo`, and `admin@parkly.demo` with hashed, randomly generated passwords. It assigns unassigned demonstration facilities to the demo operator. Repeating the command preserves accounts and passwords. Passwords are in **`.local/DEMO_ACCOUNTS.md`**, which Git ignores. Optionally set `DEMO_CUSTOMER_PASSWORD`, `DEMO_OPERATOR_PASSWORD`, and `DEMO_ADMIN_PASSWORD` before the first run. Existing accounts with conflicting credentials or roles are rejected instead of overwritten.

This seed refuses to run outside `APP_ENV=development`. Never seed demonstration accounts into a production database, and do not copy `.local` into a deployment.

Customer login: `/login/customer`. Operator login: `/login/operator` (linked from customer login). Administrator login: **`/login/admin`**, entered directly and never advertised in public navigation. `/access` is an optional customer/operator selector.

Registration creates a CUSTOMER account, then returns to customer login. It does not automatically authenticate. Logged-in users visiting login/registration return to their authorized dashboard.

## Provision privileged accounts

On an empty installation, with trusted shell/database access:

```powershell
cd backend
..\.venv\Scripts\python.exe -m app.bootstrap --email owner@example.com --name "Platform Owner"
```

Passwords are entered using a hidden terminal prompt. Bootstrap permanently refuses once any administrator exists, including a disabled administrator. Administrators create operator accounts through **Users → Create operator**. There is no public operator or administrator registration. Further administrator role assignments require an authenticated administrator through Users, and the last active administrator is protected.

## Docker

Copy `.env.example` to `.env`, replace `CHANGE_ME` with a strong URL-safe password, then run `docker compose up --build`. Open http://localhost:8080. Compose provides PostgreSQL health checks, a persistent volume, a one-shot migration service, the API, and an Nginx frontend/API proxy. No accounts or demonstration facilities are automatically created.

Optional inventory: `docker compose exec backend python -m app.cli seed-demo`.
Bootstrap: `docker compose exec backend python -m app.bootstrap --email owner@example.com --name "Platform Owner"`.
Stop using `docker compose down` (preserves the volume). Docker was unavailable in the authoring environment, so container execution is not verified.

## Tests

```powershell
cd backend
..\.venv\Scripts\python.exe -m pytest -q
..\.venv\Scripts\python.exe -m ruff check .
cd ..\frontend
npm.cmd test
npm.cmd run build
node node_modules/@playwright/test/cli.js install chromium
npm.cmd run test:e2e
node scripts/verify-demo.mjs
```

Backend tests use a dedicated database ending `_test`; browser tests require `_e2e` and automatically start isolated API/frontend servers on 8001/5174. `init-local.ps1` creates both. `TEST_DATABASE_URL` and `E2E_DATABASE_URL` override their connections. Tests refuse other database names. The demo smoke check is non-destructive and runs against the local app on 5173.

See [testing](docs/testing.md), [architecture](docs/architecture.md), [security](docs/security.md), [API guide](docs/api-guide.md), [database design](docs/database-design.md), and [deployment](docs/deployment.md).

No payment gateway, email/SMS delivery, GPS mapping, or hosted production deployment is configured. Facilities marked Demo are test inventory; their addresses are not verified parking services. Before public launch, configure HTTPS, production cookies/origins, operational contact details, retention policies, backups, and real facility inventory.
