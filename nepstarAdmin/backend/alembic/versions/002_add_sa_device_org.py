"""add sa_device_org

Revision ID: 002
Revises: 001
Create Date: 2026-07-26

设备-组织关联表 — 人工维护设备与组织节点的映射关系。
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "sa_device_org",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("device_id", sa.String(50), nullable=False, comment="设备ID (ne.ne_id)"),
        sa.Column("org_id", sa.BigInteger(), nullable=False, comment="组织ID (sa_organization.id)"),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("device_id", "org_id"),
        mysql_engine="InnoDB",
        mysql_charset="utf8mb4",
        comment="设备-组织关联",
    )


def downgrade() -> None:
    op.drop_table("sa_device_org")
