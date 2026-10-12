import json
from datetime import datetime
from types import SimpleNamespace

from app.api.ai_consult_admin import (
    _MAX_AUDIT_SUMMARY_CHARS,
    _VISIBLE_ADMIN_AUDIT_ACTIONS,
    list_admin_audit,
    _public_audit,
    router,
)
from app.security.ai_consult_admin_permission import (
    AI_CONSULT_ADMIN_ACTIONS,
    AI_CONSULT_AUDIT_API_ROUTE,
    AI_CONSULT_SETTINGS_ROUTE,
)


def audit_entry(summary, *, action="settings.update", target_id="1", entry_id=10):
    return SimpleNamespace(
        id=entry_id,
        actor_admin_id=25,
        action=action,
        target_id=target_id,
        change_summary_json=json.dumps(summary),
        occurred_at=datetime(2026, 10, 9, 3, 4, 5),
    )


class FakeAuditRows:
    def __init__(self, rows):
        self.rows = rows

    def scalars(self):
        return self

    def all(self):
        return self.rows


class FakeAuditDb:
    def __init__(self, rows):
        self.rows = rows
        self.statement = None

    async def execute(self, statement):
        self.statement = statement
        return FakeAuditRows(self.rows)


def test_audit_view_uses_settings_view_permission():
    assert AI_CONSULT_ADMIN_ACTIONS[("GET", AI_CONSULT_AUDIT_API_ROUTE)] == (
        AI_CONSULT_SETTINGS_ROUTE,
        "view",
    )
    assert any(
        route.path == "/ai-consult/admin/audit" and "GET" in route.methods
        for route in router.routes
    )


def test_public_audit_returns_only_allowlisted_metadata():
    sensitive = "KH503LS0014998K260729093902424"
    entry = audit_entry(
        {
            "changed_fields": ["model_code", "secret", "enabled", "model_code"],
            "from_row_version": "3",
            "to_row_version": 4,
            "version": "2026-10-v1",
            "content_hash": "a" * 64,
            "content_length": 120,
            "question": "用户健康问题",
            "answer": "聊天回答",
            "report_id": sensitive,
        },
        target_id=sensitive,
    )

    public = _public_audit(entry)

    assert public["action"] == "settings.update"
    assert public["target_id"] is None
    assert public["occurred_at"] == "2026-10-09T03:04:05Z"
    assert public["change_summary"] == {
        "changed_fields": ["enabled", "model_code"],
        "to_row_version": 4,
        "version": "2026-10-v1",
        "content_hash": "a" * 64,
        "content_length": 120,
    }
    serialized = json.dumps(public, ensure_ascii=False)
    assert sensitive not in serialized
    assert "用户健康问题" not in serialized
    assert "聊天回答" not in serialized
    assert "secret" not in serialized


def test_public_audit_ignores_oversized_or_invalid_summary_json():
    entry = audit_entry({"version": "v1"})
    entry.change_summary_json = '{"version":"should-not-be-parsed"}' + (
        " " * _MAX_AUDIT_SUMMARY_CHARS
    )

    assert _public_audit(entry)["change_summary"] == {}

    entry.change_summary_json = "not-json"
    assert _public_audit(entry)["change_summary"] == {}


def test_audit_listing_excludes_system_maintenance_records():
    assert set(_VISIBLE_ADMIN_AUDIT_ACTIONS) == {
        "settings.update",
        "service.pause",
        "service.resume",
        "rule.draft_create",
        "rule.publish",
        "rule.activate",
    }
    assert "retention.cleaned" not in _VISIBLE_ADMIN_AUDIT_ACTIONS
    assert "generation.recovered" not in _VISIBLE_ADMIN_AUDIT_ACTIONS


async def test_audit_list_api_filters_actions_paginates_and_returns_safe_page():
    rows = [
        audit_entry({"version": "v3"}, action="rule.publish", target_id="3", entry_id=13),
        audit_entry({"changed_fields": ["notice_text"]}, action="settings.update", entry_id=12),
        audit_entry({"version": "v1"}, action="rule.draft_create", target_id="1", entry_id=11),
    ]
    db = FakeAuditDb(rows)

    response = await list_admin_audit(limit=2, offset=5, _user=None, db=db)

    page = response.data
    assert page["limit"] == 2
    assert page["offset"] == 5
    assert page["has_more"] is True
    assert [entry["id"] for entry in page["entries"]] == [13, 12]
    assert all(set(entry) == {
        "id", "actor_admin_id", "action", "target_id", "change_summary", "occurred_at"
    } for entry in page["entries"])
    assert "rule.draft_create" not in json.dumps(page["entries"])

    statement = db.statement
    assert statement._limit_clause.value == 3
    assert statement._offset_clause.value == 5
    sql = str(statement.compile(compile_kwargs={"literal_binds": True})).lower()
    assert "order by" in sql and "occurred_at desc" in sql and "id desc" in sql
    for action in _VISIBLE_ADMIN_AUDIT_ACTIONS:
        assert f"'{action}'" in sql
