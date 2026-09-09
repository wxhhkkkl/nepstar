"""Pydantic schemas for customer management."""

from datetime import datetime

from pydantic import BaseModel


class CustomerListResponse(BaseModel):
    """客户列表单条记录（mobile/name 已脱敏）。"""

    customer_id: int
    name: str | None = None  # 已脱敏
    mobile: str | None = None  # 已脱敏
    age: int | None = None
    sex: int | None = None
    sex_text: str | None = None  # 0=女, 其他=男
    height: int | None = None
    weight: int | None = None
    latest_inspect_date: datetime | None = None
    report_count: int = 0
