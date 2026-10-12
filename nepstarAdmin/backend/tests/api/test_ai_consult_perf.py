"""Synthetic ASGI timings, NOT MySQL/provider/network/mobile performance acceptance.

No lifespan, external sockets, real storage or model calls. Observe individual
ASGI body frames because HTTPX ASGITransport buffers the entire SSE response.
"""

import asyncio
import json
import math
from datetime import date
from time import perf_counter
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import FastAPI

from app.api import ai_consult
from app.config import settings
from app.security.ai_consult_access import GuestAccessDenied
from app.services.ai_consult_pipeline import prepare_answer_candidate
from app.services.ai_consult_turns import TurnStart
from tests.api.test_ai_consult_answer import DummyContext, fake_reader


async def measured_request(app, session, finished):
    body = json.dumps({"question": "呼吸睡眠怎么样？"}).encode()
    path = f"/api/v1/ai-consult/sessions/{session.id}/turns"
    scope = {
        "type": "http", "asgi": {"version": "3.0", "spec_version": "2.4"},
        "http_version": "1.1", "method": "POST", "scheme": "http",
        "path": path, "raw_path": path.encode(), "root_path": "",
        "query_string": f"report_code={session.report_code}".encode(),
        "headers": [
            (b"content-type", b"application/json"),
            (b"authorization", f"Bearer token-{session.guest_id}".encode()),
            (b"idempotency-key", str(uuid4()).encode()),
        ],
        "client": ("127.0.0.1", 12345), "server": ("test", 80),
    }
    records, times = [], {}
    response_headers = {}
    start = perf_counter()

    async def receive():
        return {"type": "http.request", "body": body, "more_body": False}

    async def send(message):
        if message["type"] == "http.response.start":
            assert message["status"] == 200
            response_headers.update(dict(message["headers"]))
        elif message.get("body"):
            for block in message["body"].decode().strip().split("\n\n"):
                name, data = block.splitlines()
                name = name.removeprefix("event: ")
                data = json.loads(data.removeprefix("data: "))
                assert data["session_id"] == session.id
                assert data["turn_id"] == session.guest_id
                assert data["generation_id"] == 100 + session.guest_id
                assert data["seq"] == len(records) + 1
                # Verified text may only leave AFTER the finalization boundary.
                if name in {"delta", "evidence", "completed", "error"}:
                    assert session.id in finished
                if name == "evidence":
                    assert all(session.report_code in item["route"] for item in data["items"])
                records.append((name, data))
                times.setdefault(name, (perf_counter() - start) * 1000)

    await app(scope, receive, send)
    assert response_headers[b"x-accel-buffering"] == b"no"
    assert response_headers[b"cache-control"] == b"no-store"
    return records, times


def percentiles(values):
    ordered = sorted(values)
    return {
        f"p{p}_ms": round(ordered[math.ceil(len(ordered) * p / 100) - 1], 2)
        for p in (50, 95, 99)
    } if ordered else None


