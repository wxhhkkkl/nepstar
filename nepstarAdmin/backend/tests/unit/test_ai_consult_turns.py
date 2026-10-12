"""轮次幂等与落库状态使用内存 SQL 替身验证，不连接真实数据库。"""

import asyncio
from types import SimpleNamespace
from uuid import uuid4

import pytest
from sqlalchemy.dialects import mysql

from app.models.new.sa_ai_consult import SAAiConsultGeneration, SAAiConsultTurn
from app.services.ai_consult_pipeline import CandidateOutcome
from app.services.ai_consult_sessions import get_guest_session, is_latest_guest_session, revoke_guest_session
from app.services.ai_consult_turns import (
    FeedbackNotAllowed,
    RetryConflict,
    StopConflict,
    TurnConflict,
    TurnInProgress,
    finalize_turn,
    retry_turn,
    save_turn_feedback,
    stop_running_generation,
    start_turn,
)


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
        if "FROM nepstar.sa_ai_consult_settings" in sql:
            return FakeResult(1)
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
                              and ("generation_epoch_1" not in params
                                   or item.generation_epoch == params["generation_epoch_1"])), None)
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
async def test_guest_session_lock_compiles_to_nepstar_mysql_for_update():
    statements = []

    class CaptureDb:
        async def execute(self, statement):
            statements.append(statement)
            return FakeResult(None)

    assert await get_guest_session(
        CaptureDb(), SimpleNamespace(id=1), "R1", "session-1", lock=True,
    ) is None
    sql = str(statements[0].compile(dialect=mysql.dialect()))
    assert "FROM nepstar.sa_ai_consult_session" in sql
    assert "guest_id" in sql and "report_code" in sql
    assert "FOR UPDATE" in sql


@pytest.mark.asyncio
async def test_latest_session_check_is_report_scoped_without_a_second_session_lock():
    statements = []

    class CaptureDb:
        async def execute(self, statement):
            statements.append(statement)
            return FakeResult("session-1")

    assert await is_latest_guest_session(
        CaptureDb(), SimpleNamespace(id=7), "R1", "session-1",
    )
    statement = statements[0]
    sql = str(statement.compile(dialect=mysql.dialect()))
    assert "FROM nepstar.sa_ai_consult_session" in sql
    assert "FOR UPDATE" not in sql
    assert "created_at DESC" in sql and "id DESC" in sql
    assert statement.compile().params["guest_id_1"] == 7
    assert statement.compile().params["report_code_1"] == "R1"


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
    db.generations[0].budget_tokens = 100
    outcome = CandidateOutcome(
        "reviewed_candidate", "服务端核对后的结果", [{"id": "ev1", "route": "#/system/SYS_LUNG"}],
        "model_candidate", prompt_tokens=60, completion_tokens=15,
    )
    assert await finalize_turn(db, session, started, outcome) is True
    assert db.turns[0].status == "completed"
    assert db.generations[0].status == "completed"
    assert db.turns[0].answer_text == outcome.text
    assert db.turns[0].evidence_refs_json is not None
    assert (db.generations[0].prompt_tokens, db.generations[0].completion_tokens) == (60, 15)
    with pytest.raises(TurnConflict):
        await finalize_turn(db, session, started, outcome)
    assert (db.generations[0].prompt_tokens, db.generations[0].completion_tokens) == (60, 15)


@pytest.mark.asyncio
async def test_timeout_closes_generation_and_rejects_late_success_without_fake_usage():
    db = FakeWriteDb()
    session = bound_session()
    started = await start_turn(db, session, str(uuid4()), "呼吸睡眠怎么样？")
    db.generations[0].budget_tokens = 100
    assert await finalize_turn(
        db, session, started, CandidateOutcome("timeout", "等待超时", [], "system"),
    ) is False
    turn, generation = db.turns[0], db.generations[0]
    assert turn.status == generation.status == "failed"
    assert generation.error_category == "timeout"
    assert generation.finished_at is not None
    assert generation.budget_tokens == 100
    assert generation.prompt_tokens is generation.completion_tokens is None
    assert turn.answer_text is turn.evidence_refs_json is None
    late = CandidateOutcome("reviewed_candidate", "迟到答案", [{"id": "ev1"}], "model_candidate")
    with pytest.raises(TurnConflict):
        await finalize_turn(db, session, started, late)
    assert turn.answer_text is None
    assert generation.status == "failed"


@pytest.mark.parametrize("prompt_tokens,completion_tokens", [(None, 12), (12, None)])
@pytest.mark.asyncio
async def test_incomplete_provider_usage_keeps_full_generation_reservation(prompt_tokens, completion_tokens):
    db = FakeWriteDb()
    session = bound_session()
    started = await start_turn(db, session, str(uuid4()), "呼吸睡眠怎么样？")
    db.generations[0].budget_tokens = 100
    outcome = CandidateOutcome(
        "reviewed_candidate", "服务端核对后的结果", [{"id": "ev1"}], "model_candidate",
        prompt_tokens=prompt_tokens, completion_tokens=completion_tokens,
    )

    assert await finalize_turn(db, session, started, outcome) is True
    assert db.generations[0].budget_tokens == 100
    assert db.generations[0].prompt_tokens is None
    assert db.generations[0].completion_tokens is None


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


