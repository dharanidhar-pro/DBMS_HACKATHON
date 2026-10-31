"""Initial PostgreSQL schema and non-overlapping reservation guarantees."""

from alembic import op
from migrations.schema_001 import Base

revision = "001"
down_revision = None


def upgrade():
    op.execute("CREATE EXTENSION IF NOT EXISTS btree_gist")
    Base.metadata.create_all(op.get_bind())
    for key in ("slot_id", "vehicle_id"):
        op.execute(f"""ALTER TABLE reservations ADD CONSTRAINT no_overlap_{key}
            EXCLUDE USING gist ({key} WITH =, tstzrange(arrival, departure, '[)') WITH &&)
            WHERE (status IN ('CONFIRMED', 'ACTIVE'))""")
    op.get_bind().exec_driver_sql("""INSERT INTO system_settings (id, weights, cancellation_minutes, max_booking_hours)
        VALUES (1, '{"compatibility":35,"distance":25,"accessibility":20,"charging":10,"covered":10}', 15, 72)""")


def downgrade():
    Base.metadata.drop_all(op.get_bind())
