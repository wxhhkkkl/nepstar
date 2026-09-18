"""Pydantic schemas for health indicators (两级指标)."""

from pydantic import BaseModel, Field


class IndicatorCreate(BaseModel):
    parent_id: int | None = Field(default=None, description="NULL=一级；二级需传所属一级指标id")
    code: str = Field(..., max_length=50, description="指标编码（全局唯一）")
    name: str = Field(..., max_length=100)
    description: str | None = Field(default=None, max_length=500)
    sort_order: int = 0
    status: int = 1
    # 合法性（正整数、不冲突）由 service 校验，以便返回 i18n 错误 key 而非 422
    target_id: int | None = Field(default=None, description="报告文档中对应的数字标识")
    # 面向报告用户的文案，仅一级指标使用
    report_status_text: str | None = Field(default=None, max_length=50, description="报告状态描述")
    report_summary: str | None = Field(default=None, max_length=255, description="报告系统摘要")
    report_interpretation: str | None = Field(default=None, max_length=500, description="报告结论解读")
    report_actions: list[str] | None = Field(default=None, description="报告行动建议")


class IndicatorUpdate(BaseModel):
    parent_id: int | None = None
    code: str | None = Field(default=None, max_length=50)
    name: str | None = Field(default=None, max_length=100)
    description: str | None = Field(default=None, max_length=500)
    sort_order: int | None = None
    status: int | None = None
    # 传 null 表示清空（service 用 model_fields_set 区分"未传"与"传了 null"）
    target_id: int | None = None
    report_status_text: str | None = Field(default=None, max_length=50)
    report_summary: str | None = Field(default=None, max_length=255)
    report_interpretation: str | None = Field(default=None, max_length=500)
    report_actions: list[str] | None = None


class IndicatorNode(BaseModel):
    id: int
    parent_id: int | None = None
    code: str
    name: str
    description: str | None = None
    status: int = 1
    sort_order: int = 0
    target_id: int | None = None
    report_status_text: str | None = None
    report_summary: str | None = None
    report_interpretation: str | None = None
    report_actions: list[str] = []
    children: list["IndicatorNode"] = []


IndicatorNode.model_rebuild()
