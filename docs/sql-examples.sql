-- Examples use the implemented schema. Run write examples only on an isolated development database.
SELECT id, name, city FROM parking_facilities WHERE active = true;
SELECT f.name, COUNT(s.id) AS spaces FROM parking_facilities f
JOIN parking_slots s ON s.facility_id = f.id GROUP BY f.id HAVING COUNT(s.id) > 10;
SELECT id, name FROM users WHERE id IN (SELECT user_id FROM reservations);
WITH daily AS (SELECT arrival::date AS day, COUNT(*) AS bookings FROM reservations GROUP BY arrival::date)
SELECT day, bookings, SUM(bookings) OVER (ORDER BY day) AS cumulative FROM daily;
-- View creation is optional; this view is not required by the application.
CREATE OR REPLACE VIEW facility_slot_counts AS
SELECT f.id, f.name, COUNT(s.id) AS spaces FROM parking_facilities f
LEFT JOIN parking_slots s ON s.facility_id=f.id GROUP BY f.id;
-- The migration already creates this logical lookup; IF NOT EXISTS makes this illustrative operation safe to repeat.
CREATE INDEX IF NOT EXISTS ix_reservations_user_arrival ON reservations(user_id, arrival);
BEGIN;
INSERT INTO parking_zones (id,created_at,facility_id,name,level)
SELECT '00000000-0000-0000-0000-000000000099',now(),id,'SQL example zone','Ground'
FROM parking_facilities ORDER BY id LIMIT 1;
UPDATE parking_zones SET level='Level 1' WHERE id='00000000-0000-0000-0000-000000000099';
DELETE FROM parking_zones WHERE id='00000000-0000-0000-0000-000000000099';
ROLLBACK;
