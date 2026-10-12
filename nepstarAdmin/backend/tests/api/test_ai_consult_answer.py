"""问答事件契约：全部替身，不连接真实数据库或模型。"""

import asyncio
import json
from datetime import date
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.api import ai_consult
from app.config import settings
from app.security.ai_consult_access import GuestAccessDenied
from app.services.ai_consult_pipeline import prepare_answer_candidate
from app.services.ai_consult_turns import RetryConflict, StopConflict, TurnConflict, TurnStart


class DummyContext:
    async def execute(self, _statement):
        config = SimpleNamespace(
            enabled=True, provider_code="fake", model_code="fake-model",
            active_rule_version_id=None,
        )
        return SimpleNamespace(
            scalar_one_or_none=lambda: config,
            all=lambda: [],
        )

    async def scalar(self, _statement):
        # The route loads a turn's pinned rule and later checks enabled usage settings.
        return SimpleNamespace(rule_version_id=None, enabled=False)

    async def get(self, *_args):
        return SimpleNamespace(rule_version_id=None)

    async def __aenter__(self):
        return self

    async def __aexit__(self, _type, _value, _traceback):
        return False

    def begin(self):
        return self


class FakeProvider:
    available = True
    provider_code = "fake"
    model_code = "fake-model"
    token_budget = 16384

    def __init__(self, draft=None):
        self.draft_result = draft or {
            "summary": "可以结合报告中的这项结果理解当前情况。",
            "evidence_ids": ["ev1"],
            "follow_up_questions": [],
        }
        self.calls = 0

    async def draft(self, *, question, evidence):
        self.calls += 1
        return self.draft_result


async def fake_reader(_db, scope, tool, *, indicator_code=None):
    if tool == "home":
        return {
            "report_code": scope.report_code,
            "report_date": "2026-07-29",
            "total_score": 82,
            "systems": [{
                "system_code": "SYS_LUNG",
                "name": "肺功能",
                "score": 84,
                "indicators": [{
                    "indicator_code": "SYS_LUNG_SLEEP_BREATHING",
                    "name": "呼吸睡眠",
                    "score": 98,
                }],
            }],
        }
    assert tool == "indicator"
    assert indicator_code == "SYS_LUNG_SLEEP_BREATHING"
    return {
        "report_code": scope.report_code,
        "system": {"system_code": "SYS_LUNG"},
        "indicator": {
            "indicator_code": indicator_code,
            "name": "呼吸睡眠",
            "score": 98,
            "description": "关注睡眠期间的呼吸质量。",
        },
    }


def parse_events(response):
    records = []
    for block in response.text.strip().split("\n\n"):
        lines = block.splitlines()
        records.append((lines[0].removeprefix("event: "), json.loads(lines[1].removeprefix("data: "))))
    return records


