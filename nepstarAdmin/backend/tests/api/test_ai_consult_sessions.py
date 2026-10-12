"""匿名会话隔离契约；只用内存报告与 nepstar 假会话，不连接数据库。"""

import hashlib
import json
from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi import FastAPI, HTTPException
from httpx import ASGITransport, AsyncClient

from app.api import ai_consult
from app.config import settings
from app.models.new.sa_ai_consult import SAAiConsultConsent, SAAiConsultSession
from app.security.ai_consult_access import build_guest_context
from app.services.ai_consult_consent import public_data_scope_text


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
        self.turns = []
        self.generations = []
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
            if "last_activity_at <" in sql:
                cursor_time = params["last_activity_at_1"]
                cursor_id = params["id_1"]
                matches = [s for s in matches if (s.last_activity_at, s.id) < (cursor_time, cursor_id)]
            elif "id_1" in params:
                matches = [s for s in matches if s.id == params["id_1"]]
            matches = [s for s in matches if s.status == "active" and s.deleted_at is None and s.expires_at > datetime.now(UTC).replace(tzinfo=None)]
            matches.sort(key=lambda item: (item.last_activity_at, item.id), reverse=True)
            if len(statement.selected_columns) == 1 and statement.selected_columns[0].name == "id":
                return FakeResult([matches[0].id] if matches else [])
            if "param_1" in params or "limit_1" in params:
                matches = matches[:params.get("param_1", params.get("limit_1"))]
            return FakeResult(matches)
        if "FROM nepstar.sa_ai_consult_turn" in sql:
            if "session_id_1" not in params:
                return FakeResult([])
            matches = [t for t in self.turns if t.session_id == params["session_id_1"]]
            if "id_1" in params:
                matches = [t for t in matches if t.id == params["id_1"]]
            matches.sort(key=lambda item: item.sequence, reverse=True)
            if "param_1" in params or "limit_1" in params:
                matches = matches[:params.get("param_1", params.get("limit_1"))]
            return FakeResult(matches)
        if "FROM nepstar.sa_ai_consult_generation" in sql:
            if "attempt_number DESC" in sql and "turn_id_1" in params:
                matches = [g for g in self.generations if g.turn_id == params["turn_id_1"]]
                matches.sort(key=lambda item: item.attempt_number, reverse=True)
                return FakeResult([matches[0].id] if matches else [])
            latest = {}
            for generation in self.generations:
                if generation.turn_id not in latest or generation.attempt_number > latest[generation.turn_id].attempt_number:
                    latest[generation.turn_id] = generation
            return FakeResult([(turn_id, generation.id) for turn_id, generation in latest.items()])
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
    monkeypatch.setattr(settings, "AI_CONSULT_OPERATIONS_READY", True)
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
            data_scope_hash=hashlib.sha256(public_data_scope_text(policy).encode()).hexdigest(),
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
async def test_session_creation_uses_a_real_report_without_requiring_a_consent_row(isolated_sessions):
    app, db, loader, first_token, _ = isolated_sessions
    db.consents.clear()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        created = await client.post("/api/v1/ai-consult/sessions", headers=auth(first_token), json={"report_code": "R1", "source": "home"})
    assert created.status_code == 200
    assert len(db.sessions) == 1
    assert db.sessions[0].consent_id is None
    assert db.sessions[0].customer_id == 1001
    loader.assert_awaited_once()


@pytest.mark.asyncio
async def test_session_creation_respects_explicit_withdrawal_and_disabled_settings(isolated_sessions):
    app, db, _, first_token, _ = isolated_sessions
    db.consents[0].choice = "withdrawn"
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        withdrawn = await client.post("/api/v1/ai-consult/sessions", headers=auth(first_token), json={"report_code": "R1", "source": "home"})
        db.consents.clear()
        db.policy.enabled = False
        disabled = await client.post("/api/v1/ai-consult/sessions", headers=auth(first_token), json={"report_code": "R1", "source": "home"})
    assert withdrawn.status_code == 403
    assert withdrawn.json()["message"] == "consult.processing_withdrawn"
    assert disabled.status_code == 503
    assert db.sessions == []


