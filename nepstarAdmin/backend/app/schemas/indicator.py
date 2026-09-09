"""Pydantic schemas for health indicators (两级指标)."""

from pydantic import BaseModel, Field


class IndicatorCreate(BaseModel):
    parent_id: int | None = Field(default=None, description="NULL=一级；二级需传所属一级指标id")
    code: str = Field(..., max_length=50, description="指标编码（全局唯一）")
    name: str = Field(..., max_length=100)
    description: str | None = Field(default=None, max_length=500)
    sort_order: int = 0
    status: int = 1


class IndicatorUpdate(BaseModel):
    parent_id: int | None = None
    code: str | None = Field(default=None, max_length=50)
    name: str | None = Field(default=None, max_length=100)
    description: str | None = Field(default=None, max_length=500)
    sort_order: int | None = None
    status: int | None = None


class IndicatorNode(BaseModel):
    id: int
    parent_id: int | None = None
    code: str
    name: str
    description: str | None = None
    status: int = 1
    sort_order: int = 0
    children: list["IndicatorNode"] = []


IndicatorNode.model_rebuild()
