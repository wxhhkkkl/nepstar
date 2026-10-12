"""Fence abandoned AI generations and release their global concurrency slots."""

import argparse
import asyncio
import json
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_ai_consult_sessionmaker
from ..models.new.sa_ai_consult import (
    SAAiConsultAdminAudit,
    SAAiConsultGeneration,
    SAAiConsultSession,
    SAAiConsultSettings,
    SAAiConsultTurn,
)


STALE_AFTER = timedelta(minutes=3)
DEFAULT_BATCH_SIZE = 50
MAX_BATCH_SIZE = 100


def _utc_naive(value: datetime | None) -> datetime:
    current = value or datetime.now(UTC)
    return current.astimezone(UTC).replace(tzinfo=None) if current.tzinfo else current


def _stale_candidates(cutoff: datetime, limit: int):
    return (
        select(
            SAAiConsultGeneration.id,
            SAAiConsultGeneration.turn_id,
            SAAiConsultTurn.session_id,
        )
        .join(SAAiConsultTurn, SAAiConsultGeneration.turn_id == SAAiConsultTurn.id)
        .where(
            SAAiConsultGeneration.status == "running",
            SAAiConsultGeneration.started_at <= cutoff,
        )
        .order_by(SAAiConsultGeneration.started_at, SAAiConsultGeneration.id)
        .limit(limit)
    )


async def recover_stale_generation(
    db: AsyncSession,
    *,
    generation_id: int,
    turn_id: int,
    session_id: str,
    now: datetime | None = None,
) -> bool:
    """Caller owns the transaction; lock in the same order as normal completion.

    A generation may finish while this worker waits. Recheck its status and age
    under the session, settings, turn and generation locks before changing it.
    """
    current = _utc_naive(now)
    session = (
        await db.execute(
            select(SAAiConsultSession)
            .where(SAAiConsultSession.id == session_id)
            .with_for_update()
        )
    ).scalar_one_or_none()
    if session is None:
        return False
    # Normal completion also locks this row before updating generation usage.
    await db.execute(
        select(SAAiConsultSettings.id)
        .where(SAAiConsultSettings.id == 1)
        .with_for_update()
    )
    turn = (
        await db.execute(
            select(SAAiConsultTurn)
            .where(SAAiConsultTurn.id == turn_id, SAAiConsultTurn.session_id == session_id)
            .with_for_update()
        )
    ).scalar_one_or_none()
    generation = (
        await db.execute(
            select(SAAiConsultGeneration)
            .where(
                SAAiConsultGeneration.id == generation_id,
                SAAiConsultGeneration.turn_id == turn_id,
            )
            .with_for_update()
        )
    ).scalar_one_or_none()
    if (
        turn is None
        or generation is None
        or generation.status != "running"
        or generation.started_at is None
        or generation.started_at > current - STALE_AFTER
    ):
        return False

    generation.status = "failed"
    generation.error_category = "worker_timeout"
    generation.finished_at = current
    generation.partial_text = None
    if turn.status == "running":
        turn.status = "failed"
        turn.answer_text = None
        turn.evidence_refs_json = None
        turn.completed_at = None
    if session.generation_epoch == generation.generation_epoch:
        session.generation_epoch += 1
    db.add(
        SAAiConsultAdminAudit(
            actor_admin_id=0,
            action="generation.recovered",
            target_id=str(generation.id),
            change_summary_json=json.dumps({"reason": "worker_timeout"}),
            occurred_at=current,
        )
    )
    return True


async def run_generation_recovery_job(
    *,
    max_batches: int = 10,
    batch_size: int = DEFAULT_BATCH_SIZE,
    now: datetime | None = None,
) -> int:
    """Bounded sweep; every recovery is its own short nepstar transaction."""
    if max_batches < 1 or not 1 <= batch_size <= MAX_BATCH_SIZE:
        raise ValueError("Invalid recovery job limits")
    current = _utc_naive(now)
    cutoff = current - STALE_AFTER
    writer = get_ai_consult_sessionmaker()
    recovered = 0
    for _ in range(max_batches):
        async with writer() as read_db:
            candidates = (
                await read_db.execute(_stale_candidates(cutoff, batch_size))
            ).all()
        if not candidates:
            return recovered
        for generation_id, turn_id, session_id in candidates:
            async with writer() as db:
                async with db.begin():
                    if await recover_stale_generation(
                        db,
                        generation_id=generation_id,
                        turn_id=turn_id,
                        session_id=session_id,
                        now=current,
                    ):
                        recovered += 1
        if len(candidates) < batch_size:
            return recovered
    async with writer() as read_db:
        pending = await read_db.execute(_stale_candidates(cutoff, 1))
    if pending.first() is not None:
        raise RuntimeError("AI generation recovery backlog remains after batch limit")
    return recovered


def main() -> None:
    parser = argparse.ArgumentParser(description="Recover stale AI generations in nepstar only")
    parser.add_argument("--apply", action="store_true", help="Run the recovery job")
    args = parser.parse_args()
    if not args.apply:
        parser.error("No database action without --apply")
    print(json.dumps({"recovered": asyncio.run(run_generation_recovery_job())}))


if __name__ == "__main__":
    main()
