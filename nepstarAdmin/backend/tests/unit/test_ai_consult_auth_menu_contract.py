"""The /auth/me menu tree must expose the parent of an authorized AI page."""

from types import SimpleNamespace

import app.services.auth_service as auth_service


class FakeResult:
    def __init__(self, values):
        self.values = values

    def scalar_one(self):
        return self.values[0]

    def scalars(self):
        return self

    def __iter__(self):
        return iter(self.values)

    def all(self):
        return self.values


class FakeAuthDb:
    def __init__(self):
        self.calls = 0
        self.statements = []

    async def execute(self, statement):
        self.statements.append(statement)
        values = [
            [SimpleNamespace(id=7, username="operator", real_name="Operator", lang_pref="zh-CN")],
            [SimpleNamespace(role_code="operator", role_name="运营")],
            [
                SimpleNamespace(id=10, parent_id=None, route_path="/health", sort_order=1,
                                name_zh="健康管理", name_en="Health", name_es="Salud", icon="heart"),
                SimpleNamespace(id=41, parent_id=10, route_path="/health/ai-consult-settings",
                                sort_order=2, name_zh="AI 咨询设置", name_en="AI Settings",
                                name_es="IA", icon="setting"),
            ],
            [(12,)],
            [SimpleNamespace(menu_id=41, actions="view")],
        ][self.calls]
        self.calls += 1
        return FakeResult(values)


async def test_child_permission_includes_its_parent_menu(monkeypatch):
    async def not_admin(_user_id, _db):
        return False

    monkeypatch.setattr(auth_service, "is_admin", not_admin)
    db = FakeAuthDb()
    result = await auth_service.get_me(db, 7)

    assert result["roles"] == [{"role_code": "operator", "role_name": "运营"}]
    assert result["permissions"] == {"41": ["view"]}
    assert [menu["route_path"] for menu in result["menus"]] == ["/health"]
    assert [menu["route_path"] for menu in result["menus"][0]["children"]] == [
        "/health/ai-consult-settings"
    ]
    assert "sa_role.status" in str(db.statements[3])