@pytest.fixture
def isolated_answer(monkeypatch):
    monkeypatch.setattr(settings, "AI_CONSULT_GUEST_ENABLED", True)
    monkeypatch.setattr(settings, "AI_CONSULT_SESSIONS_ENABLED", True)
    monkeypatch.setattr(settings, "AI_CONSULT_ANSWERS_ENABLED", True)
    monkeypatch.setattr(settings, "AI_CONSULT_OPERATIONS_READY", True)
    session = SimpleNamespace(
        id="session-1", guest_id=1, report_code="R1", customer_id=1001,
        report_date=date(2026, 7, 29), consent_id=None, generation_epoch=0,
        source="home", source_indicator_code=None, source_plan_id=None,
        status="active", deleted_at=None,
    )
    provider = FakeProvider()
    stored = {}
    finalized = []

    async def require_guest(_db, token, report_code):
        if token not in {"guest-1", "guest-2"} or report_code != "R1":
            raise GuestAccessDenied()
        return SimpleNamespace(id=1 if token == "guest-1" else 2)

    async def get_session(_db, guest, report_code, session_id, *, lock=False):
        return session if (
            guest.id == 1 and report_code == "R1" and session_id == session.id
            and session.status == "active" and session.deleted_at is None
        ) else None

    async def processing_allowed(_db, guest_id, *, lock=False):
        return guest_id == 1

    async def start(_db, item, request_id, question, *, rule_version_id=None):
        if request_id in stored:
            previous = stored[request_id]
            if previous["question"] != question.strip():
                raise TurnConflict()
            return TurnStart(1, 1, 1, True, previous["status"],
                             previous.get("answer"), previous.get("evidence"))
        item.generation_epoch += 1
        stored[request_id] = {"question": question.strip(), "status": "running"}
        return TurnStart(1, 1, item.generation_epoch, False, "running")

    async def finish(_db, item, started, outcome):
        finalized.append(outcome)
        complete = outcome.state == "reviewed_candidate" and bool(outcome.evidence)
        state = stored[next(iter(stored))]
        state["status"] = "completed" if complete else "failed"
        if complete:
            state["answer"] = outcome.text
            state["evidence"] = outcome.evidence
        return complete

    async def answer(read_db, scope, question, *, provider, **context):
        return await prepare_answer_candidate(
            read_db, scope, question, provider=provider, reader=fake_reader, **context
        )

    monkeypatch.setattr(ai_consult, "get_ai_consult_sessionmaker", lambda: DummyContext)
    monkeypatch.setattr(ai_consult, "async_session", DummyContext)
    monkeypatch.setattr(ai_consult, "require_guest", require_guest)
    monkeypatch.setattr(ai_consult, "get_guest_session", get_session)
    monkeypatch.setattr(ai_consult, "is_latest_guest_session", AsyncMock(return_value=True))
    monkeypatch.setattr(ai_consult, "last_pause_revision", AsyncMock(return_value=0))
    monkeypatch.setattr(ai_consult, "consult_processing_allowed", processing_allowed)
    monkeypatch.setattr(ai_consult, "start_turn", start)
    monkeypatch.setattr(ai_consult, "finalize_turn", finish)
    monkeypatch.setattr(ai_consult, "prepare_answer_candidate", answer)
    monkeypatch.setattr(ai_consult, "answer_provider", provider)
    async def reserve_capacity(*_args, **_kwargs):
        return None
    monkeypatch.setattr(ai_consult, "reserve_generation_capacity", reserve_capacity)
    app = FastAPI()
    app.include_router(ai_consult.router, prefix="/api/v1")
    return app, provider, stored, finalized


async def post_question(app, *, token="guest-1", key=None, question="呼吸睡眠怎么样？",
                        report_code="R1", session_id="session-1"):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        return await client.post(
            f"/api/v1/ai-consult/sessions/{session_id}/turns",
            params={"report_code": report_code},
            headers={"Authorization": f"Bearer {token}", "Idempotency-Key": key or str(uuid4())},
            json={"question": question},
        )


def test_candidate_preparation_deadline_is_sixty_seconds():
    assert ai_consult.CANDIDATE_PREPARATION_TIMEOUT_SECONDS == 60.0


@pytest.mark.asyncio
@pytest.mark.parametrize("stage", ["context", "rules", "report", "provider"])
async def test_preparation_timeout_cancels_work_without_publishing_answer(
    isolated_answer, monkeypatch, stage,
):
    app, provider, stored, finalized = isolated_answer
    cancelled = []

    async def hang(*_args, **_kwargs):
        try:
            await asyncio.Event().wait()
        finally:
            cancelled.append(stage)

    monkeypatch.setattr(ai_consult, "CANDIDATE_PREPARATION_TIMEOUT_SECONDS", 0.02, raising=False)
    if stage == "context":
        monkeypatch.setattr(ai_consult, "_prior_conversation_context", hang)
    elif stage == "rules":
        monkeypatch.setattr(ai_consult, "load_rule_content", hang)
    elif stage == "report":
        monkeypatch.setattr(ai_consult, "prepare_answer_candidate", hang)
    else:
        monkeypatch.setattr(provider, "draft", hang)

    response = await asyncio.wait_for(post_question(app), timeout=0.5)
    events = parse_events(response)
    assert [name for name, _ in events] == ["accepted", "status", "status", "error"]
    assert events[-1][1]["code"] == "consult.timeout"
    assert events[-1][1]["retryable"] is True
    assert cancelled == [stage]
    assert len(finalized) == 1
    assert finalized[0].state == "timeout"
    assert finalized[0].evidence == []
    # An interrupted model may have consumed tokens: never record false zero usage.
    assert finalized[0].prompt_tokens is None
    assert finalized[0].completion_tokens is None
    assert stored[next(iter(stored))]["status"] == "failed"
    assert "answer" not in stored[next(iter(stored))]


