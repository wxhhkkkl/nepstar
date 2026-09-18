"""sa_indicator - 两级健康指标（parent_id 自引用：一级=NULL，二级=所属一级）。"""

from datetime import datetime

from sqlalchemy import BigInteger, DateTime, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from ...database import NEPSTAR_SCHEMA, Base


class SAIndicator(Base):
    __tablename__ = "sa_indicator"
    __table_args__ = (
        Index("idx_parent", "parent_id"),
        UniqueConstraint("ind_code", name="uk_ind_code"),
        UniqueConstraint("target_id", name="uk_target_id"),
        {"schema": NEPSTAR_SCHEMA},
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    parent_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    ind_code: Mapped[str] = mapped_column(String(50), nullable=False)
    ind_name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[int] = mapped_column(Integer, default=1)
    # 报告展示字段（见 004 迁移）
    target_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    report_status_text: Mapped[str | None] = mapped_column(String(50), nullable=True)
    report_summary: Mapped[str | None] = mapped_column(String(255), nullable=True)
    report_interpretation: Mapped[str | None] = mapped_column(String(500), nullable=True)
    report_actions: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
