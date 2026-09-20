"""add configurable score trigger to health plans

Revision ID: 005
Revises: 004

只修改 nepstar.sa_plan。报告源 MongoDB、platform 与 kj_fastplus 均保持只读。
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "005"
down_revision: Union[str, None] = "004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "sa_plan",
        sa.Column(
            "trigger_score_below",
            sa.Integer(),
            nullable=False,
            server_default="80",
            comment="关联指标得分低于该值时展示方案",
        ),
    )


def downgrade() -> None:
    op.drop_column("sa_plan", "trigger_score_below")
