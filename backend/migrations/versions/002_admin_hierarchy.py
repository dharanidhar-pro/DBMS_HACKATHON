"""Separate administrator workspaces and introduce the main administrator."""

from alembic import op
import sqlalchemy as sa

revision = "002"
down_revision = "001"


def upgrade():
    for table in ("users", "parking_facilities"):
        op.add_column(table, sa.Column("admin_id", sa.String(36), nullable=True))
        op.create_foreign_key(f"fk_{table}_admin", table, "users", ["admin_id"], ["id"])
        op.create_index(f"ix_{table}_admin_id", table, ["admin_id"])
    # The original PostgreSQL check was unnamed in SQLAlchemy.
    for constraint in sa.inspect(op.get_bind()).get_check_constraints("users"):
        if "role" in constraint["sqltext"]:
            op.drop_constraint(constraint["name"], "users", type_="check")
    op.create_check_constraint("users_role_check", "users", "role IN ('CUSTOMER','OPERATOR','ADMIN','SUPER_ADMIN')")
    # A single legacy administrator owned the old shared workspace. With several
    # existing admins, leave ambiguous records unassigned (fail closed).
    op.execute("""UPDATE users SET admin_id = (SELECT id FROM users WHERE role='ADMIN')
        WHERE role='OPERATOR' AND (SELECT count(*) FROM users WHERE role='ADMIN')=1""")
    op.execute("""UPDATE parking_facilities SET admin_id = (SELECT id FROM users WHERE role='ADMIN')
        WHERE (SELECT count(*) FROM users WHERE role='ADMIN')=1""")


def downgrade():
    # Losing ownership would restore cross-tenant access. Require an explicit,
    # reviewed data migration instead of silently weakening isolation.
    raise RuntimeError("Administrator ownership cannot be safely downgraded automatically.")
