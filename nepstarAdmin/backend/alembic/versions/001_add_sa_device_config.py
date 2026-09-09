"""add sa_device_config

Revision ID: 001
Revises: None (initial migration)
Create Date: 2026-07-26

设备配置表 — 存储 per-device 报告语言等配置
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "sa_device_config",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("device_id", sa.String(50), nullable=False, comment="设备ID (ne.ne_id)"),
        sa.Column("report_language", sa.String(10), server_default="zh-CN", comment="报告语言: zh-CN/en/es"),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("device_id"),
        mysql_engine="InnoDB",
        mysql_charset="utf8mb4",
        comment="设备配置",
    )


def downgrade() -> None:
    op.drop_table("sa_device_config")
