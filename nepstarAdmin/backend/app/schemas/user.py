"""Pydantic schemas for users."""

from datetime import datetime

from pydantic import BaseModel, Field


class UserCreate(BaseModel):
    username: str = Field(..., max_length=50)
    real_name: str = Field(..., max_length=50)
    password: str = Field(..., min_length=8)
    org_ids: list[int] = Field(..., min_length=1)
    role_ids: list[int] = Field(..., min_length=1)
    lang_pref: str = "zh-CN"


class UserUpdate(BaseModel):
    real_name: str | None = None
    password: str | None = Field(None, min_length=8)
    org_ids: list[int] | None = None
    role_ids: list[int] | None = None
    status: int | None = None


class UserResponse(BaseModel):
    id: int
    username: str
    real_name: str
    status: int
    lang_pref: str
    created_at: datetime
