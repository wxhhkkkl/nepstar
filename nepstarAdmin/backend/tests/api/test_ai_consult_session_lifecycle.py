"""Session endings and idle boundaries on isolated SQLite; no external services."""

from contextlib import asynccontextmanager
from datetime import UTC, date, datetime, timedelta

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.orm import Session

from test_ai_consult_admin import admin_app, MemorySession
from app.api import ai_consult
from app.config import settings
from app.models.new.sa_ai_consult import (
    SAAiConsultGeneration as Generation, SAAiConsultSession as Chat,
    SAAiConsultTurn as Turn,
)
from app.security.ai_consult_access import build_guest_context
from app.services.ai_consult_admin_history import list_sessions
from app.services.ai_consult_sessions import get_guest_session, new_home_session, is_latest_guest_session
from app.services.ai_consult_turns import finalize_turn, TurnConflict, TurnStart
from app.services.ai_consult_pipeline import CandidateOutcome

ID = "00000000-0000-4000-8000-000000000001"


@pytest.fixture
def lifecycle(admin_app, monkeypatch):
    app, engine, _, _ = admin_app
    monkeypatch.setattr(settings, "AI_CONSULT_TOKEN_HMAC_KEY", "lifecycle-only-test-hmac-key-" * 3)
    token, guest = build_guest_context("SYNTHETIC-R1", 101)
    other_token, other = build_guest_context("SYNTHETIC-R1", 101)
    now = datetime.now(UTC).replace(tzinfo=None)
    with Session(engine) as db:
        guest.id, other.id = 1, 2
        db.add_all([guest, other])
        chat = new_home_session(guest, None, date(2026, 10, 12), now=now)
        chat.id, chat.generation_epoch = ID, 2
        db.add(chat)
        db.add_all([
            Turn(id=1, session_id=ID, sequence=1, client_request_id="question-1",
                 question_text="Synthetic question", answer_text="Saved reviewed answer",
                 status="completed", created_at=now),
            Turn(id=2, session_id=ID, sequence=2, client_request_id="question-2",
                 question_text="Synthetic follow-up", status="running", created_at=now),
            Generation(id=1, turn_id=1, attempt_number=1, generation_epoch=1,
                       status="completed", started_at=now, prompt_tokens=10, completion_tokens=5),
            Generation(id=2, turn_id=2, attempt_number=1, generation_epoch=2,
                       status="running", started_at=now, budget_tokens=100),
        ])
        db.commit()

    @asynccontextmanager
    async def writer():
        with Session(engine, expire_on_commit=False) as db:
            yield MemorySession(db)

    monkeypatch.setattr(ai_consult, "get_ai_consult_sessionmaker", lambda: writer)
    app.include_router(ai_consult.router, prefix="/api/v1")
    return app, engine, token, other_token, now


@pytest.mark.asyncio
async def test_exit_ends_owned_session_idempotently_and_fences_late_answers(lifecycle, monkeypatch):
    app, engine, token, _, _ = lifecycle
    for gate in ("GUEST_ENABLED", "SESSIONS_ENABLED", "ANSWERS_ENABLED", "OPERATIONS_READY"):
        monkeypatch.setattr(settings, "AI_CONSULT_" + gate, False)
    url = f"/api/v1/ai-consult/sessions/{ID}/end?report_code=SYNTHETIC-R1"
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        first = await client.post(url, headers={"Authorization": f"Bearer {token}"})
        second = await client.post(url, headers={"Authorization": f"Bearer {token}"})
    assert first.status_code == second.status_code == 200
    assert first.json()["data"] == {"id": ID, "status": "ended"}
    with Session(engine) as db:
        chat, turn, gen = db.get(Chat, ID), db.get(Turn, 2), db.get(Generation, 2)
        assert chat.status == "ended" and chat.generation_epoch == 3
        assert turn.status == gen.status == "stopped" and gen.error_category == "session_ended"
        assert gen.budget_tokens == 100 and gen.prompt_tokens is None
        assert db.get(Turn, 1).answer_text == "Saved reviewed answer"
        assert db.get(Generation, 1).status == "completed"
        with pytest.raises(TurnConflict):
            await finalize_turn(MemorySession(db), chat, TurnStart(2, 2, 2, False, "running"),
                                CandidateOutcome("reviewed_candidate", "Late answer", [{}], "system"))
        assert (await list_sessions(MemorySession(db), state="ended"))["total"] == 1


