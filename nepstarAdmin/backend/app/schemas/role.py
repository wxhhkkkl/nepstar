"""Pydantic schemas for roles."""

from datetime import datetime

from pydantic import BaseModel, Field


class MenuPermission(BaseModel):
    menu_id: int
    actions: str = "view"


class RoleCreate(BaseModel):
    role_name: str = Field(..., max_length=50)
    role_code: str = Field(..., max_length=50)
    data_scope: str = "self"
    menu_permissions: list[MenuPermission] = []
    org_ids: list[int] = []


class RoleUpdate(BaseModel):
    role_name: str | None = None
    data_scope: str | None = None
    menu_permissions: list[MenuPermission] | None = None
    org_ids: list[int] | None = None


class RoleResponse(BaseModel):
    id: int
    role_name: str
    role_code: str
    data_scope: str
    status: int
    created_at: datetime
    menu_count: int = 0
    user_count: int = 0
    org_count: int = 0


class RoleDetail(BaseModel):
    id: int
    role_name: str
    role_code: str
    data_scope: str
    status: int
    menu_permissions: list[MenuPermission] = []
    org_ids: list[int] = []
    created_at: datetime
