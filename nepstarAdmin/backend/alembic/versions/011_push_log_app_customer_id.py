"""Add app_customer_id to report push log in nepstar only.

Revision ID: 011
Revises: 010

Do not run through the repository's default alembic.ini: its sample URL targets
another database. This revision checks the configured and current database
before issuing any DDL; the migration runner must use nepstar itself.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "011"
down_revision: Union[str, None] = "010"
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
    op.add_column(
        "sa_report_push_log",
        sa.Column("app_customer_id", sa.String(64), nullable=True),
        schema=SCHEMA,
    )


def downgrade() -> None:
    _assert_nepstar_target()
    op.drop_column("sa_report_push_log", "app_customer_id", schema=SCHEMA)