@pytest.mark.asyncio
async def test_valid_answer_is_saved_before_verified_events_are_emitted(isolated_answer):
    app, provider, stored, finalized = isolated_answer
    response = await post_question(app)
    events = parse_events(response)
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")
    assert [name for name, _ in events] == [
        "accepted", "status", "status", "delta", "evidence", "completed"
    ], events
    assert [data["seq"] for _, data in events] == [1, 2, 3, 4, 5, 6]
    assert [data["phase"] for name, data in events if name == "status"] == [
        "reading_evidence", "answering"
    ]
    assert all(data["session_id"] == "session-1" for _, data in events)
    assert "呼吸睡眠活力值 98 分" in events[3][1]["text"]
    assert events[4][1]["items"][0]["id"] == "ev1"
    assert stored[next(iter(stored))]["status"] == "completed"
    assert finalized[0].is_completed is False
    assert provider.calls == 1


@pytest.mark.asyncio
async def test_followups_are_saved_with_the_report_citation_and_streamed(isolated_answer):
    app, provider, stored, finalized = isolated_answer
    provider.draft_result = {
        "summary": "可以结合报告中的这项结果理解当前情况。",
        "evidence_ids": ["ev1"],
        "follow_up_questions": ["你每晚是否容易醒来？"],
    }
    response = await post_question(app)
    events = parse_events(response)
    assert [name for name, _ in events][-3:] == ["delta", "evidence", "completed"]
    expected = "你每晚是否容易醒来？"
    assert events[-2][1]["items"][0]["follow_up_questions"] == [expected]
    assert finalized[0].evidence[0]["follow_up_questions"] == [expected]
    assert stored[next(iter(stored))]["evidence"][0]["follow_up_questions"] == [expected]


@pytest.mark.asyncio
@pytest.mark.parametrize("draft", [
    {"summary": "本次得分是 91 分。", "evidence_ids": ["ev1"], "follow_up_questions": []},
    {"summary": "检测日期是 2026-06-01。", "evidence_ids": ["ev1"], "follow_up_questions": []},
    {"summary": "这项正常。", "evidence_ids": ["ev404"], "follow_up_questions": []},
    {"summary": "不用就医。", "evidence_ids": ["ev1"], "follow_up_questions": []},
    {"summary": "这个结果不需要去医院。", "evidence_ids": ["ev1"], "follow_up_questions": []},
    {"summary": "你就是糖尿病。", "evidence_ids": ["ev1"], "follow_up_questions": []},
    {"summary": "请自行把药量减半。", "evidence_ids": ["ev1"], "follow_up_questions": []},
])
async def test_unverified_model_claim_cannot_emit_delta_or_completed(isolated_answer, draft):
    app, provider, stored, finalized = isolated_answer
    provider.draft_result = draft
    response = await post_question(app)
    events = parse_events(response)
    assert [name for name, _ in events] == ["accepted", "status", "status", "error"]
    assert events[-1][1]["code"] == "consult.unsafe_answer"
    assert draft["summary"] not in response.text
    assert "91 分" not in response.text
    assert "2026-06-01" not in response.text
    assert stored[next(iter(stored))]["status"] == "failed"
    assert finalized[0].is_completed is False


@pytest.mark.asyncio
async def test_same_idempotency_key_replays_without_second_generation(isolated_answer):
    app, provider, stored, _ = isolated_answer
    key = str(uuid4())
    first = await post_question(app, key=key)
    again = await post_question(app, key=key)
    conflict = await post_question(app, key=key, question="其他问题")
    assert first.status_code == again.status_code == 200
    assert [name for name, _ in parse_events(again)] == ["accepted", "delta", "evidence", "completed"]
    assert conflict.status_code == 409
    assert len(stored) == 1
    assert provider.calls == 1


@pytest.mark.asyncio
async def test_wrong_guest_or_report_cannot_start_or_replay_a_turn(isolated_answer):
    app, provider, stored, _ = isolated_answer
    wrong_guest = await post_question(app, token="guest-2")
    wrong_report = await post_question(app, report_code="R2")
    assert wrong_guest.status_code == 404
    assert wrong_report.status_code == 403
    assert stored == {}
    assert provider.calls == 0