@pytest.mark.asyncio
async def test_maintenance_blocks_new_session_even_with_existing_consent(isolated_sessions):
    app, db, _, first_token, _ = isolated_sessions
    db.policy.maintenance_text = "服务维护中。"
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        result = await client.post(
            "/api/v1/ai-consult/sessions",
            headers=auth(first_token),
            json={"report_code": "R1", "source": "home"},
        )
    assert result.status_code == 503
    assert result.json()["message"] == "consult.maintenance"
    assert db.sessions == []


@pytest.mark.asyncio
async def test_history_list_and_session_detail_are_unavailable_to_every_report_visitor(isolated_sessions):
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
    assert db.sessions[0].consent_id is None
    assert db.sessions[0].report_date.isoformat() == "2026-10-08"
    assert db.sessions[0].expires_at <= db.guests[0].expires_at
    assert first_list.status_code == second_list.status_code == 410
    assert private_detail.status_code == own_detail.status_code == 410
    assert all(response.json()["message"] == "consult.history_unavailable"
               for response in (first_list, second_list, private_detail, own_detail))
    # The new list and detail routes return 410 without querying the session table.
    assert not any("FROM nepstar.sa_ai_consult_session" in str(query) for query in db.queries)


@pytest.mark.asyncio
async def test_history_cursor_endpoint_is_removed(isolated_sessions):
    app, _, _, first_token, _ = isolated_sessions
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        first = await client.get("/api/v1/ai-consult/sessions?report_code=R1", headers=auth(first_token))
        cursor = await client.get("/api/v1/ai-consult/sessions?report_code=R1&cursor=YWJj", headers=auth(first_token))
        malformed = await client.get("/api/v1/ai-consult/sessions?report_code=R1&cursor=bad!", headers=auth(first_token))
    assert first.status_code == cursor.status_code == malformed.status_code == 410
    assert {first.json()["message"], cursor.json()["message"], malformed.json()["message"]} == {"consult.history_unavailable"}


@pytest.mark.asyncio
async def test_session_detail_never_restores_any_saved_turns(isolated_sessions):
    app, db, _, first_token, second_token = isolated_sessions
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        created = await client.post("/api/v1/ai-consult/sessions", headers=auth(first_token), json={"report_code": "R1", "source": "home"})
        session_id = created.json()["data"]["id"]
        now = datetime.now(UTC).replace(tzinfo=None)
        db.turns.extend([
            SimpleNamespace(id=1, session_id=session_id, sequence=1, question_text="呼吸睡眠怎么样？",
                            status="completed", answer_text="该指标结果可结合报告理解。",
                            evidence_refs_json=json.dumps([{"id": "ev1", "kind": "report", "label": "呼吸睡眠"}]),
                            feedback_value="helpful", feedback_reason=None, created_at=now),
            SimpleNamespace(id=2, session_id=session_id, sequence=2, question_text="再说说？",
                            status="failed", answer_text="不应展示的草稿", evidence_refs_json=None,
                            feedback_value=None, feedback_reason=None, created_at=now),
            SimpleNamespace(id=3, session_id="another-session", sequence=1, question_text="其他人的提问",
                            status="completed", answer_text="其他人的回答", evidence_refs_json="[]",
                            feedback_value="unhelpful", feedback_reason="unclear", created_at=now),
        ])
        db.generations.extend([
            SimpleNamespace(id=11, turn_id=1, attempt_number=1),
            SimpleNamespace(id=12, turn_id=2, attempt_number=1),
            SimpleNamespace(id=13, turn_id=2, attempt_number=2),
        ])
        denied = await client.get(f"/api/v1/ai-consult/sessions/{session_id}?report_code=R1", headers=auth(second_token))
        own = await client.get(f"/api/v1/ai-consult/sessions/{session_id}?report_code=R1", headers=auth(first_token))
    assert denied.status_code == own.status_code == 410
    assert "其他人的提问" not in own.text
    turn_queries = [str(query) for query in db.queries if "FROM nepstar.sa_ai_consult_turn" in str(query)]
    assert turn_queries == []


