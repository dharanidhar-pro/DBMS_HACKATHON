# Verification

Verified locally on Windows with PostgreSQL 18, Python 3.14, Node 25, and Chromium. Tests use actual PostgreSQL transactions; no SQLite substitute is used.

- Backend: 40 passing Pytest cases, including registration without auto-login, all role logins, expired sessions, CSRF/origin rejection, authorization, ownership, password hashing, throttling, last-admin protection, administrator-only operator creation, one-time bootstrap, CRUD, analytics, lifecycle, interval validation, direct database exclusions, and simultaneous overlapping reservations (one winner).
- Frontend: 18 passing Vitest/React Testing Library cases covering public navigation, three login pages, validation/errors, registration returning to login, redirects, protected routes, themes, parking search, recommendation, booking, and cancellation.
- Browser: four passing Playwright journeys against an isolated `_e2e` database: public/mobile/themes/Back/Forward; customer registration/login/vehicle/booking/cancellation; scoped operator maintenance/reports; admin facility/slot/settings/audit/analytics.
- Development smoke check: `node scripts/verify-demo.mjs` passed for all three actual seeded accounts, checking database login, every sidebar destination, protected-page refresh, logout, and Back protection. It reads local ignored credentials and does not print passwords.
- Production build and Ruff lint are run as delivery checks.

Visual captures are in `.local/screenshots`. Browser traces and failure reports stay ignored in `frontend/test-results` and `frontend/playwright-report`.

Resolved failures included an authentication cache-observer bug, missing spaces in accessible heading names, incorrect test fixtures, mobile illustration overflow, and number input validation rejecting normalized fractional allocation weights. A short-viewport check also exposed an unreachable logout control; the sidebar now scrolls.

Limitations: Docker is not installed, so Compose has not been executed. Hosted deployment, external email/SMS, payments, GPS services, and CI execution on GitHub are not claimed. Local Pytest emits an upstream Starlette/httpx deprecation warning. The production build may report a bundle-size advisory; this does not fail compilation.
