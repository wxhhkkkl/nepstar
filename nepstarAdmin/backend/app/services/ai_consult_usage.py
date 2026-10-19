"""Reserve anonymous consultation capacity using only nepstar consultation rows.

The caller locks the singleton settings row before calling this function. That
lock serializes admission across workers, while the generation row holds a
conservative token reservation until the provider returns actual usage.
"""

from datetime import UTC, datetime, timedelta

from sqlalchemy import case, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.new.sa_ai_consult import (
    SAAiConsultGeneration,
    SAAiConsultSession,
    SAAiConsultSettings,
    SAAiConsultTurn,
)
from .ai_consult_turns import TurnStart
from .ai_consult_entry_guard import public_maintenance_text


class ConsultLimitReached(Exception):
    def __init__(self, code: str, retry_after_seconds: int | None = None):
        self.code = code
        self.retry_after_seconds = retry_after_seconds


def charged_tokens_expression():
    """Use the same reserved-or-actual token charge for admission and reporting."""
    return case(
        (
            or_(
                SAAiConsultGeneration.prompt_tokens.is_(None),
                SAAiConsultGeneration.completion_tokens.is_(None),
            ),
            SAAiConsultGeneration.budget_tokens,
        ),
        else_=(
            SAAiConsultGeneration.prompt_tokens
            + SAAiConsultGeneration.completion_tokens
        ),
    )


async def remaining_daily_successes(
    db: AsyncSession,
    *,
    guest_id: int,
    daily_limit: int,
    now: datetime | None = None,
) -> int | None:
    """Return this guest's remaining successful answers in the current UTC day.

    Zero means unlimited; return None rather than an exhausted allowance of 0.
    """
    if daily_limit <= 0:
        return None
    current = now or datetime.now(UTC)
    if current.tzinfo is not None:
        current = current.astimezone(UTC).replace(tzinfo=None)
    day_start = current.replace(hour=0, minute=0, second=0, microsecond=0)
    day_end = day_start + timedelta(days=1)
    successes = await db.scalar(
        select(func.count(SAAiConsultTurn.id))
        .join(SAAiConsultSession, SAAiConsultTurn.session_id == SAAiConsultSession.id)
        .where(
            SAAiConsultSession.guest_id == guest_id,
            SAAiConsultTurn.status == "completed",
            SAAiConsultTurn.completed_at >= day_start,
            SAAiConsultTurn.completed_at < day_end,
        )
    )
    return max(0, daily_limit - int(successes or 0))


async def reserve_generation_capacity(
    db: AsyncSession,
    config: SAAiConsultSettings,
    *,
    guest_id: int,
    start: TurnStart,
    question: str,
    token_budget: int,
    model_code: str,
    now: datetime | None = None,
) -> None:
    """Reject over-limit new attempts in the same transaction that creates them.

    A replay keeps its original attempt and consumes no additional allowance.
    Each zero-valued quota is unlimited and skips its corresponding usage query.
    Missing provider usage is charged at the full reservation, including for
    failed attempts; this prevents failures from evading the global budget.
    """
    if start.replay:
        return
    if public_maintenance_text(config):
        raise ConsultLimitReached("consult.maintenance")
    if not config.enabled or min(
        config.daily_success_limit,
        config.per_minute_limit,
        config.global_daily_token_limit,
        config.max_concurrent_generations,
        config.max_question_chars,
    ) < 0 or token_budget <= 0 or not model_code:
        raise ConsultLimitReached("consult.disabled")
    if config.max_question_chars > 0 and len(question.strip()) > config.max_question_chars:
        raise ConsultLimitReached("consult.question_too_long")

    current = now or datetime.now(UTC)
    if current.tzinfo is not None:
        current = current.astimezone(UTC).replace(tzinfo=None)
    day_start = current.replace(hour=0, minute=0, second=0, microsecond=0)
    day_end = day_start + timedelta(days=1)
    minute_start = current - timedelta(minutes=1)
    day_retry = max(1, int((day_end - current).total_seconds() + 0.999999))

    if config.daily_success_limit > 0:
        successes = await db.scalar(
            select(func.count(SAAiConsultTurn.id))
            .join(SAAiConsultSession, SAAiConsultTurn.session_id == SAAiConsultSession.id)
            .where(
                SAAiConsultSession.guest_id == guest_id,
                SAAiConsultTurn.status == "completed",
                SAAiConsultTurn.completed_at >= day_start,
                SAAiConsultTurn.completed_at < day_end,
            )
        )
        if int(successes or 0) >= config.daily_success_limit:
            raise ConsultLimitReached("consult.daily_limit", day_retry)

    if config.per_minute_limit > 0:
        attempts = await db.scalar(
            select(func.count(SAAiConsultGeneration.id))
            .join(SAAiConsultTurn, SAAiConsultGeneration.turn_id == SAAiConsultTurn.id)
            .join(SAAiConsultSession, SAAiConsultTurn.session_id == SAAiConsultSession.id)
            .where(
                SAAiConsultSession.guest_id == guest_id,
                SAAiConsultGeneration.id != start.generation_id,
                SAAiConsultGeneration.started_at >= minute_start,
                SAAiConsultGeneration.started_at <= current,
            )
        )
        if int(attempts or 0) >= config.per_minute_limit:
            raise ConsultLimitReached("consult.rate_limited", 60)

    if config.max_concurrent_generations > 0:
        running = await db.scalar(
            select(func.count(SAAiConsultGeneration.id)).where(
                SAAiConsultGeneration.id != start.generation_id,
                SAAiConsultGeneration.status == "running",
            )
        )
        if int(running or 0) >= config.max_concurrent_generations:
            raise ConsultLimitReached("consult.capacity_busy", 5)

    if config.global_daily_token_limit > 0:
        used_tokens = await db.scalar(
            select(func.coalesce(func.sum(charged_tokens_expression()), 0)).where(
                SAAiConsultGeneration.id != start.generation_id,
                SAAiConsultGeneration.started_at >= day_start,
                SAAiConsultGeneration.started_at < day_end,
            )
        )
        if int(used_tokens or 0) + token_budget > config.global_daily_token_limit:
            raise ConsultLimitReached("consult.global_budget_exhausted", day_retry)

    generation = (
        await db.execute(
            select(SAAiConsultGeneration).where(
                SAAiConsultGeneration.id == start.generation_id,
                SAAiConsultGeneration.turn_id == start.turn_id,
                SAAiConsultGeneration.status == "running",
            ).with_for_update()
        )
    ).scalar_one_or_none()
    if generation is None:
        raise ConsultLimitReached("consult.capacity_busy", 5)
    generation.budget_tokens = token_budget
    generation.model_code = model_code
