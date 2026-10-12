"""Operational metrics use in-memory results, never a real database."""

from datetime import UTC, datetime, timedelta, timezone
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.api import ai_consult_admin
from app.security import ai_consult_admin_permission as permission
from app.security.ai_consult_admin_permission import (
    AI_CONSULT_ADMIN_ACTIONS,
    AI_CONSULT_OPERATIONS_API_ROUTE,
    AI_CONSULT_OVERVIEW_ROUTE,
)
from app.services.ai_consult_operations import load_operations_summary


class FakeDb:
    def __init__(self, rows, sessions=0):
        self.rows = iter(rows)
        self.sessions = sessions
        self.queries = []

    async def execute(self, statement):
        sql = str(statement)
        self.queries.append(sql)
        return SimpleNamespace(
            one=lambda: next(self.rows),
            all=lambda: next(self.rows),
        )

    async def scalar(self, statement):
        self.queries.append(str(statement))
        return self.sessions


@pytest.mark.asyncio
async def test_operations_counts_use_reserved_cost_and_never_select_content():
    db = FakeDb([
        (3, 2, datetime(2026, 10, 9, 8, 55)),
        (12, 7, 2, 45678, 2_350_000),
        (9, 4, 1),
        [("worker_timeout", 1), ("unsafe_answer", 1)],
    ], sessions=5)
    result = await load_operations_summary(
        db, now=datetime(2026, 10, 9, 9, 0, tzinfo=UTC),
    )
    assert result == {
        "day_utc": "2026-10-09",
        "generated_at": "2026-10-09T09:00:00Z",
        "running": 3,
        "stale_running": 2,
        "stale_after_seconds": 180,
        "oldest_stale_seconds": 300,
        "today_attempts": 12,
        "today_sessions": 5,
        "today_questions": 9,
        "today_completed": 7,
        "today_failed": 2,
        "completion_rate_percent": 77.8,
        "average_first_answer_seconds": 2.4,
        "today_charged_tokens": 45678,
        "today_helpful_feedback": 4,
        "today_unhelpful_feedback": 1,
        "today_failure_reasons": [
            {"category": "worker_timeout", "count": 1},
            {"category": "unsafe_answer", "count": 1},
        ],
    }
    assert len(db.queries) == 5
    assert all("nepstar.sa_ai_consult_" in sql for sql in db.queries)
    assert all("question_text" not in sql and "answer_text" not in sql for sql in db.queries)
    assert "budget_tokens" in db.queries[1]
    assert AI_CONSULT_ADMIN_ACTIONS[("GET", AI_CONSULT_OPERATIONS_API_ROUTE)] == (
        AI_CONSULT_OVERVIEW_ROUTE, "view"
    )
    assert ("PUT", AI_CONSULT_OPERATIONS_API_ROUTE) not in AI_CONSULT_ADMIN_ACTIONS


@pytest.mark.asyncio
async def test_empty_operations_are_zero_not_false_health_claim():
    db = FakeDb([(0, 0, None), (0, 0, 0, 0, None), (0, 0, 0), []])
    result = await load_operations_summary(db, now=datetime(2026, 10, 9, 0, 0))
    assert result["stale_running"] == 0
    assert result["oldest_stale_seconds"] is None
    assert result["today_failure_reasons"] == []
    assert result["completion_rate_percent"] is None
    assert result["average_first_answer_seconds"] is None


@pytest.mark.asyncio
async def test_operations_day_uses_utc_not_browser_local_day():
    db = FakeDb([(0, 0, None), (0, 0, 0, 0, None), (0, 0, 0), []])
    result = await load_operations_summary(
        db, now=datetime(2026, 10, 10, 1, 0, tzinfo=timezone(timedelta(hours=8)))
    )
    assert result["day_utc"] == "2026-10-09"
    assert result["generated_at"] == "2026-10-09T17:00:00Z"


@pytest.mark.asyncio
async def test_operations_endpoint_masks_storage_failure(monkeypatch):
    async def fail(_db):
        raise RuntimeError("internal connection details")

    monkeypatch.setattr(ai_consult_admin, "load_operations_summary", fail)
    response = await ai_consult_admin.get_operations(_user=object(), db=object())
    assert response.status_code == 503
    assert b"internal connection details" not in response.body


@pytest.mark.asyncio
async def test_overview_view_permission_does_not_grant_settings_edit(monkeypatch):
    async def not_admin(_user_id, _db):
        return False

    monkeypatch.setattr(permission, "is_admin", not_admin)

    class AuthDb:
        async def execute(self, statement):
            sql = str(statement)
            params = statement.compile().params
            if "FROM nepstar.sa_menu" in sql:
                menu = SimpleNamespace(id=5) if params.get("route_path_1") == AI_CONSULT_OVERVIEW_ROUTE else None
                return SimpleNamespace(scalar_one_or_none=lambda: menu)
            if "FROM nepstar.sa_user_role" in sql:
                return SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: [7]))
            if "FROM nepstar.sa_role_menu" in sql:
                return SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: ["view"]))
            raise AssertionError(sql)

    user = SimpleNamespace(id=2)
    db = AuthDb()
    overview = SimpleNamespace(
        method="GET", scope={"route": SimpleNamespace(path=AI_CONSULT_OPERATIONS_API_ROUTE)}
    )
    assert await permission.require_ai_consult_system_admin(
        overview, user=user, auth_db=db
    ) is user
    settings_update = SimpleNamespace(
        method="PUT", scope={"route": SimpleNamespace(path=permission.AI_CONSULT_SETTINGS_API_ROUTE)}
    )
    with pytest.raises(HTTPException) as exc:
        await permission.require_ai_consult_system_admin(
            settings_update, user=user, auth_db=db
        )
    assert exc.value.status_code == 403
