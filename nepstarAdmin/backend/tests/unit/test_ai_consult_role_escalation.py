"""AI publish permission cannot be self-granted through role/user APIs."""

from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.api import roles, users
from app.security import rbac


async def test_role_and_user_routes_require_system_admin():
    for router in (roles.router, users.router):
        for route in router.routes:
            assert any(
                dependency.dependency is rbac.require_system_admin
                for dependency in route.dependencies
            ), route.path


async def test_non_admin_cannot_change_role_or_user_authorization(monkeypatch):
    async def not_admin(_user_id, _db):
        return False

    monkeypatch.setattr(rbac, "is_admin", not_admin)
    with pytest.raises(HTTPException) as denied:
        await rbac.require_system_admin(user=SimpleNamespace(id=7), db=object())
    assert denied.value.status_code == 403


async def test_active_system_admin_can_manage_roles(monkeypatch):
    async def is_admin(_user_id, _db):
        return True

    monkeypatch.setattr(rbac, "is_admin", is_admin)
    user = SimpleNamespace(id=1)
    assert await rbac.require_system_admin(user=user, db=object()) is user
