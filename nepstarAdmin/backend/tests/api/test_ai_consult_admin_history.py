"""Real SQL on SQLite memory; no external DB, provider or application startup."""
import json
from datetime import UTC, date, datetime

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select
from sqlalchemy.dialects.mysql import dialect
from sqlalchemy.orm import Session

from test_ai_consult_admin import admin_app, MemorySession
from app.models.new.sa_ai_consult import (
    SAAiConsultGuest as Guest, SAAiConsultConsent as Consent,
    SAAiConsultSession as Chat, SAAiConsultTurn as Turn,
    SAAiConsultGeneration as Generation, SAAiConsultAdminAudit as Audit,
)
from app.models.new.sa_junctions import SARoleMenu
from app.services.ai_consult_admin_history import load_dashboard, list_sessions, LocalBucket

IDS = [f"00000000-0000-4000-8000-{i:012}" for i in range(1, 5)]
BASE = "/api/v1/ai-consult/admin"


@pytest.fixture
def history(admin_app):
    app, engine, storage, headers = admin_app
    with Session(engine) as db:
        db.add(SARoleMenu(id=2, role_id=12, menu_id=42, actions="view,conversation"))
        db.add(Guest(id=1, token_digest="not-returned-digest", report_code="SYNTHETIC-R1", customer_id=101,
                     created_at=datetime(2024, 1, 1), last_activity_at=datetime(2024, 1, 1),
                     expires_at=datetime(2024, 1, 2)))
        db.add(Consent(id=1, guest_id=1, notice_version="test", notice_content_hash="a" * 64,
                       provider_code="test", data_scope_hash="b" * 64, choice="accepted", decided_at=datetime(2024, 1, 1)))
        # Exact Beijing midnight boundary and an old expired/deleted session.
        for i, created in enumerate([datetime(2026, 10, 9, 16), datetime(2026, 10, 9, 15, 59, 59),
                                     datetime(2026, 10, 10, 1), datetime(2024, 1, 1)]):
            db.add(Chat(id=IDS[i], guest_id=1, report_code="SYNTHETIC-R1" if i != 2 else "SYNTHETIC-R2",
                        customer_id=101 if i != 2 else 202, report_date=date(2026, 10, 9), source="home",
                        consent_id=1, status="active", created_at=created, last_activity_at=created,
                        expires_at=datetime(2024, 1, 2), deleted_at=datetime(2024, 1, 3) if i == 3 else None))
        for i, (chat, state) in enumerate([(IDS[0], "completed"), (IDS[0], "failed"),
                                         (IDS[1], "completed"), (IDS[2], "running"), (IDS[3], "completed")], 1):
            db.add(Turn(id=i, session_id=chat, sequence=2 if i == 2 else 1,
                        client_request_id=f"request-{i}", question_text=f"FULL QUESTION {i}",
                        answer_text=("FULL ANSWER\n" * 500) if i == 5 else f"ANSWER {i}" if state == "completed" else None,
                        status=state, created_at=datetime(2026, 10, 10, 1),
                        evidence_refs_json=json.dumps([{"kind": "report", "label": "指标依据", "url": "https://private/?token=secret"}]),
                        feedback_value="helpful" if i == 5 else None))
        for i, (turn, started, status, inp, out) in enumerate([
            (1, datetime(2026, 10, 9, 16), "completed", 100, 20),
            (2, datetime(2026, 10, 10, 0), "failed", 50, None),
            (3, datetime(2026, 10, 9, 15, 59, 59), "completed", 10, 5),
            (4, datetime(2026, 10, 10, 1), "running", None, None),
            (5, datetime(2024, 2, 29, 8), "completed", 80, 10),
            (1, datetime(2026, 10, 10, 1, 30), "completed", 30, 5),
        ], 1):
            db.add(Generation(id=i, turn_id=turn, attempt_number=2 if i == 6 else 1,
                              generation_epoch=0, status=status, budget_tokens=1000,
                              prompt_tokens=inp, completion_tokens=out, model_code="test-model",
                              started_at=started, partial_text="PRIVATE PARTIAL", provider_request_id="PRIVATE PROVIDER ID"))
        db.commit()
    return app, engine, storage, headers


@pytest.mark.asyncio
async def test_beijing_buckets_actual_reservations_retries_and_future_null(history):
    _, engine, _, _ = history
    with Session(engine) as db:
        data = await load_dashboard(MemorySession(db), now=datetime(2026, 10, 10, 2, tzinfo=UTC))
    assert data["day"] == "2026-10-10" and data["day_sessions"] == 2
    assert data["day_usage"] == {"input_tokens": 130, "output_tokens": 25, "actual_tokens": 155,
                                  "reserved_tokens": 2000, "unreported_attempts": 2}
    assert data["month_usage"]["actual_tokens"] == 170
    assert data["hourly_trend"][0]["actual_tokens"] == 120
    assert data["hourly_trend"][8]["reserved_tokens"] == 1000
    assert data["hourly_trend"][9]["actual_tokens"] == 35
    assert data["hourly_trend"][10]["actual_tokens"] == 0
    assert data["hourly_trend"][11]["actual_tokens"] is None
    assert len(data["hourly_trend"]) == 24 and len(data["daily_trend"]) == 31
    assert data["daily_trend"][8]["actual_tokens"] == 15
    assert data["daily_trend"][9]["actual_tokens"] == 155
    assert data["daily_trend"][10]["future"] is True
    assert data["completion_rate_percent"] == 66.7
    assert data["running"] == data["stale_running"] == 1


