"""Pydantic schemas for authentication."""

from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=50)
    password: str = Field(..., min_length=1)
    lang: str = Field(default="zh-CN")


class LoginResponse(BaseModel):
    token: str
    user: "UserBrief"
    must_change_pwd: bool = False


class UserBrief(BaseModel):
    id: int
    username: str
    real_name: str
    lang_pref: str = "zh-CN"


class MeResponse(BaseModel):
    user: UserBrief
    roles: list[dict]
    menus: list[dict]
    permissions: dict[str, list[str]]


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str
