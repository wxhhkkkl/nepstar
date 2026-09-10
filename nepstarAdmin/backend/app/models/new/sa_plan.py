"""sa_plan / sa_plan_product / sa_plan_indicator - 健康方案与其关联。"""

from datetime import datetime

from sqlalchemy import BigInteger, DateTime, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from ...database import NEPSTAR_SCHEMA, Base


class SAPlan(Base):
    __tablename__ = "sa_plan"
    __table_args__ = {"schema": NEPSTAR_SCHEMA}

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    plan_name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    status: Mapped[int] = mapped_column(Integer, default=1)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class SAPlanProduct(Base):
    __tablename__ = "sa_plan_product"
    __table_args__ = (
        UniqueConstraint("plan_id", "product_id", name="uk_plan_product"),
        {"schema": NEPSTAR_SCHEMA},
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    plan_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    product_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)


class SAPlanIndicator(Base):
    __tablename__ = "sa_plan_indicator"
    __table_args__ = (
        UniqueConstraint("plan_id", "indicator_id", name="uk_plan_indicator"),
        {"schema": NEPSTAR_SCHEMA},
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    plan_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    indicator_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
