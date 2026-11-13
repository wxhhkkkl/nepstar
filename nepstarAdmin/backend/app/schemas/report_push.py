# ruff: noqa: N815 — 设备侧回调字段沿用既有 camelCase 契约
"""报告推送/回调/拉取的请求与响应模型。"""

from pydantic import BaseModel, ConfigDict, Field


class DeviceCallbackPayload(BaseModel):
    """设备侧检测完成回调。

    只依赖 `reportId` 与 `deviceId`；其余字段允许透传但从不持久化。
    """

    model_config = ConfigDict(extra="allow")

    reportId: str = Field(min_length=1, max_length=64)
    deviceId: str = Field(min_length=1, max_length=64)
    h5Url: str | None = None
    appCustomerInfo: str | dict | None = None
    printH5: str | None = None
    modelType: int | None = None
    exceptionTab: str | list | None = None
    customerType: int | None = None


class PushResult(BaseModel):
    record_id: int
    status: str
    failure_reason: str | None = None


class PushRecordOut(BaseModel):
    id: int
    report_id: int | None
    report_code: str
    device_sn: str | None
    trigger_type: str
    operator_id: int | None
    status: str
    failure_reason: str | None
    response_summary: str | None
    created_at: str | None
    finished_at: str | None
