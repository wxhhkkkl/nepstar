"""Default newly inserted AI consultation settings to enabled.

Revision ID: 009
Revises: 008
Changes only the column default; existing settings rows are never updated.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "009"
down_revision: Union[str, None] = "008"
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
    op.alter_column(
        "sa_ai_consult_settings",
        "enabled",
        existing_type=sa.Boolean(),
        existing_nullable=False,
        server_default=sa.true(),
        schema=SCHEMA,
    )


def downgrade() -> None:
    _assert_nepstar_target()
    op.alter_column(
        "sa_ai_consult_settings",
        "enabled",
        existing_type=sa.Boolean(),
        existing_nullable=False,
        server_default=sa.false(),
        schema=SCHEMA,
    )
