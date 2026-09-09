"""Pydantic schemas for menus."""

from pydantic import BaseModel, Field


class MenuCreate(BaseModel):
    parent_id: int | None = None
    name_zh: str = Field(..., max_length=50)
    name_en: str = Field(..., max_length=50)
    name_es: str = Field(..., max_length=50)
    icon: str | None = None
    route_path: str | None = None
    sort_order: int = 0


class MenuUpdate(BaseModel):
    name_zh: str | None = None
    name_en: str | None = None
    name_es: str | None = None
    icon: str | None = None
    route_path: str | None = None
    sort_order: int | None = None
    parent_id: int | None = None
