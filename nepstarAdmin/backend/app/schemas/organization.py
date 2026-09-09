"""Pydantic schemas for organizations."""

from pydantic import BaseModel, Field


class OrgCreate(BaseModel):
    org_name: str = Field(..., max_length=100)
    org_code: str = Field(..., max_length=50)
    parent_id: int | None = None
    sort_order: int = 0


class OrgUpdate(BaseModel):
    org_name: str | None = None
    parent_id: int | None = None
    sort_order: int | None = None
