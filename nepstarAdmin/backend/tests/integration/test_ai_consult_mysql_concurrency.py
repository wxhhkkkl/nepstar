"""Real MySQL lock test, opt-in for an empty disposable local nepstar schema only.

This test never uses the application's NEPSTAR_DATABASE_URL. It creates and
removes only the consultation tables in a separately configured local instance.
"""

import asyncio
import os
from datetime import UTC, date, datetime, timedelta
from uuid import uuid4

import pytest
from sqlalchemy import func, select, text
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.database import AiConsultStorageConfigurationError, Base, validate_ai_consult_database_url
from app.models.new.sa_ai_consult import (
    SAAiConsultConsent,
    SAAiConsultGeneration,
    SAAiConsultGuest,
    SAAiConsultSession,
    SAAiConsultSettings,
    SAAiConsultTurn,
)
from app.services.ai_consult_pipeline import CandidateOutcome
from app.services.ai_consult_turns import (
    StopConflict,
    TurnConflict,
    finalize_turn,
    retry_turn,
    start_turn,
    stop_running_generation,
)


def disposable_test_url(raw_url: str, confirmation: str) -> str:
    """Reject unsafe targets before any connection, DDL, or transaction."""
    if confirmation != "EMPTY_LOCAL_NEPSTAR_ONLY":
        raise ValueError("Explicit disposable test confirmation is required")
    validate_ai_consult_database_url(raw_url)
    url = make_url(raw_url)
    if url.host != "127.0.0.1" or url.port is None or url.port == 3306:
        raise ValueError("Use an explicit non-default port on 127.0.0.1")
    return raw_url


def test_disposable_target_guard_rejects_remote_and_other_databases():
    safe_url = "mysql+aiomysql://u:p@127.0.0.1:53306/nepstar"
    assert disposable_test_url(safe_url, "EMPTY_LOCAL_NEPSTAR_ONLY") == safe_url
    with pytest.raises(ValueError):
        disposable_test_url(safe_url, "")
    with pytest.raises(ValueError):
        disposable_test_url("mysql+aiomysql://u:p@127.0.0.1:3306/nepstar", "EMPTY_LOCAL_NEPSTAR_ONLY")
    with pytest.raises(ValueError):
        disposable_test_url("mysql+aiomysql://u:p@rds.example:53306/nepstar", "EMPTY_LOCAL_NEPSTAR_ONLY")
    with pytest.raises(AiConsultStorageConfigurationError):
        disposable_test_url("mysql+aiomysql://u:p@127.0.0.1:53306/platform", "EMPTY_LOCAL_NEPSTAR_ONLY")


async def locked_session(db, session_id):
    return (
        await db.execute(
            select(SAAiConsultSession)
            .where(SAAiConsultSession.id == session_id)
            .with_for_update()
        )
    ).scalar_one()


