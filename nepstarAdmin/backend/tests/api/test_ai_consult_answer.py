"""问答事件契约：全部替身，不连接真实数据库或模型。"""

import json
from datetime import date
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.api import ai_consult
from app.config import settings
from app.security.ai_consult_access import GuestAccessDenied
from app.services.ai_consult_pipeline import prepare_answer_candidate
from app.services.ai_consult_turns import TurnConflict, TurnStart


class DummyContext:
    async def __aenter__(self):
        return self

    async def __aexit__(self, _type, _value, _traceback):
        return False

    def begin(self):
        return self


class FakeProvider:
    def __init__(self, draft=None):
        self.draft_result = draft or {
            "summary": "可以结合报告中的这项结果理解当前情况。",
            "evidence_ids": ["ev1"],
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
    session = SimpleNamespace(
        id="session-1", guest_id=1, report_code="R1", customer_id=1001,
        report_date=date(2026, 7, 29), consent_id=11, generation_epoch=0,
    )
    provider = FakeProvider()
    stored = {}
    finalized = []

    async def require_guest(_db, token, report_code):
        if token not in {"guest-1", "guest-2"} or report_code != "R1":
            raise GuestAccessDenied()
        return SimpleNamespace(id=1 if token == "guest-1" else 2)

    async def get_session(_db, guest, report_code, session_id, *, lock=False):
        return session if guest.id == 1 and report_code == "R1" and session_id == session.id else None

    async def current_consent(_db, guest_id, *, lock=False):
        return SimpleNamespace(id=11) if guest_id == 1 else None

    async def start(_db, item, request_id, question):
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

    async def answer(read_db, scope, question, *, provider):
        return await prepare_answer_candidate(
            read_db, scope, question, provider=provider, reader=fake_reader
        )

    monkeypatch.setattr(ai_consult, "get_ai_consult_sessionmaker", lambda: DummyContext)
    monkeypatch.setattr(ai_consult, "async_session", DummyContext)
    monkeypatch.setattr(ai_consult, "require_guest", require_guest)
    monkeypatch.setattr(ai_consult, "get_guest_session", get_session)
    monkeypatch.setattr(ai_consult, "require_current_consent", current_consent)
    monkeypatch.setattr(ai_consult, "start_turn", start)
    monkeypatch.setattr(ai_consult, "finalize_turn", finish)
    monkeypatch.setattr(ai_consult, "prepare_answer_candidate", answer)
    monkeypatch.setattr(ai_consult, "answer_provider", provider)
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


@pytest.mark.asyncio
async def test_valid_answer_is_saved_before_verified_events_are_emitted(isolated_answer):
    app, provider, stored, finalized = isolated_answer
    response = await post_question(app)
    events = parse_events(response)
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")
    assert [name for name, _ in events] == [
        "accepted", "status", "status", "delta", "evidence", "completed"
    ]
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
@pytest.mark.parametrize("draft", [
    {"summary": "本次得分是 91 分。", "evidence_ids": ["ev1"]},
    {"summary": "检测日期是 2026-06-01。", "evidence_ids": ["ev1"]},
    {"summary": "这项正常。", "evidence_ids": ["ev404"]},
    {"summary": "不用就医。", "evidence_ids": ["ev1"]},
])
async def test_unverified_model_claim_cannot_emit_delta_or_completed(isolated_answer, draft):
    app, provider, stored, finalized = isolated_answer
    provider.draft_result = draft
    response = await post_question(app)
    events = parse_events(response)
    assert [name for name, _ in events] == ["accepted", "status", "status", "error"]
    assert events[-1][1]["code"] == "consult.unsafe_answer"
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
async def test_consent_withdrawn_during_generation_suppresses_answer(isolated_answer, monkeypatch):
    app, provider, _stored, finalized = isolated_answer
    checks = 0

    async def consent_once(_db, _guest_id, *, lock=False):
        nonlocal checks
        checks += 1
        return SimpleNamespace(id=11) if checks == 1 else None

    monkeypatch.setattr(ai_consult, "require_current_consent", consent_once)
    response = await post_question(app)
    events = parse_events(response)
    assert [name for name, _ in events] == ["accepted", "status", "status", "error"]
    assert events[-1][1]["code"] == "consult.access_changed"
    assert finalized == []
    assert provider.calls == 1


@pytest.mark.asyncio
async def test_urgent_question_never_calls_model_or_emits_answer(isolated_answer):
    app, provider, stored, finalized = isolated_answer
    response = await post_question(app, question="我现在胸痛，怎么办？")
    events = parse_events(response)
    assert [name for name, _ in events] == ["accepted", "status", "status", "error"]
    assert events[-1][1]["code"] == "consult.urgent_help"
    assert "急救" in events[-1][1]["message"]
    assert stored[next(iter(stored))]["status"] == "failed"
    assert finalized[0].is_completed is False
    assert provider.calls == 0
