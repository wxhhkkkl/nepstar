"""Pydantic schemas for health plans (健康方案)."""

from pydantic import BaseModel, Field


class PlanCreate(BaseModel):
    name: str = Field(..., max_length=100)
    description: str | None = Field(default=None, max_length=500)
    status: int = 1
    sort_order: int = 0
    product_ids: list[int] = []
    indicator_ids: list[int] = []


class PlanUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=100)
    description: str | None = Field(default=None, max_length=500)
    status: int | None = None
    sort_order: int | None = None
    product_ids: list[int] | None = None
    indicator_ids: list[int] | None = None
