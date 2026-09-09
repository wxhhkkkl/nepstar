"""设备-组织关联表 — 人工维护的设备与组织对应关系。

与 ne.company_id（公司级过滤）不同，此表存储用户在系统中手动维护的
设备 ↔ 组织节点的关联，用于组织树筛选和设备编辑时的组织分配。
"""

from datetime import datetime

from sqlalchemy import BigInteger, DateTime, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from ...database import Base


class SADeviceOrg(Base):
    __tablename__ = "sa_device_org"
    __table_args__ = (UniqueConstraint("device_id", "org_id"),)

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    device_id: Mapped[str] = mapped_column(String(50), nullable=False, comment="设备ID (ne.ne_id)")
    org_id: Mapped[int] = mapped_column(BigInteger, nullable=False, comment="组织ID (sa_organization.id)")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now(), server_default=func.now())
    updated_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, onupdate=func.now())
