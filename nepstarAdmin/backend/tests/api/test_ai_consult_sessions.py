"""匿名会话隔离契约；只用内存报告与 nepstar 假会话，不连接数据库。"""

import hashlib
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi import FastAPI, HTTPException
from httpx import ASGITransport, AsyncClient

from app.api import ai_consult
from app.config import settings
from app.models.new.sa_ai_consult import SAAiConsultConsent, SAAiConsultSession
from app.security.ai_consult_access import build_guest_context


class FakeResult:
    def __init__(self, rows):
        self.rows = rows

    def scalar_one_or_none(self):
        return self.rows[0] if self.rows else None

    def scalars(self):
        return self

    def all(self):
        return self.rows


class FakeTransaction:
    def __init__(self, db):
        self.db = db

    async def __aenter__(self):
        return self.db

    async def __aexit__(self, exc_type, exc, tb):
        if exc_type is None:
            self.db.sessions.extend(self.db.pending)
        self.db.pending.clear()
        return False


class FakeWriteDb:
    def __init__(self, guests, policy, consents):
        self.guests = guests
        self.policy = policy
        self.consents = consents
        self.sessions = []
        self.pending = []
        self.queries = []

    async def execute(self, statement):
        self.queries.append(statement)
        sql = str(statement)
        params = statement.compile().params
        if "FROM nepstar.sa_ai_consult_guest" in sql:
            return FakeResult([g for g in self.guests if g.token_digest == params.get("token_digest_1")])
        if "FROM nepstar.sa_ai_consult_settings" in sql:
            return FakeResult([self.policy])
        if "FROM nepstar.sa_ai_consult_consent" in sql:
            matches = [c for c in self.consents if c.guest_id == params.get("guest_id_1")]
            return FakeResult(matches[-1:])
        if "FROM nepstar.sa_ai_consult_session" in sql:
            # Without BOTH guest and report predicates the fake refuses to return rows.
            if "guest_id_1" not in params or "report_code_1" not in params:
                return FakeResult([])
            matches = [s for s in self.sessions if s.guest_id == params["guest_id_1"] and s.report_code == params["report_code_1"]]
            if "id_1" in params:
                matches = [s for s in matches if s.id == params["id_1"]]
            matches = [s for s in matches if s.status == "active" and s.deleted_at is None and s.expires_at > datetime.now(UTC).replace(tzinfo=None)]
            return FakeResult(matches)
        raise AssertionError(f"Unexpected query: {sql}")

    def add(self, row):
        self.pending.append(row)

    def begin(self):
        return FakeTransaction(self)

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False


class FakeReadDb:
    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False


@pytest.fixture
def isolated_sessions(monkeypatch):
    monkeypatch.setattr(settings, "AI_CONSULT_GUEST_ENABLED", True)
    monkeypatch.setattr(settings, "AI_CONSULT_SESSIONS_ENABLED", True, raising=False)
    monkeypatch.setattr(settings, "AI_CONSULT_TOKEN_HMAC_KEY", "session-test-hmac-key-" * 3)
    first_token, first = build_guest_context("R1", 1001)
    second_token, second = build_guest_context("R1", 1001)
    first.id, second.id = 1, 2
    scope_text = "仅使用当前报告和问题。"
    notice_text = "假数据处理告知。"
    policy = SimpleNamespace(
        enabled=True,
        notice_version="v1",
        notice_text=notice_text,
        provider_code="fake-provider",
        data_scope_text=scope_text,
        data_scope_hash=hashlib.sha256(scope_text.encode()).hexdigest(),
    )
    consents = [
        SAAiConsultConsent(
            id=10 + guest.id,
            guest_id=guest.id,
            notice_version="v1",
            notice_content_hash=hashlib.sha256(notice_text.encode()).hexdigest(),
            provider_code="fake-provider",
            data_scope_hash=policy.data_scope_hash,
            choice="granted",
            decided_at=datetime.now(UTC).replace(tzinfo=None),
        )
        for guest in (first, second)
    ]
    db = FakeWriteDb([first, second], policy, consents)
    loader = AsyncMock(return_value={"report": {"report_code": "R1", "report_date": "2026-10-08", "total_score": 82}, "systems": []})
    monkeypatch.setattr(ai_consult, "get_ai_consult_sessionmaker", lambda: lambda: db)
    monkeypatch.setattr(ai_consult, "async_session", FakeReadDb)
    monkeypatch.setattr(ai_consult, "load_public_report_home", loader)
    app = FastAPI()
    app.include_router(ai_consult.router, prefix="/api/v1")
    return app, db, loader, first_token, second_token