@pytest.mark.asyncio
async def test_answer_endpoint_is_independently_disabled(isolated_answer, monkeypatch):
    app, provider, stored, _ = isolated_answer
    monkeypatch.setattr(settings, "AI_CONSULT_ANSWERS_ENABLED", False)
    response = await post_question(app)
    assert response.status_code == 503
    assert stored == {}
    assert provider.calls == 0


@pytest.mark.asyncio
async def test_unset_deployment_flags_allow_database_enabled_consultation(isolated_answer, monkeypatch):
    app, provider, _, _ = isolated_answer
    for flag in ("GUEST_ENABLED", "SESSIONS_ENABLED", "ANSWERS_ENABLED", "OPERATIONS_READY"):
        monkeypatch.setattr(settings, f"AI_CONSULT_{flag}", None)
    assert parse_events(await post_question(app))[-1][0] == "completed"
    assert provider.calls == 1


@pytest.mark.asyncio
async def test_database_pause_blocks_new_questions_and_retry_before_model_call(isolated_answer, monkeypatch):
    app, provider, stored, _ = isolated_answer
    async def paused(_self, statement):
        return SimpleNamespace(scalar_one_or_none=lambda: SimpleNamespace(enabled=False))
    monkeypatch.setattr(DummyContext, "execute", paused)
    response = await post_question(app)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        retry = await client.post("/api/v1/ai-consult/sessions/session-1/turns/7/retry",
            params={"report_code": "R1"}, headers={"Authorization": "Bearer guest-1"}, json={"generation_id": 8})
    assert response.status_code == retry.status_code == 503
    assert response.json()["message"] == retry.json()["message"] == "consult.disabled"
    assert stored == {} and provider.calls == 0


@pytest.mark.asyncio
async def test_pause_before_candidate_preparation_saves_terminal_state_without_model_call(isolated_answer, monkeypatch):
    app, provider, stored, finalized = isolated_answer
    monkeypatch.setattr(ai_consult, "_service_permits_generation", AsyncMock(return_value=False))
    events = parse_events(await post_question(app))
    assert events[-1][1]["code"] == "consult.disabled"
    assert [name for name, _ in events] == ["accepted", "status", "status", "error"]
    assert finalized[0].state == "service_paused" and finalized[0].text == ""
    assert (finalized[0].prompt_tokens, finalized[0].completion_tokens) == (0, 0)
    assert stored[next(iter(stored))]["status"] == "failed" and provider.calls == 0


@pytest.mark.asyncio
@pytest.mark.parametrize("reopened", [False, True])
async def test_pause_fences_inflight_answer_even_after_resume_and_preserves_usage(isolated_answer, monkeypatch, reopened):
    from app.services.ai_consult_pipeline import CandidateOutcome
    app, _, stored, finalized = isolated_answer
    if reopened:
        # Admission and pre-model check see revision 0; a pause+resume creates revision 9.
        monkeypatch.setattr(ai_consult, "last_pause_revision", AsyncMock(side_effect=[0, 0, 9]))
    else:
        monkeypatch.setattr(ai_consult, "_service_permits_generation", AsyncMock(side_effect=[True, False]))
    monkeypatch.setattr(ai_consult, "prepare_answer_candidate", AsyncMock(return_value=CandidateOutcome(
        "reviewed_candidate", "NEVER PUBLISH PAUSED ANSWER", [{"id": "ev1"}], "model",
        prompt_tokens=11, completion_tokens=3,
    )))
    response = await post_question(app)
    events = parse_events(response)
    assert [name for name, _ in events] == ["accepted", "status", "status", "error"]
    assert events[-1][1]["code"] == "consult.disabled" and events[-1][1]["retryable"] is False
    assert "NEVER PUBLISH" not in response.text
    assert finalized[0].state == "service_paused" and finalized[0].evidence == []
    assert (finalized[0].prompt_tokens, finalized[0].completion_tokens) == (11, 3)
    assert stored[next(iter(stored))]["status"] == "failed"


