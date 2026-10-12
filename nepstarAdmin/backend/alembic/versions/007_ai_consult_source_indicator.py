"""Persist the report indicator that originated an anonymous consultation.

Revision ID: 007
Revises: 006
Only the nepstar database is eligible for this schema change.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "007"
down_revision: Union[str, None] = "006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

SCHEMA = "nepstar"


def _assert_nepstar_target() -> None:
    bind = op.get_bind()
    configured_database = getattr(getattr(bind.engine, "url", None), "database", None)
    if configured_database != SCHEMA:
        raise RuntimeError("AI consult migration requires a nepstar connection URL")
    if bind.exec_driver_sql("SELECT DATABASE()").scalar() != SCHEMA:
        raise RuntimeError("AI consult migration requires nepstar as the current database")


def upgrade() -> None:
    _assert_nepstar_target()
    op.add_column(
        "sa_ai_consult_session",
        sa.Column("source_indicator_code", sa.String(64), nullable=True),
        schema=SCHEMA,
    )


def downgrade() -> None:
    _assert_nepstar_target()
    op.drop_column("sa_ai_consult_session", "source_indicator_code", schema=SCHEMA)