def auth(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_session_creation_requires_current_consent_and_a_real_report(isolated_sessions):
    app, db, loader, first_token, _ = isolated_sessions
    db.consents.clear()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        denied = await client.post("/api/v1/ai-consult/sessions", headers=auth(first_token), json={"report_code": "R1", "source": "home"})
    assert denied.status_code == 403
    assert denied.json()["message"] == "consult.consent_required"
    assert db.sessions == []
    loader.assert_awaited_once()


@pytest.mark.asyncio
async def test_two_guests_on_one_report_cannot_list_or_read_each_others_sessions(isolated_sessions):
    app, db, _, first_token, second_token = isolated_sessions
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        created = await client.post("/api/v1/ai-consult/sessions", headers=auth(first_token), json={"report_code": "R1", "source": "home"})
        first_list = await client.get("/api/v1/ai-consult/sessions?report_code=R1", headers=auth(first_token))
        second_list = await client.get("/api/v1/ai-consult/sessions?report_code=R1", headers=auth(second_token))
        session_id = created.json()["data"]["id"]
        private_detail = await client.get(f"/api/v1/ai-consult/sessions/{session_id}?report_code=R1", headers=auth(second_token))
        own_detail = await client.get(f"/api/v1/ai-consult/sessions/{session_id}?report_code=R1", headers=auth(first_token))

    assert created.status_code == 200
    assert db.sessions[0].guest_id == 1
    assert db.sessions[0].consent_id == 11
    assert db.sessions[0].report_date.isoformat() == "2026-10-08"
    assert db.sessions[0].expires_at <= db.guests[0].expires_at
    assert len(first_list.json()["data"]["sessions"]) == 1
    assert second_list.json()["data"]["sessions"] == []
    assert private_detail.status_code == 404
    assert own_detail.status_code == 200
    assert own_detail.json()["data"]["turns"] == []
    assert "customer_id" not in own_detail.json()["data"]
    assert "token" not in str(own_detail.json()["data"])
    session_queries = [str(query) for query in db.queries if "FROM nepstar.sa_ai_consult_session" in str(query)]
    assert session_queries
    assert all("guest_id" in query and "report_code" in query for query in session_queries)
    assert all("deleted_at IS NULL" in query and "expires_at >" in query for query in session_queries)


@pytest.mark.asyncio
async def test_cross_report_and_unvalidated_plan_requests_do_not_create_sessions(isolated_sessions):
    app, db, loader, first_token, _ = isolated_sessions
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        wrong_report = await client.post("/api/v1/ai-consult/sessions", headers=auth(first_token), json={"report_code": "R2", "source": "home"})
        wrong_list = await client.get("/api/v1/ai-consult/sessions?report_code=R2", headers=auth(first_token))
        plan = await client.post("/api/v1/ai-consult/sessions", headers=auth(first_token), json={"report_code": "R1", "source": "plan", "plan_id": 9})
    assert wrong_report.status_code == wrong_list.status_code == 403
    assert plan.status_code in (409, 422)
    assert db.sessions == []
    loader.assert_not_awaited()


@pytest.mark.asyncio
async def test_missing_or_revoked_token_and_report_failure_fail_closed(isolated_sessions):
    app, db, loader, first_token, _ = isolated_sessions
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        missing = await client.post("/api/v1/ai-consult/sessions", json={"report_code": "R1", "source": "home"})
        db.guests[0].revoked_at = datetime.now(UTC).replace(tzinfo=None)
        revoked = await client.post("/api/v1/ai-consult/sessions", headers=auth(first_token), json={"report_code": "R1", "source": "home"})
        db.guests[0].revoked_at = None
        loader.side_effect = HTTPException(status_code=503, detail="consult.report_unavailable")
        source_failed = await client.post("/api/v1/ai-consult/sessions", headers=auth(first_token), json={"report_code": "R1", "source": "home"})
    assert missing.status_code == 401
    assert revoked.status_code == 403
    assert source_failed.status_code == 503
    assert db.sessions == []


@pytest.mark.asyncio
async def test_session_routes_stay_disabled_without_a_separate_switch(isolated_sessions, monkeypatch):
    app, db, loader, first_token, _ = isolated_sessions
    monkeypatch.setattr(settings, "AI_CONSULT_SESSIONS_ENABLED", False, raising=False)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        denied = await client.post("/api/v1/ai-consult/sessions", headers=auth(first_token), json={"report_code": "R1", "source": "home"})
    assert denied.status_code == 503
    assert db.sessions == []
    loader.assert_not_awaited()
