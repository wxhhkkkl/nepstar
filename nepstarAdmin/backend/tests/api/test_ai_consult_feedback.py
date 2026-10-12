"""Feedback HTTP contract with in-memory nepstar substitutes only."""

from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.api import ai_consult
from app.config import settings
from app.security.ai_consult_access import GuestAccessDenied
from app.services.ai_consult_turns import FeedbackNotAllowed


class FakeDb:
    def begin(self):
        return self

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_args):
        return False


@pytest.fixture
def feedback_app(monkeypatch):
    for flag in ("AI_CONSULT_GUEST_ENABLED", "AI_CONSULT_SESSIONS_ENABLED", "AI_CONSULT_OPERATIONS_READY"):
        monkeypatch.setattr(settings, flag, True)
    db = FakeDb()
    turn = SimpleNamespace(id=7, status="completed", feedback_value=None, feedback_reason=None)
    state = SimpleNamespace(consent=True, turn=turn, calls=[])

    async def guest(_db, token, report_code):
        if token not in {"guest-1", "guest-2"} or report_code != "R1":
            raise GuestAccessDenied()
        return SimpleNamespace(id=1 if token == "guest-1" else 2)

    async def session(_db, owner, report_code, session_id, *, lock=False):
        state.calls.append(("session", owner.id, report_code, session_id, lock))
        if owner.id == 1 and report_code == "R1" and session_id == "session-1":
            return SimpleNamespace(id="session-1", consent_id=11)
        return None

    async def consent(_db, guest_id, *, lock=False):
        state.calls.append(("consent", guest_id, lock))
        return state.consent

    async def save(_db, session_id, turn_id, *, helpful, reason):
        state.calls.append(("save", session_id, turn_id))
        if turn_id != turn.id:
            return None
        if turn.status != "completed":
            raise FeedbackNotAllowed()
        turn.feedback_value = "helpful" if helpful else "unhelpful"
        turn.feedback_reason = None if helpful else reason
        return turn

    monkeypatch.setattr(ai_consult, "get_ai_consult_sessionmaker", lambda: lambda: db)
    monkeypatch.setattr(ai_consult, "require_guest", guest)
    monkeypatch.setattr(ai_consult, "get_guest_session", session)
    monkeypatch.setattr(ai_consult, "is_latest_guest_session", AsyncMock(return_value=True))
    monkeypatch.setattr(ai_consult, "consult_processing_allowed", consent)
    monkeypatch.setattr(ai_consult, "save_turn_feedback", save)
    app = FastAPI()
    app.include_router(ai_consult.router, prefix="/api/v1")
    return app, state


async def put(app, *, token="guest-1", report="R1", turn=7, body=None):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        return await client.put(
            f"/api/v1/ai-consult/sessions/session-1/turns/{turn}/feedback",
            params={"report_code": report},
            headers={"Authorization": f"Bearer {token}"} if token else {},
            json=body or {"helpful": True},
        )


@pytest.mark.asyncio
async def test_feedback_overwrites_previous_choice_without_returning_chat_content(feedback_app):
    app, state = feedback_app
    first = await put(app, body={"helpful": False, "reason": "unclear"})
    second = await put(app, body={"helpful": True})
    assert first.status_code == second.status_code == 200
    assert first.json()["data"] == {"turn_id": 7, "feedback_value": "unhelpful", "feedback_reason": "unclear"}
    assert second.json()["data"] == {"turn_id": 7, "feedback_value": "helpful", "feedback_reason": None}
    assert second.headers["cache-control"] == "no-store"
    assert state.calls.count(("save", "session-1", 7)) == 2
    assert "question" not in second.text and "answer" not in second.text


@pytest.mark.asyncio
async def test_feedback_rejects_other_guest_report_withdrawal_and_incomplete_turn(feedback_app):
    app, state = feedback_app
    assert (await put(app, token="guest-2")).status_code == 404
    assert (await put(app, report="R2")).status_code == 403
    assert (await put(app, turn=8)).status_code == 404
    state.consent = False
    assert (await put(app)).status_code == 403
    state.consent = True
    state.turn.status = "failed"
    assert (await put(app)).status_code == 409
    assert state.turn.feedback_value is None


@pytest.mark.asyncio
async def test_feedback_schema_accepts_only_strict_boolean_and_known_negative_reason(feedback_app):
    app, _ = feedback_app
    for body in (
        {"helpful": 1},
        {"helpful": False, "reason": "free text"},
        {"helpful": True, "reason": "unclear"},
        {"helpful": True, "extra": "private"},
    ):
        assert (await put(app, body=body)).status_code == 422
    assert (await put(app, token="")).status_code == 401


@pytest.mark.asyncio
async def test_old_session_cannot_update_feedback(feedback_app, monkeypatch):
    app, state = feedback_app
    monkeypatch.setattr(ai_consult, "is_latest_guest_session", AsyncMock(return_value=False))
    assert (await put(app)).status_code == 404
    assert not any(call[0] == "save" for call in state.calls)
