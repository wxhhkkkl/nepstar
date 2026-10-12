"""Abandoned generations are fenced with in-memory nepstar SQL substitutes."""

from datetime import datetime, timedelta
from types import SimpleNamespace

import pytest

from app.models.new.sa_ai_consult import SAAiConsultAdminAudit
from app.services import ai_consult_recovery as recovery
from app.services.ai_consult_pipeline import CandidateOutcome
from app.services.ai_consult_turns import TurnConflict, TurnStart, finalize_turn


class FakeResult:
    def __init__(self, rows):
        self.rows = rows

    def scalar_one_or_none(self):
        return self.rows[0] if self.rows else None

    def all(self):
        return self.rows

    def first(self):
        return self.rows[0] if self.rows else None


class FakeDb:
    def __init__(self, now):
        self.session = SimpleNamespace(id="session-1", generation_epoch=4)
        self.turn = SimpleNamespace(
            id=7, session_id="session-1", status="running", answer_text=None,
            evidence_refs_json=None, completed_at=None, question_text="私人问题",
        )
        self.generation = SimpleNamespace(
            id=8, turn_id=7, generation_epoch=4, status="running",
            started_at=now - timedelta(minutes=4), finished_at=None,
            partial_text="未经审核的草稿", error_category=None,
            budget_tokens=16384, prompt_tokens=None, completion_tokens=None,
        )
        self.audit = []
        self.queries = []

    async def execute(self, statement):
        sql = str(statement)
        self.queries.append(sql)
        if "JOIN nepstar.sa_ai_consult_turn" in sql:
            cutoff = statement.compile().params["started_at_1"]
            if self.generation.status == "running" and self.generation.started_at <= cutoff:
                return FakeResult([(8, 7, "session-1")])
            return FakeResult([])
        if "FROM nepstar.sa_ai_consult_session" in sql:
            return FakeResult([self.session])
        if "FROM nepstar.sa_ai_consult_settings" in sql:
            return FakeResult([1])
        if "FROM nepstar.sa_ai_consult_turn" in sql:
            return FakeResult([self.turn])
        if "FROM nepstar.sa_ai_consult_generation" in sql:
            return FakeResult([self.generation])
        raise AssertionError(f"Unexpected query: {sql}")

    def add(self, item):
        assert isinstance(item, SAAiConsultAdminAudit)
        self.audit.append(item)

    def begin(self):
        return self

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_args):
        return False


@pytest.mark.asyncio
async def test_old_running_generation_is_failed_and_late_result_is_fenced():
    now = datetime(2026, 10, 9, 9, 0)
    db = FakeDb(now)
    recovered = await recovery.recover_stale_generation(
        db, generation_id=8, turn_id=7, session_id="session-1", now=now,
    )
    assert recovered is True
    assert db.generation.status == db.turn.status == "failed"
    assert db.generation.error_category == "worker_timeout"
    assert db.generation.partial_text is None
    assert db.session.generation_epoch == 5
    with pytest.raises(TurnConflict):
        await finalize_turn(
            db, db.session, TurnStart(7, 8, 4, False, "running"),
            CandidateOutcome("reviewed_candidate", "晚到回答", [{"id": "ev1"}], "model"),
        )
    assert db.generation.budget_tokens == 16384  # Unknown spend keeps its reservation.
    assert len(db.audit) == 1
    assert "私人问题" not in db.audit[0].change_summary_json
    assert all("nepstar.sa_ai_consult_" in sql for sql in db.queries)


@pytest.mark.asyncio
async def test_recent_or_already_completed_generation_is_never_recovered():
    now = datetime(2026, 10, 9, 9, 0)
    db = FakeDb(now)
    db.generation.started_at = now - timedelta(minutes=2)
    assert not await recovery.recover_stale_generation(
        db, generation_id=8, turn_id=7, session_id="session-1", now=now,
    )
    db.generation.started_at = now - timedelta(minutes=4)
    db.generation.status = "completed"
    assert not await recovery.recover_stale_generation(
        db, generation_id=8, turn_id=7, session_id="session-1", now=now,
    )
    assert db.turn.status == "running"
    assert db.session.generation_epoch == 4
    assert db.audit == []


@pytest.mark.asyncio
async def test_recovery_does_not_advance_an_already_changed_epoch():
    now = datetime(2026, 10, 9, 9, 0)
    db = FakeDb(now)
    db.session.generation_epoch = 5
    assert await recovery.recover_stale_generation(
        db, generation_id=8, turn_id=7, session_id="session-1", now=now,
    )
    assert db.session.generation_epoch == 5


@pytest.mark.asyncio
async def test_bounded_runner_uses_only_dedicated_writer(monkeypatch):
    now = datetime(2026, 10, 9, 9, 0)
    db = FakeDb(now)
    monkeypatch.setattr(recovery, "get_ai_consult_sessionmaker", lambda: lambda: db)
    assert await recovery.run_generation_recovery_job(max_batches=1, batch_size=1, now=now) == 1
    assert await recovery.run_generation_recovery_job(max_batches=1, batch_size=1, now=now) == 0
    assert all("nepstar.sa_ai_consult_" in sql for sql in db.queries)


@pytest.mark.asyncio
async def test_invalid_job_limits_fail_before_connecting(monkeypatch):
    monkeypatch.setattr(
        recovery, "get_ai_consult_sessionmaker",
        lambda: (_ for _ in ()).throw(AssertionError("writer should not be opened")),
    )
    with pytest.raises(ValueError):
        await recovery.run_generation_recovery_job(batch_size=0)
