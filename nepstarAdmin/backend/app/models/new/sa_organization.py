"""sa_organization - Organization tree."""

from datetime import datetime

from sqlalchemy import BigInteger, DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from ...database import Base, NEPSTAR_SCHEMA


class SAOrganization(Base):
    __tablename__ = "sa_organization"
    __table_args__ = {"schema": NEPSTAR_SCHEMA}

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    org_name: Mapped[str] = mapped_column(String(100), nullable=False)
    org_code: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)
    parent_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