@pytest.mark.asyncio
@pytest.mark.parametrize("mode", ["success", "timeout", "mixed"])
async def test_twenty_concurrent_synthetic_streams_are_isolated(monkeypatch, mode):
    for name in ("AI_CONSULT_GUEST_ENABLED", "AI_CONSULT_SESSIONS_ENABLED",
                 "AI_CONSULT_ANSWERS_ENABLED", "AI_CONSULT_OPERATIONS_READY"):
        monkeypatch.setattr(settings, name, True)
    monkeypatch.setattr(ai_consult, "CANDIDATE_PREPARATION_TIMEOUT_SECONDS", 0.2)
    sessions = {
        f"session-{i}": SimpleNamespace(
            id=f"session-{i}", guest_id=i, report_code=f"R{i}", customer_id=1000 + i,
            report_date=date(2026, 7, 29), consent_id=i, generation_epoch=1,
            source="home", source_indicator_code=None, source_plan_id=None,
        ) for i in range(1, 21)
    }
    finished, reserved = {}, set()
    barrier = asyncio.Event()
    active = peak = entered = cancelled = 0

    class Provider:
        available = True
        provider_code = "fake"
        model_code = "fake-model"
        token_budget = 16384

        async def draft(self, *, question, evidence):
            nonlocal active, peak, entered, cancelled
            active += 1
            entered += 1
            peak = max(peak, active)
            if entered == 20:
                barrier.set()
            try:
                await barrier.wait()
                if mode == "timeout" or (mode == "mixed" and evidence["facts"][0]["score"] % 2):
                    await asyncio.Event().wait()
                await asyncio.sleep(0.02)
                return {
                    "summary": "可以结合报告中的这项结果理解当前情况。",
                    "evidence_ids": ["ev1"], "follow_up_questions": [],
                }
            except asyncio.CancelledError:
                cancelled += 1
                raise
            finally:
                active -= 1

    async def guest(_db, token, report_code):
        item = next((s for s in sessions.values() if s.report_code == report_code), None)
        if item is None or token != f"token-{item.guest_id}":
            raise GuestAccessDenied()
        return SimpleNamespace(id=item.guest_id)

    async def get_session(_db, visitor, report_code, session_id, **_kwargs):
        item = sessions.get(session_id)
        return item if item and item.guest_id == visitor.id and item.report_code == report_code else None

    async def consent(_db, guest_id, **_kwargs):
        return True

    async def latest_session(*_args, **_kwargs):
        return True

    async def pause_revision(*_args, **_kwargs):
        return 0

    async def start(_db, item, *_args, **_kwargs):
        return TurnStart(item.guest_id, 100 + item.guest_id, 1, False, "running")

    async def reserve(_db, _config, *, guest_id, **_kwargs):
        reserved.add(guest_id)

    async def finish(_db, item, started, outcome):
        assert item.id not in finished
        assert started.turn_id == item.guest_id
        finished[item.id] = outcome
        return outcome.state == "reviewed_candidate" and bool(outcome.evidence)

    async def reader(db, item, tool, **kwargs):
        result = await fake_reader(db, item, tool, **kwargs)
        score = 70 + item.guest_id
        if tool == "home":
            result["systems"][0]["indicators"][0]["score"] = score
        else:
            result["indicator"]["score"] = score
        return result

    async def answer(db, item, question, **kwargs):
        return await prepare_answer_candidate(db, item, question, reader=reader, **kwargs)

    for name, value in {
        "get_ai_consult_sessionmaker": lambda: DummyContext,
        "async_session": DummyContext, "require_guest": guest,
        "get_guest_session": get_session, "consult_processing_allowed": consent,
        "is_latest_guest_session": latest_session,
        "last_pause_revision": pause_revision,
        "start_turn": start, "reserve_generation_capacity": reserve,
        "finalize_turn": finish, "prepare_answer_candidate": answer,
        "answer_provider": Provider(),
    }.items():
        monkeypatch.setattr(ai_consult, name, value)
    app = FastAPI()
    app.include_router(ai_consult.router, prefix="/api/v1")
    results = await asyncio.wait_for(asyncio.gather(*(
        measured_request(app, session, finished) for session in sessions.values()
    )), timeout=3)

    expected_timeouts = {"success": 0, "timeout": 20, "mixed": 10}[mode]
    assert entered == peak == len(reserved) == len(finished) == 20
    assert cancelled == expected_timeouts
    assert active == 0
    for session, (records, _) in zip(sessions.values(), results):
        outcome = finished[session.id]
        if outcome.state == "timeout":
            assert [name for name, _ in records] == ["accepted", "status", "status", "error"]
            assert records[-1][1]["code"] == "consult.timeout"
            assert outcome.evidence == []
        else:
            assert [name for name, _ in records] == ["accepted", "status", "status", "delta", "evidence", "completed"]
            assert f"活力值 {70 + session.guest_id} 分" in records[-1][1]["answer"]
    metrics = {
        "environment": "in-memory ASGI, fake storage/model; NOT production acceptance",
        "mode": mode, "concurrent_provider_peak": peak,
        "completed": 20 - expected_timeouts, "timed_out": expected_timeouts,
        "timings": {name: percentiles([times[name] for _, times in results if name in times])
                    for name in ("accepted", "delta", "completed", "error")},
    }
    print("SIMULATED_PERF=" + json.dumps(metrics, ensure_ascii=False, sort_keys=True))