@pytest.mark.asyncio
async def test_exit_checks_credentials_and_exact_guest_report_ownership(lifecycle):
    app, engine, token, other, _ = lifecycle
    base = f"/api/v1/ai-consult/sessions/{ID}/end"
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        assert (await client.post(base + "?report_code=SYNTHETIC-R1")).status_code == 401
        assert (await client.post(base + "?report_code=SYNTHETIC-R1", headers={"Authorization": f"Bearer {other}"})).status_code == 404
        assert (await client.post(base + "?report_code=SYNTHETIC-R2", headers={"Authorization": f"Bearer {token}"})).status_code == 403
    with Session(engine) as db:
        assert db.get(Chat, ID).status == "active"
        assert db.get(Generation, 2).status == "running"


@pytest.mark.asyncio
async def test_ten_minute_deadline_is_independent_of_answer_outcome(lifecycle):
    _, engine, _, _, started = lifecycle
    with Session(engine) as db:
        adapter = MemorySession(db)
        # A failed last answer remains an ongoing conversation before the deadline.
        db.get(Turn, 2).status = "failed"
        db.get(Generation, 2).status = "failed"
        db.flush()
        before = await list_sessions(adapter, now=started + timedelta(minutes=10, microseconds=-1))
        at_boundary = await list_sessions(adapter, now=started + timedelta(minutes=10))
        assert before["records"][0]["state"] == "active"
        assert at_boundary["records"][0]["state"] == "ended"
        assert (await list_sessions(adapter, state="ended", now=started + timedelta(minutes=10)))["total"] == 1
        db.get(Chat, ID).last_activity_at = datetime.now(UTC).replace(tzinfo=None) - timedelta(minutes=10)
        db.flush()
        assert await get_guest_session(adapter, type("Guest", (), {"id": 1})(), "SYNTHETIC-R1", ID) is None


@pytest.mark.asyncio
async def test_unasked_session_remains_empty_and_ended_newer_session_does_not_reopen_old_history(lifecycle):
    _, engine, _, _, now = lifecycle
    with Session(engine) as db:
        newer = Chat(id="00000000-0000-4000-8000-000000000002", guest_id=1,
                     report_code="SYNTHETIC-R1", customer_id=101, report_date=date(2026, 10, 12),
                     source="home", status="ended", created_at=now + timedelta(seconds=1),
                     last_activity_at=now, expires_at=now + timedelta(days=1))
        db.add(newer)
        db.flush()
        adapter = MemorySession(db)
        assert (await list_sessions(adapter, state="empty", now=now + timedelta(hours=1)))["total"] == 1
        assert not await is_latest_guest_session(adapter, type("Guest", (), {"id": 1})(), "SYNTHETIC-R1", ID)


@pytest.mark.asyncio
async def test_successful_answer_does_not_extend_the_last_question_deadline(lifecycle):
    _, engine, _, _, now = lifecycle
    with Session(engine) as db:
        chat = db.get(Chat, ID)
        sent_at = now - timedelta(seconds=30)
        chat.last_activity_at = sent_at
        completed = await finalize_turn(
            MemorySession(db), chat, TurnStart(2, 2, 2, False, "running"),
            CandidateOutcome("reviewed_candidate", "Reviewed synthetic answer", [{"id": "ev1"}], "system",
                             prompt_tokens=10, completion_tokens=5),
        )
        assert completed and chat.last_activity_at == sent_at
        data = await list_sessions(MemorySession(db), now=sent_at + timedelta(minutes=10))
        assert data["records"][0]["state"] == "ended"