@pytest.mark.asyncio
async def test_real_mysql_retry_and_stop_completion_races():
    raw_url = os.environ.get("AI_CONSULT_TEST_DATABASE_URL")
    if not raw_url:
        pytest.skip("Set AI_CONSULT_TEST_DATABASE_URL for a disposable local MySQL instance")
    url = disposable_test_url(raw_url, os.environ.get("AI_CONSULT_TEST_DISPOSABLE", ""))
    expected_tables = {
        "sa_ai_consult_admin_audit", "sa_ai_consult_consent",
        "sa_ai_consult_generation", "sa_ai_consult_guest",
        "sa_ai_consult_rule_version", "sa_ai_consult_session",
        "sa_ai_consult_settings", "sa_ai_consult_turn",
    }
    consult_tables = tuple(
        table for table in Base.metadata.sorted_tables
        if table.schema == "nepstar" and table.name in expected_tables
    )
    assert {table.name for table in consult_tables} == expected_tables
    engine = create_async_engine(url, isolation_level="READ COMMITTED", pool_size=10)
    maker = async_sessionmaker(engine, expire_on_commit=False)
    claimed_empty_schema = False
    try:
        async with engine.begin() as connection:
            existing = await connection.scalar(text(
                "SELECT COUNT(*) FROM information_schema.tables "
                "WHERE table_schema = 'nepstar'"
            ))
            if existing:
                pytest.fail("Disposable nepstar schema must be completely empty")
            claimed_empty_schema = True
            await connection.run_sync(lambda sync_connection: Base.metadata.create_all(
                sync_connection, tables=consult_tables
            ))

        now = datetime.now(UTC).replace(tzinfo=None)
        session_id = str(uuid4())
        async with maker() as db:
            async with db.begin():
                db.add(SAAiConsultSettings(
                    id=1, enabled=True, provider_code="test", model_code="test-model",
                    guest_create_limit_per_minute=10, guest_create_count=0,
                    daily_success_limit=20, per_minute_limit=20,
                    global_daily_token_limit=1000000, max_concurrent_generations=10,
                    max_question_chars=500, retention_days=30, updated_at=now, row_version=1,
                ))
                guest = SAAiConsultGuest(
                    token_digest="0" * 64, report_code="TEST-REPORT", customer_id=1,
                    created_at=now, last_activity_at=now, expires_at=now + timedelta(days=1),
                )
                db.add(guest)
                await db.flush()
                consent = SAAiConsultConsent(
                    guest_id=guest.id, notice_version="test", notice_content_hash="0" * 64,
                    provider_code="test", data_scope_hash="0" * 64,
                    choice="granted", decided_at=now,
                )
                db.add(consent)
                await db.flush()
                session = SAAiConsultSession(
                    id=session_id, guest_id=guest.id, report_code="TEST-REPORT",
                    customer_id=1, report_date=date.today(), source="home",
                    consent_id=consent.id, status="active", created_at=now,
                    last_activity_at=now, expires_at=now + timedelta(days=1),
                    generation_epoch=0,
                )
                db.add(session)
                await db.flush()
                first = await start_turn(db, session, str(uuid4()), "请解读报告")
                assert not await finalize_turn(
                    db, session, first, CandidateOutcome("unsafe_answer", "", [], "system")
                )

        gate = asyncio.Event()

        async def do_retry():
            await gate.wait()
            async with maker() as db:
                async with db.begin():
                    session = await locked_session(db, session_id)
                    await db.execute(
                        select(SAAiConsultSettings.id)
                        .where(SAAiConsultSettings.id == 1)
                        .with_for_update()
                    )
                    return await retry_turn(db, session, first.turn_id, first.generation_id)

        tasks = [asyncio.create_task(do_retry()) for _ in range(8)]
        gate.set()
        results = await asyncio.wait_for(asyncio.gather(*tasks, return_exceptions=True), timeout=20)
        assert not any(isinstance(result, BaseException) for result in results)
        starts = [result[0] for result in results]
        assert len({item.generation_id for item in starts}) == 1
        assert sum(not item.replay for item in starts) == 1
        second = next(item for item in starts if not item.replay)
        async with maker() as db:
            assert await db.scalar(select(func.count(SAAiConsultTurn.id))) == 1
            assert await db.scalar(select(func.count(SAAiConsultGeneration.id))) == 2

        race_gate = asyncio.Event()
        outcome = CandidateOutcome(
            "reviewed_candidate", "已核对的新回答", [{"id": "ev1"}], "model_candidate"
        )

        async def do_stop():
            await race_gate.wait()
            async with maker() as db:
                async with db.begin():
                    session = await locked_session(db, session_id)
                    return await stop_running_generation(
                        db, session, second.turn_id, second.generation_id
                    )

        async def do_finish():
            await race_gate.wait()
            async with maker() as db:
                async with db.begin():
                    session = await locked_session(db, session_id)
                    return await finalize_turn(db, session, second, outcome)

        competitors = [asyncio.create_task(do_stop()), asyncio.create_task(do_finish())]
        race_gate.set()
        outcomes = await asyncio.wait_for(
            asyncio.gather(*competitors, return_exceptions=True), timeout=20
        )
        assert sum(result is True for result in outcomes) == 1
        assert sum(isinstance(result, (StopConflict, TurnConflict)) for result in outcomes) == 1
        async with maker() as db:
            turn = await db.get(SAAiConsultTurn, second.turn_id)
            generation = await db.get(SAAiConsultGeneration, second.generation_id)
        assert (turn.status, generation.status) in {
            ("stopped", "stopped"), ("completed", "completed"),
        }
        assert (turn.answer_text is None) == (turn.status == "stopped")
    finally:
        try:
            if claimed_empty_schema:
                async with engine.begin() as connection:
                    await connection.run_sync(lambda sync_connection: Base.metadata.drop_all(
                        sync_connection, tables=consult_tables
                    ))
        finally:
            await engine.dispose()
