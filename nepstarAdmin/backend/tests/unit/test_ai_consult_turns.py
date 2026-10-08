"""轮次幂等与落库状态使用内存 SQL 替身验证，不连接真实数据库。"""

from types import SimpleNamespace
from uuid import uuid4

import pytest

from app.models.new.sa_ai_consult import SAAiConsultGeneration, SAAiConsultTurn
from app.services.ai_consult_pipeline import CandidateOutcome
from app.services.ai_consult_turns import TurnConflict, TurnInProgress, finalize_turn, start_turn


class FakeResult:
    def __init__(self, item):
        self.item = item

    def scalar_one_or_none(self):
        return self.item


class FakeWriteDb:
    def __init__(self):
        self.turns = []
        self.generations = []
        self.queries = []

    async def execute(self, statement):
        sql = str(statement)
        params = statement.compile().params
        self.queries.append(sql)
        if "FROM nepstar.sa_ai_consult_turn" in sql:
            if "status_1" in params:
                found = next((item.id for item in self.turns
                              if item.session_id == params.get("session_id_1")
                              and item.status == "running"), None)
            elif "client_request_id_1" in params:
                found = next((item for item in self.turns
                              if item.session_id == params.get("session_id_1")
                              and item.client_request_id == params["client_request_id_1"]), None)
            else:
                found = next((item for item in self.turns
                              if item.session_id == params.get("session_id_1")
                              and item.id == params.get("id_1")), None)
            return FakeResult(found)
        if "FROM nepstar.sa_ai_consult_generation" in sql:
            if "attempt_number DESC" in sql:
                found = next((item for item in reversed(self.generations)
                              if item.turn_id == params.get("turn_id_1")), None)
            else:
                found = next((item for item in self.generations
                              if item.id == params.get("id_1")
                              and item.turn_id == params.get("turn_id_1")
                              and item.generation_epoch == params.get("generation_epoch_1")), None)
            return FakeResult(found)
        raise AssertionError(f"Unexpected query: {sql}")

    async def scalar(self, statement):
        sql = str(statement)
        assert "FROM nepstar.sa_ai_consult_turn" in sql
        self.queries.append(sql)
        return max((item.sequence for item in self.turns), default=0)

    def add(self, item):
        if isinstance(item, SAAiConsultTurn):
            item.id = len(self.turns) + 1
            self.turns.append(item)
        elif isinstance(item, SAAiConsultGeneration):
            item.id = len(self.generations) + 1
            self.generations.append(item)
        else:
            raise AssertionError("Write outside nepstar consult tables")

    async def flush(self):
        return None


def bound_session():
    return SimpleNamespace(id="session-1", generation_epoch=0, last_activity_at=None)


@pytest.mark.asyncio
async def test_turn_creation_is_scoped_to_session_and_reuses_idempotency_key():
    db = FakeWriteDb()
    session = bound_session()
    key = str(uuid4())
    first = await start_turn(db, session, key, " 呼吸睡眠怎么样？ ")
    replay = await start_turn(db, session, key, "呼吸睡眠怎么样？")
    with pytest.raises(TurnInProgress):
        await start_turn(db, session, str(uuid4()), "还有别的吗？")
    await finalize_turn(db, session, first, CandidateOutcome("unsafe_answer", "", [], "system"))
    second = await start_turn(db, session, str(uuid4()), "还有别的吗？")

    assert first.replay is False
    assert replay.replay is True
    assert replay.turn_id == first.turn_id
    assert replay.generation_id == first.generation_id
    assert second.turn_id != first.turn_id
    assert [item.sequence for item in db.turns] == [1, 2]
    assert [item.generation_epoch for item in db.generations] == [1, 2]
    assert session.generation_epoch == 2
    assert all("nepstar.sa_ai_consult_" in sql for sql in db.queries)
    with pytest.raises(TurnConflict):
        await start_turn(db, session, key, "换了一个问题")
    assert len(db.turns) == 2


@pytest.mark.asyncio
async def test_only_current_epoch_can_finish_and_publish_verified_candidate():
    db = FakeWriteDb()
    session = bound_session()
    started = await start_turn(db, session, str(uuid4()), "呼吸睡眠怎么样？")
    outcome = CandidateOutcome(
        "reviewed_candidate", "服务端核对后的结果", [{"id": "ev1", "route": "#/system/SYS_LUNG"}],
        "model_candidate",
    )
    assert await finalize_turn(db, session, started, outcome) is True
    assert db.turns[0].status == "completed"
    assert db.generations[0].status == "completed"
    assert db.turns[0].answer_text == outcome.text
    assert db.turns[0].evidence_refs_json is not None
    with pytest.raises(TurnConflict):
        await finalize_turn(db, session, started, outcome)


@pytest.mark.asyncio
async def test_failed_or_stale_generation_never_becomes_completed():
    db = FakeWriteDb()
    session = bound_session()
    first = await start_turn(db, session, str(uuid4()), "呼吸睡眠怎么样？")
    session.generation_epoch += 1
    candidate = CandidateOutcome("reviewed_candidate", "已核对", [{"id": "ev1"}], "model_candidate")
    with pytest.raises(TurnConflict):
        await finalize_turn(db, session, first, candidate)
    assert db.turns[0].status == "running"

    session.generation_epoch -= 1
    failed = CandidateOutcome("unsafe_answer", "不能展示", [], "system")
    assert await finalize_turn(db, session, first, failed) is False
    assert db.turns[0].status == "failed"
    assert db.turns[0].answer_text is None
    assert db.generations[0].error_category == "unsafe_answer"
