"""sa_indicator - 两级健康指标（parent_id 自引用：一级=NULL，二级=所属一级）。"""

from datetime import datetime

from sqlalchemy import BigInteger, DateTime, Index, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from ...database import NEPSTAR_SCHEMA, Base


class SAIndicator(Base):
    __tablename__ = "sa_indicator"
    __table_args__ = (
        Index("idx_parent", "parent_id"),
        UniqueConstraint("ind_code", name="uk_ind_code"),
        {"schema": NEPSTAR_SCHEMA},
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    parent_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    ind_code: Mapped[str] = mapped_column(String(50), nullable=False)
    ind_name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
