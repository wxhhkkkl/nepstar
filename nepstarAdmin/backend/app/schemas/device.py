"""Pydantic schemas for devices."""

from datetime import datetime

from pydantic import BaseModel, field_validator


class DeviceUpdate(BaseModel):
    org_id: int | None = None
    report_language: str | None = None

    @field_validator("report_language")
    @classmethod
    def validate_language(cls, v: str | None) -> str | None:
        if v is not None and v not in ("zh-CN", "en", "es"):
            raise ValueError(f"Invalid report_language: {v}. Must be zh-CN, en, or es")
        return v


class DeviceResponse(BaseModel):
    ne_id: str
    ne_no: str | None = None
    device_name: str | None = None
    ne_model_id: str | None = None
    company_id: str | None = None
    org_id: int | None = None  # 来自 sa_device_org 的关联组织
    device_status: int | None = None
    online_status: int | None = None
    create_date: datetime | None = None


class ChangeLogResponse(BaseModel):
    id: int
    device_id: str
    from_org: str | None
    to_org: str
    changed_by: int
    changed_at: datetime


class DeviceConfigResponse(BaseModel):
    ne_id: str
    qr_url: str | None = None
    upload_info: dict | None = None
    device_upload: dict | None = None