@pytest.mark.asyncio
async def test_maintenance_rejects_new_and_retried_generations_before_model_call(isolated_answer, monkeypatch):
    app, provider, stored, _ = isolated_answer

    async def maintenance_settings(_self, _statement):
        return SimpleNamespace(scalar_one_or_none=lambda: SimpleNamespace(
            enabled=True, provider_code="fake", model_code="fake-model",
            maintenance_text="  模型服务维护中。  ",
        ))

    monkeypatch.setattr(DummyContext, "execute", maintenance_settings)
    first = await post_question(app)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        retry = await client.post(
            "/api/v1/ai-consult/sessions/session-1/turns/7/retry",
            params={"report_code": "R1"},
            headers={"Authorization": "Bearer guest-1"},
            json={"generation_id": 8},
        )
    for result in (first, retry):
        assert result.status_code == 503
        assert result.json()["message"] == "consult.maintenance"
        assert result.json()["data"] == {"maintenance_text": "模型服务维护中。"}
    assert stored == {}
    assert provider.calls == 0


@pytest.mark.asyncio
async def test_consent_withdrawn_during_generation_suppresses_answer(isolated_answer, monkeypatch):
    app, provider, _stored, finalized = isolated_answer
    checks = 0

    async def consent_once(_db, _guest_id, *, lock=False):
        nonlocal checks
        checks += 1
        return checks == 1

    monkeypatch.setattr(ai_consult, "consult_processing_allowed", consent_once)
    response = await post_question(app)
    events = parse_events(response)
    assert [name for name, _ in events] == ["accepted", "status", "status", "error"]
    assert events[-1][1]["code"] == "consult.access_changed"
    assert len(finalized) == 1
    assert finalized[0].state == "access_changed"
    assert finalized[0].text == "" and finalized[0].evidence == []
    assert _stored[next(iter(_stored))]["status"] == "failed"
    assert provider.calls == 1


@pytest.mark.asyncio
async def test_withdrawal_blocks_new_and_retried_attempts_before_any_model_call(isolated_answer, monkeypatch):
    app, provider, stored, _ = isolated_answer
    monkeypatch.setattr(ai_consult, "consult_processing_allowed", AsyncMock(return_value=False))
    first = await post_question(app)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        retry = await client.post(
            "/api/v1/ai-consult/sessions/session-1/turns/7/retry?report_code=R1",
            headers={"Authorization": "Bearer guest-1"}, json={"generation_id": 8},
        )
    for response in (first, retry):
        assert response.status_code == 403
        assert response.json()["message"] == "consult.processing_withdrawn"
    assert stored == {} and provider.calls == 0


@pytest.mark.asyncio
async def test_old_session_cannot_replay_an_answer_or_start_a_retry(isolated_answer, monkeypatch):
    app, provider, stored, _ = isolated_answer
    key = str(uuid4())
    assert (await post_question(app, key=key)).status_code == 200
    monkeypatch.setattr(ai_consult, "is_latest_guest_session", AsyncMock(return_value=False))
    old_replay = await post_question(app, key=key)
    new_question = await post_question(app)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        retry = await client.post(
            "/api/v1/ai-consult/sessions/session-1/turns/7/retry?report_code=R1",
            headers={"Authorization": "Bearer guest-1"}, json={"generation_id": 8},
        )
    for response in (old_replay, new_question, retry):
        assert response.status_code == 404
        assert response.json()["message"] == "consult.session_not_found"
        assert "answer" not in response.json()
    assert len(stored) == 1 and provider.calls == 1


@pytest.mark.asyncio
async def test_newer_session_fences_inflight_answer_and_preserves_known_usage(isolated_answer, monkeypatch):
    from app.services.ai_consult_pipeline import CandidateOutcome
    app, _, stored, finalized = isolated_answer
    monkeypatch.setattr(ai_consult, "is_latest_guest_session", AsyncMock(side_effect=[True, False]))
    monkeypatch.setattr(ai_consult, "prepare_answer_candidate", AsyncMock(return_value=CandidateOutcome(
        "reviewed_candidate", "NEVER PUBLISH OLD ANSWER", [{"id": "ev1"}], "model",
        prompt_tokens=11, completion_tokens=3,
    )))
    events = parse_events(await post_question(app))
    assert [name for name, _ in events] == ["accepted", "status", "status", "error"]
    assert events[-1][1]["code"] == "consult.access_changed"
    assert finalized[0].state == "access_changed"
    assert finalized[0].text == "" and finalized[0].evidence == []
    assert (finalized[0].prompt_tokens, finalized[0].completion_tokens) == (11, 3)
    assert stored[next(iter(stored))]["status"] == "failed"


