"""sa_device_change_log - Audit log for device organization changes."""

from datetime import datetime

from sqlalchemy import BigInteger, DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from ...database import Base, NEPSTAR_SCHEMA


class SADeviceChangeLog(Base):
    __tablename__ = "sa_device_change_log"
    __table_args__ = {"schema": NEPSTAR_SCHEMA}

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    device_id: Mapped[str] = mapped_column(String(50), nullable=False)
    from_org: Mapped[str | None] = mapped_column(String(100), nullable=True)
    to_org: Mapped[str] = mapped_column(String(100), nullable=False)
    changed_by: Mapped[int] = mapped_column(BigInteger, nullable=False)
    changed_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
