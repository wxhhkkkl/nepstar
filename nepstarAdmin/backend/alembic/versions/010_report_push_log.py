"""Create report push log table in nepstar only.

Revision ID: 010
Revises: 009

Do not run through the repository's default alembic.ini: its sample URL targets
another database. This revision checks the configured and current database
before issuing any DDL; the migration runner must use nepstar itself.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "010"
down_revision: Union[str, None] = "009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

SCHEMA = "nepstar"


def _assert_nepstar_target() -> None:
    bind = op.get_bind()
    configured_database = getattr(getattr(bind.engine, "url", None), "database", None)
    if configured_database != SCHEMA:
        raise RuntimeError("Report push migration requires a nepstar connection URL")
    if bind.exec_driver_sql("SELECT DATABASE()").scalar() != SCHEMA:
        raise RuntimeError("Report push migration requires nepstar as the current database")


def upgrade() -> None:
    _assert_nepstar_target()

    op.create_table(
        "sa_report_push_log",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("report_id", sa.BigInteger()),
        sa.Column("report_code", sa.String(64), nullable=False),
        sa.Column("device_sn", sa.String(64)),
        sa.Column("trigger_type", sa.String(10), nullable=False),
        sa.Column("operator_id", sa.BigInteger()),
        sa.Column("status", sa.String(10), nullable=False),
        sa.Column("dedupe_key", sa.String(64)),
        sa.Column("failure_reason", sa.String(255)),
        sa.Column("response_summary", sa.String(500)),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("finished_at", sa.DateTime()),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("dedupe_key", name="uk_push_dedupe"),
        schema=SCHEMA,
        mysql_engine="InnoDB",
        mysql_charset="utf8mb4",
    )
    op.create_index("idx_push_report_code", "sa_report_push_log", ["report_code"], schema=SCHEMA)
    op.create_index("idx_push_created", "sa_report_push_log", ["created_at"], schema=SCHEMA)
    op.create_index(
        "idx_push_status_created", "sa_report_push_log", ["status", "created_at"], schema=SCHEMA
    )
    op.create_index("idx_push_device", "sa_report_push_log", ["device_sn"], schema=SCHEMA)


def downgrade() -> None:
    _assert_nepstar_target()
    op.drop_table("sa_report_push_log", schema=SCHEMA)