@pytest.mark.asyncio
async def test_single_turn_read_can_recover_an_older_turn_without_cross_guest_or_draft_leaks(isolated_sessions):
    app, db, _, first_token, second_token = isolated_sessions
    now = datetime.now(UTC).replace(tzinfo=None)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        created = await client.post("/api/v1/ai-consult/sessions", headers=auth(first_token), json={"report_code": "R1", "source": "home"})
        previous_session_id = created.json()["data"]["id"]
        current = await client.post("/api/v1/ai-consult/sessions", headers=auth(first_token), json={"report_code": "R1", "source": "home"})
        session_id = current.json()["data"]["id"]
        foreign = await client.post("/api/v1/ai-consult/sessions", headers=auth(second_token), json={"report_code": "R1", "source": "home"})
        foreign_id = foreign.json()["data"]["id"]
        db.turns.extend([
            SimpleNamespace(
                id=index, session_id=session_id, sequence=index, question_text=f"问题{index}",
                status="completed" if index == 1 else "failed",
                answer_text="已核对回答" if index == 1 else "不可泄露的草稿",
                evidence_refs_json=json.dumps([{"id": "ev1", "kind": "report"}]) if index == 1 else None,
                feedback_value="helpful" if index == 1 else None,
                feedback_reason=None, created_at=now,
            ) for index in range(1, 102)
        ])
        db.generations.extend([
            SimpleNamespace(id=201, turn_id=1, attempt_number=1),
            SimpleNamespace(id=202, turn_id=2, attempt_number=1),
            SimpleNamespace(id=203, turn_id=2, attempt_number=2),
        ])
        detail = await client.get(f"/api/v1/ai-consult/sessions/{session_id}?report_code=R1", headers=auth(first_token))
        old_turn = await client.get(f"/api/v1/ai-consult/sessions/{session_id}/turns/1?report_code=R1", headers=auth(first_token))
        previous_session_turn = await client.get(f"/api/v1/ai-consult/sessions/{previous_session_id}/turns/1?report_code=R1", headers=auth(first_token))
        failed_turn = await client.get(f"/api/v1/ai-consult/sessions/{session_id}/turns/2?report_code=R1", headers=auth(first_token))
        other_guest = await client.get(f"/api/v1/ai-consult/sessions/{session_id}/turns/1?report_code=R1", headers=auth(second_token))
        other_session = await client.get(f"/api/v1/ai-consult/sessions/{foreign_id}/turns/1?report_code=R1", headers=auth(first_token))
        wrong_report = await client.get(f"/api/v1/ai-consult/sessions/{session_id}/turns/1?report_code=R2", headers=auth(first_token))
        missing = await client.get(f"/api/v1/ai-consult/sessions/{session_id}/turns/999?report_code=R1", headers=auth(first_token))
        missing_token = await client.get(f"/api/v1/ai-consult/sessions/{session_id}/turns/1?report_code=R1")
        invalid_id = await client.get(f"/api/v1/ai-consult/sessions/{session_id}/turns/0?report_code=R1", headers=auth(first_token))
        db.guests[0].revoked_at = now
        revoked = await client.get(f"/api/v1/ai-consult/sessions/{session_id}/turns/1?report_code=R1", headers=auth(first_token))
        db.guests[0].revoked_at = None
        db.consents[0].withdrawn_at = now
        withdrawn = await client.get(f"/api/v1/ai-consult/sessions/{session_id}/turns/1?report_code=R1", headers=auth(first_token))
        db.consents[0].withdrawn_at = None
        current_session = next(item for item in db.sessions if item.id == session_id)
        current_session.status = "deleted"
        current_session.deleted_at = now
        deleted = await client.get(f"/api/v1/ai-consult/sessions/{session_id}/turns/1?report_code=R1", headers=auth(first_token))

    assert detail.status_code == 410
    assert old_turn.status_code == 200 and old_turn.headers["Cache-Control"] == "no-store"
    assert old_turn.json()["data"]["id"] == 1
    assert old_turn.json()["data"]["generation_id"] == 201
    assert old_turn.json()["data"]["answer"] == "已核对回答"
    assert old_turn.json()["data"]["evidence"] == [{"id": "ev1", "kind": "report"}]
    assert failed_turn.json()["data"]["generation_id"] == 203
    assert failed_turn.json()["data"]["status"] == "incomplete"
    assert failed_turn.json()["data"]["answer"] is None
    assert "不可泄露的草稿" not in failed_turn.text
    assert previous_session_turn.status_code == 404
    assert other_guest.status_code == other_session.status_code == missing.status_code == deleted.status_code == 404
    assert wrong_report.status_code == withdrawn.status_code == 403
    assert missing_token.status_code == 401 and invalid_id.status_code == 404 and revoked.status_code == 403
    scoped_queries = [str(query) for query in db.queries if "FROM nepstar.sa_ai_consult_turn" in str(query)]
    assert all("session_id" in query for query in scoped_queries)