@pytest.mark.asyncio
async def test_historical_leap_month_and_empty_no_false_rates(history):
    _, engine, _, _ = history
    with Session(engine) as db:
        data = await load_dashboard(MemorySession(db), day=date(2024, 2, 29), month="2024-02",
                                    now=datetime(2026, 10, 10, tzinfo=UTC))
        assert len(data["daily_trend"]) == 29 and data["daily_trend"][-1]["actual_tokens"] == 90
        assert not any(point["future"] for point in data["daily_trend"])
        empty = await load_dashboard(MemorySession(db), day=date(2024, 3, 1), month="2024-03",
                                     now=datetime(2026, 10, 10, tzinfo=UTC))
        assert empty["completion_rate_percent"] is None and empty["day_usage"]["actual_tokens"] == 0


def test_mysql_compiler_uses_fixed_offset_and_escaped_literal():
    sql = str(select(LocalBucket(Generation.started_at, hourly=True)).compile(dialect=dialect()))
    assert "TIMESTAMPADD(HOUR, 8," in sql and "'%%H'" in sql
    assert "nepstar.sa_ai_consult_generation" in sql


@pytest.mark.asyncio
async def test_list_exact_filters_pagination_permanent_records_no_bodies(history):
    _, engine, _, _ = history
    with Session(engine) as db:
        adapter = MemorySession(db)
        data = await list_sessions(adapter, report_code="SYNTHETIC-R1", customer_id=101, page_size=1)
        assert data["total"] == 3 and len(data["records"]) == 1
        assert data["records"][0]["state"] == "ended"
        second = await list_sessions(adapter, start_date=date(2026, 10, 10), end_date=date(2026, 10, 10))
        assert second["total"] == 2
        assert {row["state"] for row in second["records"]} == {"ended"}
        assert (await list_sessions(adapter, state="ended"))["total"] == 4
        assert (await list_sessions(adapter, report_code="SYNTHETIC%"))["total"] == 0
        assert (await list_sessions(adapter, page=10))["records"] == []
        assert all("question_text" not in str(query) and "answer_text" not in str(query) for query in adapter.queries)
        assert "FULL QUESTION" not in json.dumps(data) and "not-returned-digest" not in json.dumps(data)


@pytest.mark.asyncio
async def test_detail_full_saved_text_ordered_paginated_audited_and_no_secrets(history):
    app, engine, _, headers = history
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get(f"{BASE}/sessions/{IDS[3]}", headers=headers)
        assert response.status_code == 200
        data = response.json()["data"]
        assert data["turns"][0]["answer"] == "FULL ANSWER\n" * 500
        assert data["turns"][0]["evidence"] == [{"label": "指标依据", "kind": "report"}]
        assert response.headers["cache-control"] == "no-store"
        for secret in ("PRIVATE PARTIAL", "PRIVATE PROVIDER ID", "token_digest", "client_request_id", "https://private"):
            assert secret not in response.text
        first = await client.get(f"{BASE}/sessions/{IDS[0]}?limit=1", headers=headers)
        assert first.json()["data"]["has_more"] is True
        second = await client.get(f"{BASE}/sessions/{IDS[0]}?limit=1&offset=1", headers=headers)
        assert second.json()["data"]["turns"][0]["sequence"] == 2
        assert second.json()["data"]["has_more"] is False
    with Session(engine) as db:
        audit = db.scalars(select(Audit).where(Audit.action == "session.read")).all()
        assert len(audit) == 3 and all(item.actor_admin_id == 7 for item in audit)
        assert audit[0].target_id == IDS[3]
        assert json.loads(audit[0].change_summary_json) == {"offset": 0, "limit": 30}


@pytest.mark.asyncio
async def test_overview_only_role_can_list_but_cannot_read_dialogue(history):
    app, engine, storage, headers = history
    with Session(engine) as db:
        db.get(SARoleMenu, 2).actions = "view"
        db.commit()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        assert (await client.get(f"{BASE}/sessions", headers=headers)).status_code == 200
        accesses = len(storage)
        response = await client.get(f"{BASE}/sessions/{IDS[0]}", headers=headers)
        assert response.status_code == 403 and len(storage) == accesses
        assert "FULL QUESTION" not in response.text


@pytest.mark.asyncio
async def test_detail_fails_closed_when_read_audit_cannot_commit(history, monkeypatch):
    app, _, _, headers = history
    async def fail(_self):
        raise RuntimeError("PRIVATE SQL CONNECTION")
    monkeypatch.setattr(MemorySession, "commit", fail)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get(f"{BASE}/sessions/{IDS[3]}", headers=headers)
    assert response.status_code == 503 and response.json()["data"] is None
    assert "FULL ANSWER" not in response.text and "PRIVATE SQL" not in response.text


@pytest.mark.asyncio
@pytest.mark.parametrize("path,status", [
    ("/dashboard?month=2026-13", 422), ("/dashboard?day=2999-01-01", 422),
    ("/sessions?start_date=2026-10-10&end_date=2026-10-09", 422),
    ("/sessions?customer_id=-1", 422), ("/sessions?page_size=1000", 422),
    ("/sessions?state=unknown", 422), ("/sessions/not-a-uuid", 422),
    ("/sessions/00000000-0000-4000-8000-999999999999", 404),
])
async def test_validation_and_missing_record(history, path, status):
    app, _, _, headers = history
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        assert (await client.get(BASE + path, headers=headers)).status_code == status
