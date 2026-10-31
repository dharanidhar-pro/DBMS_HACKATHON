# Security

Passwords use Argon2. Session tokens contain 48 random bytes, are stored only as SHA-256 digests in PostgreSQL, and travel in HttpOnly, SameSite=Lax cookies. Sessions expire after eight hours by default. Logout revokes the current session; password/access changes revoke prior sessions. There is no refresh token: reauthenticate after expiry.

Mutations require a custom request header, a permitted Origin when present, and an authenticated session-bound CSRF token. CORS uses an explicit origin list. Production refuses insecure-cookie configuration. The production frontend proxy supplies CSP and security headers; TLS termination must be configured by the operator.

Each protected request loads current active status and role from the database. Customers can access only their own vehicles/bookings/notifications. Operators are scoped to assigned facilities. Admin account changes serialize the last-active-administrator check. Authentication attempts are rate-limited in PostgreSQL across API workers; keys are hashed and passwords/tokens are never logged.

One-time bootstrap requires trusted shell and database access and closes when any admin exists. Operator creation is an ADMIN-only API. Demo accounts require development mode, with local random passwords written to ignored files; no privileged credentials appear in the UI or frontend bundle. Protect `.env` and `.local` using normal OS account permissions.

Deployment operators must configure HTTPS, backups, retention, monitoring, and account recovery. No email-based password reset is advertised. This is a tested implementation, not a substitute for an independent security assessment before public operation.