@pytest.mark.asyncio
async def test_withdrawn_consent_cannot_read_the_current_turn(isolated_sessions):
    app, db, _, first_token, _ = isolated_sessions
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        created = await client.post("/api/v1/ai-consult/sessions", headers=auth(first_token), json={"report_code": "R1", "source": "home"})
        session_id = created.json()["data"]["id"]
        db.consents[0].withdrawn_at = datetime.now(UTC).replace(tzinfo=None)
        denied = await client.get(f"/api/v1/ai-consult/sessions/{session_id}/turns/1?report_code=R1", headers=auth(first_token))
    assert denied.status_code == 403
    assert denied.json()["message"] == "consult.processing_withdrawn"
    assert not any("FROM nepstar.sa_ai_consult_turn" in str(query) for query in db.queries)


@pytest.mark.asyncio
async def test_delete_endpoint_cannot_remove_permanently_retained_conversation(isolated_sessions):
    app, db, _, first_token, _ = isolated_sessions
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        created = await client.post("/api/v1/ai-consult/sessions", headers=auth(first_token), json={"report_code": "R1", "source": "home"})
        session_id = created.json()["data"]["id"]
        path = f"/api/v1/ai-consult/sessions/{session_id}?report_code=R1"
        deleted = await client.delete(path, headers=auth(first_token))
    assert deleted.status_code == 410
    assert deleted.json()["message"] == "consult.history_unavailable"
    assert db.sessions[0].status == "active" and db.sessions[0].deleted_at is None
    assert db.sessions[0].generation_epoch == 0


@pytest.mark.asyncio
async def test_delete_endpoint_stays_disabled_even_when_consult_service_is_disabled(isolated_sessions, monkeypatch):
    app, db, _, first_token, _ = isolated_sessions
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        created = await client.post("/api/v1/ai-consult/sessions", headers=auth(first_token), json={"report_code": "R1", "source": "home"})
        session_id = created.json()["data"]["id"]
        monkeypatch.setattr(settings, "AI_CONSULT_GUEST_ENABLED", False)
        monkeypatch.setattr(settings, "AI_CONSULT_SESSIONS_ENABLED", False)
        deleted = await client.delete(f"/api/v1/ai-consult/sessions/{session_id}?report_code=R1", headers=auth(first_token))
    assert deleted.status_code == 410
    assert db.sessions[0].deleted_at is None


@pytest.mark.asyncio
async def test_cross_report_and_unvalidated_plan_requests_do_not_create_sessions(isolated_sessions):
    app, db, loader, first_token, _ = isolated_sessions
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        wrong_report = await client.post("/api/v1/ai-consult/sessions", headers=auth(first_token), json={"report_code": "R2", "source": "home"})
        wrong_list = await client.get("/api/v1/ai-consult/sessions?report_code=R2", headers=auth(first_token))
        plan = await client.post("/api/v1/ai-consult/sessions", headers=auth(first_token), json={"report_code": "R1", "source": "plan", "plan_id": 9})
    assert wrong_report.status_code == 403
    assert wrong_list.status_code == 410
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