@pytest.mark.asyncio
async def test_feedback_is_scoped_to_completed_turn_and_latest_choice_wins():
    db = FakeWriteDb()
    session = bound_session()
    started = await start_turn(db, session, str(uuid4()), "请解读报告")
    with pytest.raises(FeedbackNotAllowed):
        await save_turn_feedback(db, session.id, started.turn_id, helpful=False, reason="unclear")
    await finalize_turn(
        db, session, started,
        CandidateOutcome("reviewed_candidate", "已核对的回答", [{"id": "ev1"}], "model_candidate"),
    )
    saved_evidence = db.turns[0].evidence_refs_json
    db.turns[0].evidence_refs_json = "[]"
    with pytest.raises(FeedbackNotAllowed):
        await save_turn_feedback(db, session.id, started.turn_id, helpful=True, reason=None)
    db.turns[0].evidence_refs_json = saved_evidence
    assert await save_turn_feedback(db, "other-session", started.turn_id, helpful=True, reason=None) is None
    turn = await save_turn_feedback(db, session.id, started.turn_id, helpful=False, reason="unclear")
    assert turn.feedback_value == "unhelpful" and turn.feedback_reason == "unclear"
    turn = await save_turn_feedback(db, session.id, started.turn_id, helpful=True, reason=None)
    assert turn.feedback_value == "helpful" and turn.feedback_reason is None
    assert all("nepstar.sa_ai_consult_turn" in sql for sql in db.queries if "FROM" in sql and "sa_ai_consult_turn" in sql)


@pytest.mark.asyncio
async def test_stop_fences_late_completion_and_is_idempotent_for_exact_generation():
    db = FakeWriteDb()
    session = bound_session()
    started = await start_turn(db, session, str(uuid4()), "请解读报告")
    db.generations[0].budget_tokens = 16384
    assert await stop_running_generation(db, session, started.turn_id, started.generation_id) is True
    assert session.generation_epoch == started.generation_epoch + 1
    assert db.turns[0].status == db.generations[0].status == "stopped"
    assert db.generations[0].budget_tokens == 16384
    assert db.turns[0].question_text == "请解读报告"
    assert await stop_running_generation(db, session, started.turn_id, started.generation_id) is False
    with pytest.raises(TurnConflict):
        await finalize_turn(
            db, session, started,
            CandidateOutcome("reviewed_candidate", "迟到回答", [{"id": "ev1"}], "model_candidate"),
        )
    assert db.turns[0].answer_text is None


@pytest.mark.asyncio
async def test_stop_rejects_wrong_attempt_and_completed_turn():
    db = FakeWriteDb()
    session = bound_session()
    started = await start_turn(db, session, str(uuid4()), "请解读报告")
    assert await stop_running_generation(db, session, started.turn_id, 999) is None
    assert db.turns[0].status == "running"
    await finalize_turn(
        db, session, started,
        CandidateOutcome("reviewed_candidate", "已经完成", [{"id": "ev1"}], "model_candidate"),
    )
    with pytest.raises(StopConflict):
        await stop_running_generation(db, session, started.turn_id, started.generation_id)
    assert db.turns[0].answer_text == "已经完成"


@pytest.mark.asyncio
async def test_retry_keeps_one_question_and_replays_the_same_new_attempt():
    db = FakeWriteDb()
    session = bound_session()
    first = await start_turn(db, session, str(uuid4()), "请解读报告")
    db.generations[0].budget_tokens = 16384
    await stop_running_generation(db, session, first.turn_id, first.generation_id)

    second, question = await retry_turn(db, session, first.turn_id, first.generation_id)
    replay, replay_question = await retry_turn(db, session, first.turn_id, first.generation_id)
    assert question == replay_question == "请解读报告"
    assert second.replay is False and replay.replay is True
    assert second.turn_id == replay.turn_id == first.turn_id
    assert second.generation_id == replay.generation_id != first.generation_id
    assert [generation.attempt_number for generation in db.generations] == [1, 2]
    assert len(db.turns) == 1 and db.turns[0].status == "running"
    assert db.generations[0].budget_tokens == 16384
    with pytest.raises(TurnConflict):
        await finalize_turn(
            db, session, first,
            CandidateOutcome("reviewed_candidate", "迟到回答", [{"id": "ev1"}], "model_candidate"),
        )
    db.generations[1].budget_tokens = 16384
    assert await finalize_turn(
        db, session, second,
        CandidateOutcome("reviewed_candidate", "新回答", [{"id": "ev1"}], "model_candidate"),
    ) is True
    completed_replay, _ = await retry_turn(db, session, first.turn_id, first.generation_id)
    assert completed_replay.replay and completed_replay.status == "completed"
    assert completed_replay.answer == "新回答"


