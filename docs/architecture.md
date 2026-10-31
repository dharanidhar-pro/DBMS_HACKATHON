# Architecture

React Router provides public, customer, operator, and administrator route groups. TanStack Query fetches authoritative API data and refreshes inventory/operational reports every 30 seconds. React Hook Form and Zod validate authentication forms; the backend validates all mutations. CSS variables provide Midnight Electric, Arctic Light, and Emerald Drive. Only the theme is persisted in localStorage.

FastAPI routers separate authentication, parking, administration, and analytics. `services.py` holds ownership checks, allocation, transaction rules, reservation transitions, notifications, and audit creation. PostgreSQL is the only data store. SQLAlchemy sessions commit before responses are sent; failed requests roll back.

Allocation validates the facility, vehicle ownership and interval; excludes inactive, maintenance, incompatible, inaccessible, non-charging, and conflicting slots; then ranks eligible candidates. Default weights are 35/25/20/10/10 for compatibility/distance/accessibility/charging/covered. Distance factor is `1 / (1 + distance_m/50)`. Weights normalize to 100; deterministic ties use entrance distance, label, and ID. Manual selection is subjected to the same hard constraints.

Reservation creation locks the facility, vehicle, and selected space. PostgreSQL exclusion constraints independently prevent overlapping confirmed/active intervals for both slot and vehicle. Reservation, allocation details, status history, notification, and audit commit together. Adjacent intervals are allowed using `[arrival, departure)` semantics.

Lifecycle: CONFIRMED → ACTIVE → COMPLETED; CONFIRMED → CANCELLED or NO_SHOW. Staff perform check-in/out; customers cancel only before the configured cutoff. Check-in requires the booked interval; no-show cannot precede arrival. Expired time intervals stop blocking new bookings; staff still resolve outstanding status records. No automatic expiration worker is configured.

Back navigation records same-tab visited routes and uses browser history only for a known authorized predecessor, otherwise a safe parent/dashboard fallback. Guards re-evaluate the backend session on refresh. Logged-in users cannot revisit authentication forms as a path into a different role.
