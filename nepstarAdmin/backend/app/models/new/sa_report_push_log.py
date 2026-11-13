"""sa_report_push_log — 检测报告推送尝试记录。

一次人工/自动推送产生一条记录。自动推送以 `dedupe_key = report_code` 唯一
约束保证并发幂等；失败时清空 `dedupe_key`，允许后续回调新建尝试，同时保留
历史记录（FR-003 只追加不覆盖）。
"""

from datetime import datetime

from sqlalchemy import BigInteger, DateTime, Index, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from ...database import NEPSTAR_SCHEMA, Base


class SAReportPushLog(Base):
    __tablename__ = "sa_report_push_log"
    __table_args__ = (
        UniqueConstraint("dedupe_key", name="uk_push_dedupe"),
        Index("idx_push_report_code", "report_code"),
        Index("idx_push_created", "created_at"),
        Index("idx_push_status_created", "status", "created_at"),
        Index("idx_push_device", "device_sn"),
        {"schema": NEPSTAR_SCHEMA},
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    report_id: Mapped[int | None] = mapped_column(BigInteger)
    report_code: Mapped[str] = mapped_column(String(64), nullable=False)
    device_sn: Mapped[str | None] = mapped_column(String(64))
    trigger_type: Mapped[str] = mapped_column(String(10), nullable=False)
    operator_id: Mapped[int | None] = mapped_column(BigInteger)
    status: Mapped[str] = mapped_column(String(10), nullable=False)
    dedupe_key: Mapped[str | None] = mapped_column(String(64))
    failure_reason: Mapped[str | None] = mapped_column(String(255))
    response_summary: Mapped[str | None] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime)