@pytest.mark.asyncio
async def test_retry_requires_latest_failed_or_stopped_attempt_and_no_other_running_turn():
    db = FakeWriteDb()
    session = bound_session()
    first = await start_turn(db, session, str(uuid4()), "请解读报告")
    with pytest.raises(RetryConflict):
        await retry_turn(db, session, first.turn_id, first.generation_id)
    assert await retry_turn(db, session, 999, first.generation_id) is None
    await finalize_turn(db, session, first, CandidateOutcome("unsafe_answer", "", [], "system"))
    with pytest.raises(RetryConflict):
        await retry_turn(db, session, first.turn_id, 999)
    second = await start_turn(db, session, str(uuid4()), "其他问题")
    with pytest.raises(TurnInProgress):
        await retry_turn(db, session, first.turn_id, first.generation_id)
    await finalize_turn(db, session, second, CandidateOutcome("unsafe_answer", "", [], "system"))
    retry, _ = await retry_turn(db, session, first.turn_id, first.generation_id)
    with pytest.raises(RetryConflict):
        await retry_turn(db, session, first.turn_id, 999)
    with pytest.raises(RetryConflict):
        await retry_turn(db, session, first.turn_id, second.generation_id)
    assert retry.generation_id != first.generation_id


@pytest.mark.asyncio
@pytest.mark.parametrize("terminal_status", ["failed", "stopped"])
async def test_concurrent_retry_requests_share_one_successor_under_session_lock(terminal_status):
    """Simulate the API's session row lock; a real MySQL lock test is separate."""
    db = FakeWriteDb()
    session = bound_session()
    first = await start_turn(db, session, str(uuid4()), "请解读报告")
    if terminal_status == "stopped":
        await stop_running_generation(db, session, first.turn_id, first.generation_id)
    else:
        await finalize_turn(db, session, first, CandidateOutcome("unsafe_answer", "", [], "system"))

    lock = asyncio.Lock()
    start = asyncio.Event()

    async def request():
        await start.wait()
        async with lock:
            return await retry_turn(db, session, first.turn_id, first.generation_id)

    requests = [asyncio.create_task(request()) for _ in range(8)]
    start.set()
    results = await asyncio.gather(*requests)
    starts = [result[0] for result in results]
    assert len(db.turns) == 1
    assert len(db.generations) == 2
    assert len({item.generation_id for item in starts}) == 1
    assert sum(not item.replay for item in starts) == 1
    assert all(result[1] == "请解读报告" for result in results)
    assert db.generations[0].status == terminal_status
    with pytest.raises(TurnConflict):
        await finalize_turn(
            db, session, first,
            CandidateOutcome("reviewed_candidate", "旧回答", [{"id": "ev1"}], "model_candidate"),
        )


@pytest.mark.asyncio
async def test_stop_and_completion_race_never_publish_two_outcomes_under_session_lock():
    db = FakeWriteDb()
    session = bound_session()
    started = await start_turn(db, session, str(uuid4()), "请解读报告")
    lock = asyncio.Lock()
    gate = asyncio.Event()
    outcome = CandidateOutcome("reviewed_candidate", "已核对的回答", [{"id": "ev1"}], "model_candidate")

    async def stop():
        await gate.wait()
        async with lock:
            return await stop_running_generation(db, session, started.turn_id, started.generation_id)

    async def finish():
        await gate.wait()
        async with lock:
            return await finalize_turn(db, session, started, outcome)

    tasks = [asyncio.create_task(stop()), asyncio.create_task(finish())]
    gate.set()
    results = await asyncio.gather(*tasks, return_exceptions=True)
    assert sum(result is True for result in results) == 1
    assert sum(isinstance(result, (StopConflict, TurnConflict)) for result in results) == 1
    assert (db.turns[0].status, db.generations[0].status) in {
        ("stopped", "stopped"), ("completed", "completed"),
    }
    assert (db.turns[0].answer_text is None) == (db.turns[0].status == "stopped")


@pytest.mark.asyncio
async def test_deleting_session_invalidates_an_in_flight_generation():
    db = FakeWriteDb()
    session = bound_session()
    started = await start_turn(db, session, str(uuid4()), "呼吸睡眠怎么样？")
    revoke_guest_session(session)
    candidate = CandidateOutcome("reviewed_candidate", "不能再发布", [{"id": "ev1"}], "model_candidate")
    with pytest.raises(TurnConflict):
        await finalize_turn(db, session, started, candidate)
    assert session.status == "deleted"
    assert session.deleted_at is not None
    assert db.turns[0].answer_text is None


@pytest.mark.asyncio
async def test_failed_answer_records_model_usage_without_using_success_allowance():
    db = FakeWriteDb()
    session = bound_session()
    started = await start_turn(db, session, str(uuid4()), "这项结果如何？")
    db.generations[0].budget_tokens = 100
    outcome = CandidateOutcome(
        "unsafe_answer", "未通过审核", [], "system",
        prompt_tokens=60, completion_tokens=15,
    )
    assert await finalize_turn(db, session, started, outcome) is False
    assert db.turns[0].status == "failed"
    assert db.generations[0].prompt_tokens == 60
    assert db.generations[0].completion_tokens == 15
    assert db.turns[0].completed_at is None