@pytest.mark.asyncio
@pytest.mark.parametrize("question", ["我现在胸痛，怎么办？", "我家人刚刚开始抽搐"])
async def test_urgent_question_never_calls_model_or_emits_answer(isolated_answer, question):
    app, provider, stored, finalized = isolated_answer
    response = await post_question(app, question=question)
    events = parse_events(response)
    assert [name for name, _ in events] == ["accepted", "status", "status", "error"]
    assert events[-1][1]["code"] == "consult.urgent_help"
    assert "急救" in events[-1][1]["message"]
    assert stored[next(iter(stored))]["status"] == "failed"
    assert finalized[0].is_completed is False
    assert provider.calls == 0


@pytest.mark.asyncio
async def test_cancelled_stream_is_finalized_incomplete_without_saving_or_publishing_answer(isolated_answer):
    app, provider, stored, finalized = isolated_answer

    async def cancel_draft(*_args, **_kwargs):
        raise asyncio.CancelledError()

    provider.draft = cancel_draft
    response = await ai_consult.create_turn(
        "session-1",
        SimpleNamespace(question="呼吸睡眠怎么样？"),
        report_code="R1",
        authorization="Bearer guest-1",
        idempotency_key=str(uuid4()),
    )
    stream = response.body_iterator
    assert (await anext(stream)).startswith("event: accepted")
    assert (await anext(stream)).startswith("event: status")
    assert (await anext(stream)).startswith("event: status")
    with pytest.raises(asyncio.CancelledError):
        await anext(stream)

    assert len(finalized) == 1
    assert finalized[0].state == "interrupted"
    assert finalized[0].is_completed is False
    assert stored[next(iter(stored))]["status"] == "failed"
    assert "answer" not in stored[next(iter(stored))]


@pytest.mark.asyncio
async def test_delete_during_generation_is_unavailable_and_does_not_change_permanent_record(isolated_answer):
    app, provider, stored, finalized = isolated_answer
    entered_provider = asyncio.Event()
    release_provider = asyncio.Event()

    async def delayed_draft(*, question, evidence):
        provider.calls += 1
        entered_provider.set()
        await release_provider.wait()
        return provider.draft_result

    provider.draft = delayed_draft
    key = str(uuid4())
    response = await ai_consult.create_turn(
        "session-1", SimpleNamespace(question="呼吸睡眠怎么样？"),
        report_code="R1", authorization="Bearer guest-1", idempotency_key=key,
    )
    stream = response.body_iterator
    chunks = [await anext(stream), await anext(stream), await anext(stream)]
    pending_candidate = asyncio.create_task(anext(stream))
    await asyncio.wait_for(entered_provider.wait(), timeout=1)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        deletion = await client.delete(
            "/api/v1/ai-consult/sessions/session-1?report_code=R1",
            headers={"Authorization": "Bearer guest-1"},
        )
    release_provider.set()
    chunks.append(await pending_candidate)
    async for chunk in stream:
        chunks.append(chunk)

    events = [chunk.splitlines()[0].removeprefix("event: ") for chunk in chunks]
    assert deletion.status_code == 410
    assert deletion.json()["message"] == "consult.history_unavailable"
    assert "completed" in events
    assert "consult.access_changed" not in "".join(chunks)
    assert finalized and finalized[-1].state == "reviewed_candidate"
    assert stored[key]["status"] == "completed"


@pytest.mark.asyncio
async def test_stop_is_scoped_to_guest_report_and_exact_attempt_even_when_answers_disabled(isolated_answer, monkeypatch):
    app, _provider, _stored, _finalized = isolated_answer
    monkeypatch.setattr(settings, "AI_CONSULT_ANSWERS_ENABLED", False)
    stopped = []

    async def stop(_db, session, turn_id, generation_id):
        stopped.append((session.id, turn_id, generation_id))
        return True if (turn_id, generation_id) == (7, 8) else None

    monkeypatch.setattr(ai_consult, "stop_running_generation", stop)

    async def request(token="guest-1", report="R1", generation=8):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            return await client.post(
                "/api/v1/ai-consult/sessions/session-1/turns/7/stop",
                params={"report_code": report},
                headers={"Authorization": f"Bearer {token}"} if token else {},
                json={"generation_id": generation},
            )

    success = await request()
    assert success.status_code == 200
    assert success.json()["data"] == {"turn_id": 7, "generation_id": 8, "status": "stopped"}
    assert success.headers["cache-control"] == "no-store"
    assert (await request(token="guest-2")).status_code == 404
    assert (await request(report="R2")).status_code == 403
    assert (await request(token="")).status_code == 401
    assert (await request(generation=9)).status_code == 404
    assert stopped == [("session-1", 7, 8), ("session-1", 7, 9)]


