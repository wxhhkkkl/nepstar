"""Read-only, non-content operational counters from nepstar consultation rows."""

from datetime import UTC, datetime, timedelta

from sqlalchemy import case, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.new.sa_ai_consult import (
    SAAiConsultGeneration,
    SAAiConsultSession,
    SAAiConsultTurn,
)
from .ai_consult_recovery import STALE_AFTER
from .ai_consult_usage import charged_tokens_expression


async def load_operations_summary(
    db: AsyncSession, *, now: datetime | None = None
) -> dict:
    current = now or datetime.now(UTC)
    if current.tzinfo is not None:
        current = current.astimezone(UTC).replace(tzinfo=None)
    day_start = current.replace(hour=0, minute=0, second=0, microsecond=0)
    day_end = day_start + timedelta(days=1)
    stale_cutoff = current - STALE_AFTER
    generation = SAAiConsultGeneration

    running, stale, oldest_stale = (
        await db.execute(
            select(
                func.count(case((generation.status == "running", 1))),
                func.count(case((
                    (generation.status == "running")
                    & (generation.started_at <= stale_cutoff), 1
                ))),
                func.min(case((
                    (generation.status == "running")
                    & (generation.started_at <= stale_cutoff), generation.started_at
                ))),
            )
        )
    ).one()
    total, completed, failed, charged_tokens, average_first_answer_us = (
        await db.execute(
            select(
                func.count(generation.id),
                func.count(case((generation.status == "completed", 1))),
                func.count(case((generation.status == "failed", 1))),
                func.coalesce(func.sum(charged_tokens_expression()), 0),
                func.avg(case((
                    (generation.status == "completed")
                    & generation.first_valid_chunk_at.is_not(None)
                    & (generation.first_valid_chunk_at >= generation.started_at),
                    func.timestampdiff(
                        text("MICROSECOND"),
                        generation.started_at,
                        generation.first_valid_chunk_at,
                    ),
                ))),
            ).where(generation.started_at >= day_start, generation.started_at < day_end)
        )
    ).one()
    today_sessions = await db.scalar(
        select(func.count(SAAiConsultSession.id)).where(
            SAAiConsultSession.created_at >= day_start,
            SAAiConsultSession.created_at < day_end,
        )
    )
    today_questions, helpful, unhelpful = (
        await db.execute(
            select(
                func.count(SAAiConsultTurn.id),
                func.count(case((
                    (SAAiConsultTurn.status == "completed")
                    & (SAAiConsultTurn.feedback_value == "helpful"), 1
                ))),
                func.count(case((
                    (SAAiConsultTurn.status == "completed")
                    & (SAAiConsultTurn.feedback_value == "unhelpful"), 1
                ))),
            ).where(
                SAAiConsultTurn.created_at >= day_start,
                SAAiConsultTurn.created_at < day_end,
            )
        )
    ).one()
    failure_rows = (
        await db.execute(
            select(generation.error_category, func.count(generation.id))
            .where(
                generation.started_at >= day_start,
                generation.started_at < day_end,
                generation.status == "failed",
            )
            .group_by(generation.error_category)
            .order_by(func.count(generation.id).desc())
        )
    ).all()
    return {
        "day_utc": day_start.date().isoformat(),
        "generated_at": current.isoformat() + "Z",
        "running": int(running or 0),
        "stale_running": int(stale or 0),
        "stale_after_seconds": int(STALE_AFTER.total_seconds()),
        "oldest_stale_seconds": max(0, int((current - oldest_stale).total_seconds()))
        if oldest_stale else None,
        "today_attempts": int(total or 0),
        "today_sessions": int(today_sessions or 0),
        "today_questions": int(today_questions or 0),
        "today_completed": int(completed or 0),
        "today_failed": int(failed or 0),
        "completion_rate_percent": round(100 * completed / (completed + failed), 1)
        if completed + failed else None,
        "average_first_answer_seconds": round(float(average_first_answer_us) / 1_000_000, 1)
        if average_first_answer_us is not None else None,
        "today_charged_tokens": int(charged_tokens or 0),
        "today_helpful_feedback": int(helpful or 0),
        "today_unhelpful_feedback": int(unhelpful or 0),
        "today_failure_reasons": [
            {"category": category or "unknown", "count": int(count)}
            for category, count in failure_rows
        ],
    }
