# API guide

The API is versioned at `/api/v1`. Interactive request schemas: `http://127.0.0.1:8000/docs`; OpenAPI: `/openapi.json`. Use same-origin cookie authentication. Mutating requests send `X-Parkly-Request: 1` and, after login, `X-CSRF-Token` matching the readable `parkly_csrf` cookie. Do not store session tokens in localStorage.

| Area | Endpoints |
|---|---|
| Health | GET `/health`, `/ready` (outside version prefix) |
| Auth | POST `/auth/register`, `/auth/login/{customer,operator,admin}`, `/auth/logout`, `/auth/password`; GET/PATCH `/auth/me` |
| Vehicles | GET/POST `/vehicles`; PUT/DELETE `/vehicles/{id}` |
| Facilities | GET/POST `/facilities`; GET/PUT `/facilities/{id}`; POST `/facilities/{id}/zones`; GET `/management/facilities` |
| Spaces | GET/POST `/slots`; PATCH `/slots/{id}` |
| Allocation | POST `/allocation/recommend` |
| Reservations | GET/POST `/reservations`; GET `/reservations/{id}`; POST `/reservations/{id}/cancel`; PATCH `/reservations/{id}/status` |
| Notifications | GET `/notifications`; POST `/notifications/{id}/read` |
| Dashboard | GET `/dashboard` |
| Reports | GET `/analytics/overview`, `/analytics/export` |
| Administration | GET `/admin/users`, `/admin/roles`, `/admin/audit-logs`, `/admin/settings`; PATCH `/admin/users/{id}`; PUT `/admin/settings`; POST `/admin/operators` |

Booking bodies include facility_id, vehicle_id, timezone-aware arrival/departure, accessible, charging, prefer_covered, and optional slot_id. Recommendations do not hold inventory. Creation returns 201 only after transactional validation. Price fields are integer paise in INR and represent estimates only.

Paginated resources return items/total/page/page_size. Analytics date filters use UTC arrival dates. Common errors: 401 expired/missing session, 403 role/CSRF/origin violation, 404 missing or inaccessible resource, 409 availability or uniqueness conflict, 422 invalid input, 429 authentication throttle, 503 unavailable database.