@pytest.mark.asyncio
async def test_stop_returns_conflict_when_generation_already_completed(isolated_answer, monkeypatch):
    app, _provider, _stored, _finalized = isolated_answer

    async def conflict(*_args):
        raise StopConflict()

    monkeypatch.setattr(ai_consult, "stop_running_generation", conflict)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/api/v1/ai-consult/sessions/session-1/turns/7/stop",
            params={"report_code": "R1"},
            headers={"Authorization": "Bearer guest-1"},
            json={"generation_id": 8},
        )
    assert response.status_code == 409
    assert response.json()["message"] == "consult.generation_changed"


@pytest.mark.asyncio
async def test_retry_streams_the_stored_question_and_replays_same_attempt(isolated_answer, monkeypatch):
    app, provider, stored, _finalized = isolated_answer
    stored["original"] = {"question": "呼吸睡眠怎么样？", "status": "failed"}
    retries = 0
    reservations = []
    session_locks = []
    original_get_session = ai_consult.get_guest_session

    async def locked_session(*args, lock=False):
        session_locks.append(lock)
        return await original_get_session(*args, lock=lock)

    async def retry(_db, session, turn_id, generation_id):
        nonlocal retries
        assert (turn_id, generation_id) == (7, 8)
        retries += 1
        if retries == 1:
            session.generation_epoch += 1
            return TurnStart(7, 9, session.generation_epoch, False, "running"), stored["original"]["question"]
        return TurnStart(7, 9, session.generation_epoch, True, "completed",
                         stored["original"]["answer"], stored["original"]["evidence"]), stored["original"]["question"]

    async def reserve(_db, _config, **kwargs):
        reservations.append(kwargs["start"].replay)

    monkeypatch.setattr(ai_consult, "retry_turn", retry)
    monkeypatch.setattr(ai_consult, "get_guest_session", locked_session)
    monkeypatch.setattr(ai_consult, "reserve_generation_capacity", reserve)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        first = await client.post(
            "/api/v1/ai-consult/sessions/session-1/turns/7/retry",
            params={"report_code": "R1"}, headers={"Authorization": "Bearer guest-1"},
            json={"generation_id": 8},
        )
        duplicate = await client.post(
            "/api/v1/ai-consult/sessions/session-1/turns/7/retry",
            params={"report_code": "R1"}, headers={"Authorization": "Bearer guest-1"},
            json={"generation_id": 8},
        )
    assert first.status_code == duplicate.status_code == 200
    assert parse_events(first)[0][1]["generation_id"] == 9
    assert [name for name, _ in parse_events(duplicate)] == ["accepted", "delta", "evidence", "completed"]
    assert provider.calls == 1
    assert reservations == [False, True]
    assert session_locks and all(session_locks)
    assert len(stored) == 1


@pytest.mark.asyncio
async def test_retry_rejects_other_guest_changed_attempt_and_closed_answer_gate(isolated_answer, monkeypatch):
    app, provider, _stored, _finalized = isolated_answer
    calls = []

    async def retry(_db, _session, _turn_id, _generation_id):
        calls.append(1)
        raise RetryConflict()

    monkeypatch.setattr(ai_consult, "retry_turn", retry)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        async def request(token="guest-1", report="R1"):
            return await client.post(
                "/api/v1/ai-consult/sessions/session-1/turns/7/retry",
                params={"report_code": report}, headers={"Authorization": f"Bearer {token}"},
                json={"generation_id": 8},
            )

        assert (await request(token="guest-2")).status_code == 404
        assert (await request(report="R2")).status_code == 403
        conflict = await request()
        monkeypatch.setattr(settings, "AI_CONSULT_ANSWERS_ENABLED", False)
        closed = await request()
    assert conflict.status_code == 409
    assert conflict.json()["message"] == "consult.generation_changed"
    assert closed.status_code == 503
    assert calls == [1]
    assert provider.calls == 0
