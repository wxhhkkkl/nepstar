"""Allow new AI consultation sessions without a consent row.

Revision ID: 008
Revises: 007
Existing consent rows and session references remain intact.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "008"
down_revision: Union[str, None] = "007"
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
        "sa_ai_consult_session",
        "consent_id",
        existing_type=sa.BigInteger(),
        existing_nullable=False,
        nullable=True,
        schema=SCHEMA,
    )


def downgrade() -> None:
    _assert_nepstar_target()
    bind = op.get_bind()
    null_count = bind.execute(
        sa.text("SELECT COUNT(*) FROM nepstar.sa_ai_consult_session WHERE consent_id IS NULL")
    ).scalar_one()
    if null_count:
        raise RuntimeError("Cannot require consent while sessions without consent references exist")
    op.alter_column(
        "sa_ai_consult_session",
        "consent_id",
        existing_type=sa.BigInteger(),
        existing_nullable=True,
        nullable=False,
        schema=SCHEMA,
    )
