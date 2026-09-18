"""add report view fields to sa_indicator (target_id + report copy)

Revision ID: 004
Revises: 003
Create Date: 2026-09-18

报告展示数据接口所需：给 sa_indicator 增加
- target_id：报告文档中对应的数字标识（唯一，用于把报告得分落到正确指标）
- report_status_text / report_summary / report_interpretation / report_actions：
  面向报告用户的文案，由指标管理模块维护（schema: nepstar）

注意：报告本体在 MongoDB，本迁移只动 nepstar 库的 sa_* 表，不触碰任何旧系统数据源。
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "004"
down_revision: Union[str, None] = "003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 报告文档中的数字标识；唯一约束落实 FR-032（同一 targetId 不得登记到多个指标）
    op.add_column(
        "sa_indicator",
        sa.Column("target_id", sa.Integer(), nullable=True, comment="报告文档中对应的数字标识"),
    )
    op.create_unique_constraint("uk_target_id", "sa_indicator", ["target_id"])

    # 面向报告用户的文案（仅一级指标使用；二级指标复用既有 description）
    op.add_column(
        "sa_indicator",
        sa.Column("report_status_text", sa.String(50), nullable=True, comment="报告状态描述"),
    )
    op.add_column(
        "sa_indicator",
        sa.Column("report_summary", sa.String(255), nullable=True, comment="报告系统摘要"),
    )
    op.add_column(
        "sa_indicator",
        sa.Column("report_interpretation", sa.String(500), nullable=True, comment="报告结论解读"),
    )
    op.add_column(
        "sa_indicator",
        sa.Column(
            "report_actions",
            sa.Text(),
            nullable=True,
            comment="报告行动建议(JSON字符串数组)",
        ),
    )


def downgrade() -> None:
    op.drop_column("sa_indicator", "report_actions")
    op.drop_column("sa_indicator", "report_interpretation")
    op.drop_column("sa_indicator", "report_summary")
    op.drop_column("sa_indicator", "report_status_text")
    op.drop_constraint("uk_target_id", "sa_indicator", type_="unique")
    op.drop_column("sa_indicator", "target_id")
