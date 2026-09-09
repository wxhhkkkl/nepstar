"""Pydantic schemas for inspection reports (inspect_base)."""

from datetime import datetime
from typing import Any

from pydantic import BaseModel


class ReportListResponse(BaseModel):
    """报告列表单条记录（mobile/name 已脱敏，report_url 已构造）。"""

    report_id: int
    report_code: str | None = None
    customer_id: int | None = None
    device_sn: str | None = None
    device_name: str | None = None
    inspect_date: datetime | None = None
    total_score: int | None = None
    status: int | None = None
    status_text: str | None = None  # 0→"无效", 1→"有效"
    mobile: str | None = None  # 已脱敏
    name: str | None = None  # 已脱敏
    report_url: str | None = None  # 构造后的完整URL


class ReportDetailResponse(BaseModel):
    """报告详情（与列表字段一致，items 预留扩展）。"""

    report_id: int
    report_code: str | None = None
    customer_id: int | None = None
    device_sn: str | None = None
    device_name: str | None = None
    inspect_date: datetime | None = None
    total_score: int | None = None
    status: int | None = None
    status_text: str | None = None
    mobile: str | None = None
    name: str | None = None
    report_url: str | None = None
    items: list[Any] = []
