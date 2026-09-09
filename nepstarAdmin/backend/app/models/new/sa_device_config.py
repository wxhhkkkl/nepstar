"""设备配置表 ORM 模型 — 存储报告语言等设备级配置。

DDL:
CREATE TABLE IF NOT EXISTS sa_device_config (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    device_id       VARCHAR(50) NOT NULL UNIQUE COMMENT '设备ID (ne.ne_id)',
    report_language VARCHAR(10) DEFAULT 'zh-CN' COMMENT '报告语言: zh-CN/en/es',
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='设备配置';
"""

from datetime import datetime

from sqlalchemy import BigInteger, DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column

from ...database import Base, NEPSTAR_SCHEMA


class SADeviceConfig(Base):
    __tablename__ = "sa_device_config"
    __table_args__ = {"schema": NEPSTAR_SCHEMA}

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    device_id: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, comment="设备ID (ne.ne_id)")
    report_language: Mapped[str] = mapped_column(String(10), default="zh-CN", server_default="zh-CN", comment="报告语言: zh-CN/en/es")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now(), server_default=func.now())
    updated_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
