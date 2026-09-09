"""add health module tables (indicator / product / plan)

Revision ID: 003
Revises: 002
Create Date: 2026-09-09

健康管理模块六张表：sa_indicator、sa_product、sa_product_image、
sa_plan、sa_plan_product、sa_plan_indicator（schema: nepstar）
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # sa_indicator — 两级健康指标（parent_id 自引用）
    op.create_table(
        "sa_indicator",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("parent_id", sa.BigInteger(), nullable=True, comment="一级=NULL；二级=所属一级指标ID"),
        sa.Column("ind_code", sa.String(50), nullable=False, comment="指标编码（一级/二级全局唯一）"),
        sa.Column("ind_name", sa.String(100), nullable=False, comment="指标名称"),
        sa.Column("description", sa.String(500), nullable=True, comment="说明"),
        sa.Column("sort_order", sa.Integer(), server_default="0", comment="同级排序"),
        sa.Column("status", sa.SmallInteger(), server_default="1", comment="1=启用,0=禁用"),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("ind_code", name="uk_ind_code"),
        mysql_engine="InnoDB",
        mysql_charset="utf8mb4",
        comment="健康指标(两级)",
    )
    op.create_index("idx_parent", "sa_indicator", ["parent_id"])

    # sa_product — 商品
    op.create_table(
        "sa_product",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("product_name", sa.String(100), nullable=False, comment="商品名称"),
        sa.Column("description", sa.String(500), nullable=True, comment="文字说明"),
        sa.Column("detail_html", sa.Text(), nullable=True, comment="图文详情HTML"),
        sa.Column("cover_url", sa.String(500), nullable=True, comment="封面图URL(第一张图片)"),
        sa.Column("status", sa.SmallInteger(), server_default="1", comment="1=启用,0=禁用"),
        sa.Column("sort_order", sa.Integer(), server_default="0", comment="排序"),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        mysql_engine="InnoDB",
        mysql_charset="utf8mb4",
        comment="商品",
    )

    # sa_product_image — 商品图片
    op.create_table(
        "sa_product_image",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("product_id", sa.BigInteger(), nullable=False, comment="商品ID (sa_product.id)"),
        sa.Column("image_url", sa.String(500), nullable=False, comment="OSS图片URL"),
        sa.Column("sort_order", sa.Integer(), server_default="0", comment="排序(最小为封面)"),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        mysql_engine="InnoDB",
        mysql_charset="utf8mb4",
        comment="商品图片",
    )
    op.create_index("idx_product", "sa_product_image", ["product_id"])

    # sa_plan — 健康方案
    op.create_table(
        "sa_plan",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("plan_name", sa.String(100), nullable=False, comment="方案名称"),
        sa.Column("description", sa.String(500), nullable=True, comment="描述/目标"),
        sa.Column("status", sa.SmallInteger(), server_default="1", comment="1=启用,0=禁用"),
        sa.Column("sort_order", sa.Integer(), server_default="0", comment="排序"),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        mysql_engine="InnoDB",
        mysql_charset="utf8mb4",
        comment="健康方案",
    )

    # sa_plan_product — 方案×商品 junction
    op.create_table(
        "sa_plan_product",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("plan_id", sa.BigInteger(), nullable=False, comment="方案ID (sa_plan.id)"),
        sa.Column("product_id", sa.BigInteger(), nullable=False, comment="商品ID (sa_product.id)"),
        sa.Column("sort_order", sa.Integer(), server_default="0", comment="方案内展示顺序"),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("plan_id", "product_id", name="uk_plan_product"),
        mysql_engine="InnoDB",
        mysql_charset="utf8mb4",
        comment="方案-商品关联",
    )

    # sa_plan_indicator — 方案×指标 junction（严格精确关联）
    op.create_table(
        "sa_plan_indicator",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("plan_id", sa.BigInteger(), nullable=False, comment="方案ID (sa_plan.id)"),
        sa.Column("indicator_id", sa.BigInteger(), nullable=False, comment="指标ID (sa_indicator.id)"),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("plan_id", "indicator_id", name="uk_plan_indicator"),
        mysql_engine="InnoDB",
        mysql_charset="utf8mb4",
        comment="方案-指标关联",
    )


def downgrade() -> None:
    op.drop_table("sa_plan_indicator")
    op.drop_table("sa_plan_product")
    op.drop_table("sa_plan")
    op.drop_table("sa_product_image")
    op.drop_table("sa_product")
    op.drop_index("idx_parent", "sa_indicator")
    op.drop_table("sa_indicator")
