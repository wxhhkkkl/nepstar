from types import SimpleNamespace

import pytest
from fastapi import HTTPException

import app.security.ai_consult_admin_permission as permissions


class FakeResult:
    def __init__(self, *, scalar=None, rows=()):
        self._scalar = scalar
        self._rows = list(rows)

    def scalar_one_or_none(self):
        return self._scalar

    def scalars(self):
        return self

    def all(self):
        return self._rows


class FakeAuthDb:
    def __init__(self, *, menu=True, role_ids=(12,), actions=("view",)):
        self.menu = menu
        self.role_ids = list(role_ids)
        self.actions = list(actions)
        self.calls = 0
        self.statements = []

    async def execute(self, statement):
        self.statements.append(statement)
        call = self.calls
        self.calls += 1
        if call == 0:
            return FakeResult(scalar=SimpleNamespace(id=41) if self.menu else None)
        if call == 1:
            return FakeResult(rows=self.role_ids)
        return FakeResult(rows=self.actions)


def fake_request(method, route_path):
    return SimpleNamespace(
        method=method,
        scope={"route": SimpleNamespace(path=route_path)},
    )


@pytest.mark.parametrize(
    ("method", "route_path", "action"),
    [
        ("GET", permissions.AI_CONSULT_SETTINGS_API_ROUTE, "view"),
        ("PUT", permissions.AI_CONSULT_SETTINGS_API_ROUTE, "edit"),
        ("GET", permissions.AI_CONSULT_RULES_API_ROUTE, "view"),
        ("POST", permissions.AI_CONSULT_RULES_API_ROUTE, "edit"),
        ("GET", permissions.AI_CONSULT_RULE_API_ROUTE, "view"),
        ("POST", permissions.AI_CONSULT_RULE_PUBLISH_API_ROUTE, "publish"),
        ("POST", permissions.AI_CONSULT_RULE_ACTIVATE_API_ROUTE, "publish"),
        ("GET", permissions.AI_CONSULT_AUDIT_API_ROUTE, "view"),
    ],
)
async def test_non_admin_requires_exact_menu_action(monkeypatch, method, route_path, action):
    async def not_system_admin(_user_id, _db):
        return False

    monkeypatch.setattr(permissions, "is_admin", not_system_admin)
    user = SimpleNamespace(id=7)
    db = FakeAuthDb(actions=(action,))

    result = await permissions.require_ai_consult_system_admin(
        fake_request(method, route_path), user=user, auth_db=db
    )

    assert result is user
    assert db.calls == 3
    assert "sa_role.status" in str(db.statements[1])


@pytest.mark.parametrize(
    ("method", "route_path", "granted_actions"),
    [
        ("GET", permissions.AI_CONSULT_SETTINGS_API_ROUTE, ("publish",)),
        ("PUT", permissions.AI_CONSULT_SETTINGS_API_ROUTE, ("view",)),
        ("POST", permissions.AI_CONSULT_RULES_API_ROUTE, ("view",)),
        ("POST", permissions.AI_CONSULT_RULE_PUBLISH_API_ROUTE, ("edit",)),
        ("POST", permissions.AI_CONSULT_RULE_ACTIVATE_API_ROUTE, ("edit",)),
        ("GET", permissions.AI_CONSULT_AUDIT_API_ROUTE, ("edit",)),
    ],
)
async def test_non_admin_cannot_substitute_another_menu_action(
    monkeypatch, method, route_path, granted_actions
):
    async def not_system_admin(_user_id, _db):
        return False

    monkeypatch.setattr(permissions, "is_admin", not_system_admin)
    db = FakeAuthDb(actions=granted_actions)

    with pytest.raises(HTTPException) as error:
        await permissions.require_ai_consult_system_admin(
            fake_request(method, route_path), user=SimpleNamespace(id=7), auth_db=db
        )

    assert error.value.status_code == 403


async def test_missing_menu_or_role_fails_closed(monkeypatch):
    async def not_system_admin(_user_id, _db):
        return False

    monkeypatch.setattr(permissions, "is_admin", not_system_admin)
    request = fake_request("POST", permissions.AI_CONSULT_RULE_PUBLISH_API_ROUTE)

    with pytest.raises(HTTPException) as missing_menu:
        await permissions.require_ai_consult_system_admin(
            request, user=SimpleNamespace(id=7), auth_db=FakeAuthDb(menu=False)
        )
    assert missing_menu.value.status_code == 403

    with pytest.raises(HTTPException) as missing_role:
        await permissions.require_ai_consult_system_admin(
            request, user=SimpleNamespace(id=7), auth_db=FakeAuthDb(role_ids=())
        )
    assert missing_role.value.status_code == 403


async def test_unknown_route_fails_closed_before_permission_queries(monkeypatch):
    async def not_system_admin(_user_id, _db):
        return False

    monkeypatch.setattr(permissions, "is_admin", not_system_admin)
    db = FakeAuthDb()

    with pytest.raises(HTTPException) as error:
        await permissions.require_ai_consult_system_admin(
            fake_request("DELETE", "/api/v1/ai-consult/admin/settings"),
            user=SimpleNamespace(id=7),
            auth_db=db,
        )

    assert error.value.status_code == 403
    assert db.calls == 0


async def test_system_admin_bypasses_role_menu_lookup(monkeypatch):
    async def system_admin(_user_id, _db):
        return True

    monkeypatch.setattr(permissions, "is_admin", system_admin)
    user = SimpleNamespace(id=1)
    db = FakeAuthDb()

    result = await permissions.require_ai_consult_system_admin(
        fake_request("POST", permissions.AI_CONSULT_RULE_PUBLISH_API_ROUTE),
        user=user,
        auth_db=db,
    )

    assert result is user
    assert db.calls == 0


@pytest.mark.parametrize("method,api_path", permissions.AI_CONSULT_ADMIN_ACTIONS)
async def test_original_router_templates_use_the_same_exact_action(monkeypatch, method, api_path):
    async def not_system_admin(_user_id, _db):
        return False

    monkeypatch.setattr(permissions, "is_admin", not_system_admin)
    _, action = permissions.AI_CONSULT_ADMIN_ACTIONS[(method, api_path)]
    user = SimpleNamespace(id=7)
    db = FakeAuthDb(actions=(action,))
    result = await permissions.require_ai_consult_system_admin(
        fake_request(method, api_path.removeprefix("/api/v1")), user=user, auth_db=db
    )
    assert result is user


@pytest.mark.parametrize("method,path", [
    ("GET", "/ai-consult/admin/unknown"),
    ("DELETE", "/ai-consult/admin/settings"),
    ("POST", "/ai-consult/admin/rules/3/publish"),
    ("POST", "/unrelated/admin/rules/{rule_id}/publish"),
])
async def test_route_normalization_does_not_expand_allowlist(monkeypatch, method, path):
    async def must_not_check_admin(_user_id, _db):
        raise AssertionError("Unknown routes must fail before admin lookup")

    monkeypatch.setattr(permissions, "is_admin", must_not_check_admin)
    db = FakeAuthDb()
    with pytest.raises(HTTPException) as error:
        await permissions.require_ai_consult_system_admin(
            fake_request(method, path), user=SimpleNamespace(id=7), auth_db=db
        )
    assert error.value.status_code == 403
    assert db.calls == 0
