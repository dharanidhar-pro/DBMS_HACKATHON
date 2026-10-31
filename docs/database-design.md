# Database design

PostgreSQL tables: users, auth_sessions, auth_attempts, vehicles, parking_facilities, parking_zones, parking_slots, reservations, allocation_history, reservation_status_history, notifications, audit_logs, system_settings.

UUID strings identify entities. Users have unique lowercase emails and a constrained role. Vehicles have globally unique normalized registration numbers and an owner. Facilities have an optional assigned operator. Slots reference a facility and zone, have unique labels within a facility, and constrained inventory state and vehicle type. Essential fixed features are boolean columns rather than a separate general-purpose feature catalogue.

Reservations preserve the booked rate, integer estimated cost, interval, lifecycle state, and allocation explanation. User/arrival, facility, slot, vehicle, status and interval indexes support lookup. `btree_gist` supports partial GiST exclusion constraints for slot and vehicle overlaps. Timestamps are timezone-aware. Historical entities are retained rather than deleted when vehicles or facilities are deactivated.

Migration command: `python -m alembic upgrade head` from backend. Back up before migrations. The initial revision creates the baseline; introduce new Alembic revisions for subsequent production schema changes.
