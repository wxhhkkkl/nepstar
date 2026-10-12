"""匿名问答轮次及生成状态；写入对象全部位于 nepstar。"""

import json
from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.new.sa_ai_consult import (
    SAAiConsultGeneration,
    SAAiConsultSession,
    SAAiConsultSettings,
    SAAiConsultTurn,
)
from .ai_consult_pipeline import CandidateOutcome


class TurnConflict(Exception):
    """同一幂等键用于不同问题，或旧生成结果晚到。"""


class TurnInProgress(Exception):
    """当前会话已有未结束的生成，先等待或停止它。"""


class FeedbackNotAllowed(Exception):
    """Feedback is only accepted for a complete answer."""


class StopConflict(Exception):
    """The requested generation is no longer the running attempt."""


class RetryConflict(Exception):
    """The expected attempt is no longer eligible for retry."""


@dataclass(frozen=True)
class TurnStart:
    turn_id: int
    generation_id: int
    generation_epoch: int
    replay: bool
    status: str
    answer: str | None = None
    evidence: list[dict] | None = None
    error_category: str | None = None


def valid_request_id(value: str | None) -> bool:
    if not isinstance(value, str):
        return False
    try:
        parsed = UUID(value)
    except (ValueError, AttributeError):
        return False
    return str(parsed) == value and len(value) == 36


async def start_turn(
    db: AsyncSession,
    session: SAAiConsultSession,
    request_id: str,
    question: str,
    *,
    rule_version_id: int | None = None,
) -> TurnStart:
    """调用方先锁定且验证 session；该行锁串行化同会话的序号和幂等键。"""
    if not valid_request_id(request_id) or not question.strip() or len(question) > 500:
        raise ValueError("Invalid consult question or request ID")
    clean_question = question.strip()
    existing_result = await db.execute(
        select(SAAiConsultTurn).where(
            SAAiConsultTurn.session_id == session.id,
            SAAiConsultTurn.client_request_id == request_id,
        )
    )
    existing = existing_result.scalar_one_or_none()
    if existing is not None:
        if existing.question_text != clean_question:
            raise TurnConflict("Idempotency key belongs to another question")
        generation_result = await db.execute(
            select(SAAiConsultGeneration)
            .where(SAAiConsultGeneration.turn_id == existing.id)
            .order_by(SAAiConsultGeneration.attempt_number.desc())
            .limit(1)
        )
        generation = generation_result.scalar_one_or_none()
        if generation is None:
            raise TurnConflict("Turn has no generation")
        return TurnStart(
            existing.id,
            generation.id,
            generation.generation_epoch,
            True,
            existing.status,
            existing.answer_text,
            json.loads(existing.evidence_refs_json) if existing.evidence_refs_json else [],
            generation.error_category,
        )

    running_result = await db.execute(
        select(SAAiConsultTurn.id)
        .where(
            SAAiConsultTurn.session_id == session.id,
            SAAiConsultTurn.status == "running",
        )
        .limit(1)
    )
    if running_result.scalar_one_or_none() is not None:
        raise TurnInProgress()

    max_sequence = await db.scalar(
        select(func.coalesce(func.max(SAAiConsultTurn.sequence), 0)).where(
            SAAiConsultTurn.session_id == session.id
        )
    )
    now = datetime.now(UTC).replace(tzinfo=None)
    session.generation_epoch += 1
    session.last_activity_at = now
    turn = SAAiConsultTurn(
        session_id=session.id,
        sequence=int(max_sequence or 0) + 1,
        client_request_id=request_id,
        question_text=clean_question,
        status="running",
        created_at=now,
        rule_version_id=rule_version_id,
    )
    db.add(turn)
    await db.flush()
    generation = SAAiConsultGeneration(
        turn_id=turn.id,
        attempt_number=1,
        generation_epoch=session.generation_epoch,
        status="running",
        started_at=now,
    )
    db.add(generation)
    await db.flush()
    return TurnStart(turn.id, generation.id, generation.generation_epoch, False, "running")


async def finalize_turn(
    db: AsyncSession,
    session: SAAiConsultSession,
    start: TurnStart,
    outcome: CandidateOutcome,
) -> bool:
    """仅当前 epoch 的、仍在运行的生成可以落库；返回能否发布完成事件。"""
    if start.replay or session.generation_epoch != start.generation_epoch:
        raise TurnConflict("Generation is no longer current")
    turn_result = await db.execute(
        select(SAAiConsultTurn).where(
            SAAiConsultTurn.id == start.turn_id,
            SAAiConsultTurn.session_id == session.id,
        ).with_for_update()
    )
    turn = turn_result.scalar_one_or_none()
    generation_result = await db.execute(
        select(SAAiConsultGeneration).where(
            SAAiConsultGeneration.id == start.generation_id,
            SAAiConsultGeneration.turn_id == start.turn_id,
            SAAiConsultGeneration.generation_epoch == start.generation_epoch,
        ).with_for_update()
    )
    generation = generation_result.scalar_one_or_none()
    if turn is None or generation is None or turn.status != "running" or generation.status != "running":
        raise TurnConflict("Generation state changed")

    now = datetime.now(UTC).replace(tzinfo=None)
    if outcome.prompt_tokens is not None and outcome.completion_tokens is not None:
        if (min(outcome.prompt_tokens, outcome.completion_tokens) < 0
                or outcome.prompt_tokens + outcome.completion_tokens > (generation.budget_tokens or 0)):
            raise TurnConflict("Provider usage exceeded reserved budget")
        generation.prompt_tokens = outcome.prompt_tokens
        generation.completion_tokens = outcome.completion_tokens
    completed = outcome.state == "reviewed_candidate" and bool(outcome.evidence) and not outcome.is_completed
    if completed:
        turn.answer_text = outcome.text
        turn.evidence_refs_json = json.dumps(outcome.evidence, ensure_ascii=False)
        turn.completed_at = now
        turn.status = "completed"
        generation.status = "completed"
        generation.first_valid_chunk_at = now
    else:
        turn.status = "failed"
        generation.status = "failed"
        generation.error_category = outcome.state
    generation.finished_at = now
    return completed


async def save_turn_feedback(
    db: AsyncSession,
    session_id: str,
    turn_id: int,
    *,
    helpful: bool,
    reason: str | None,
) -> SAAiConsultTurn | None:
    """Update one completed turn under its already-authorized, locked session."""
    result = await db.execute(
        select(SAAiConsultTurn)
        .where(SAAiConsultTurn.id == turn_id, SAAiConsultTurn.session_id == session_id)
        .with_for_update()
    )
    turn = result.scalar_one_or_none()
    if turn is None:
        return None
    try:
        evidence = json.loads(turn.evidence_refs_json) if turn.evidence_refs_json else None
    except (TypeError, ValueError):
        evidence = None
    if (
        turn.status != "completed"
        or not turn.answer_text
        or not isinstance(evidence, list)
        or not evidence
        or not all(isinstance(item, dict) for item in evidence)
    ):
        raise FeedbackNotAllowed()
    turn.feedback_value = "helpful" if helpful else "unhelpful"
    turn.feedback_reason = None if helpful else reason
    return turn


async def stop_running_generation(
    db: AsyncSession,
    session: SAAiConsultSession,
    turn_id: int,
    generation_id: int,
    *,
    now: datetime | None = None,
) -> bool | None:
    """Fence one exact attempt; return None if it is outside this session.

    Caller holds the session row lock. Match the normal completion lock order:
    settings, turn, then generation. Unknown provider usage keeps its reservation.
    """
    await db.execute(
        select(SAAiConsultSettings.id)
        .where(SAAiConsultSettings.id == 1)
        .with_for_update()
    )
    turn = (
        await db.execute(
            select(SAAiConsultTurn)
            .where(SAAiConsultTurn.id == turn_id, SAAiConsultTurn.session_id == session.id)
            .with_for_update()
        )
    ).scalar_one_or_none()
    generation = (
        await db.execute(
            select(SAAiConsultGeneration)
            .where(SAAiConsultGeneration.id == generation_id, SAAiConsultGeneration.turn_id == turn_id)
            .with_for_update()
        )
    ).scalar_one_or_none()
    if turn is None or generation is None:
        return None
    if turn.status == "stopped" and generation.status == "stopped":
        return False
    if (
        turn.status != "running"
        or generation.status != "running"
        or generation.generation_epoch != session.generation_epoch
    ):
        raise StopConflict()
    current = now or datetime.now(UTC).replace(tzinfo=None)
    generation.status = "stopped"
    generation.error_category = "user_stopped"
    generation.finished_at = current
    generation.partial_text = None
    turn.status = "stopped"
    turn.answer_text = None
    turn.evidence_refs_json = None
    turn.completed_at = None
    session.generation_epoch += 1
    return True


async def retry_turn(
    db: AsyncSession,
    session: SAAiConsultSession,
    turn_id: int,
    expected_generation_id: int,
) -> tuple[TurnStart, str] | None:
    """Retry one failed/stopped question, or replay the immediate successor.

    Caller holds the session and settings locks. The expected generation acts
    as a compare-and-swap key so a repeated HTTP request cannot create another
    attempt. Failed admission rolls back this whole transaction.
    """
    turn = (
        await db.execute(
            select(SAAiConsultTurn)
            .where(SAAiConsultTurn.id == turn_id, SAAiConsultTurn.session_id == session.id)
            .with_for_update()
        )
    ).scalar_one_or_none()
    if turn is None:
        return None
    latest = (
        await db.execute(
            select(SAAiConsultGeneration)
            .where(SAAiConsultGeneration.turn_id == turn.id)
            .order_by(SAAiConsultGeneration.attempt_number.desc())
            .limit(1)
            .with_for_update()
        )
    ).scalar_one_or_none()
    if latest is None:
        raise RetryConflict()
    if latest.id != expected_generation_id:
        previous = (
            await db.execute(
                select(SAAiConsultGeneration)
                .where(
                    SAAiConsultGeneration.id == expected_generation_id,
                    SAAiConsultGeneration.turn_id == turn.id,
                )
            )
        ).scalar_one_or_none()
        if (previous is None or previous.status not in {"failed", "stopped"}
                or previous.attempt_number + 1 != latest.attempt_number):
            raise RetryConflict()
        return (TurnStart(
            turn.id, latest.id, latest.generation_epoch, True, latest.status,
            turn.answer_text if latest.status == "completed" else None,
            json.loads(turn.evidence_refs_json) if latest.status == "completed" and turn.evidence_refs_json else [],
            latest.error_category,
        ), turn.question_text)
    if turn.status not in {"failed", "stopped"} or latest.status != turn.status:
        raise RetryConflict()
    running = (
        await db.execute(
            select(SAAiConsultTurn.id)
            .where(SAAiConsultTurn.session_id == session.id, SAAiConsultTurn.status == "running")
            .limit(1)
        )
    ).scalar_one_or_none()
    if running is not None:
        raise TurnInProgress()
    now = datetime.now(UTC).replace(tzinfo=None)
    session.generation_epoch += 1
    session.last_activity_at = now
    turn.status = "running"
    turn.answer_text = None
    turn.evidence_refs_json = None
    turn.completed_at = None
    turn.feedback_value = None
    turn.feedback_reason = None
    generation = SAAiConsultGeneration(
        turn_id=turn.id,
        attempt_number=latest.attempt_number + 1,
        generation_epoch=session.generation_epoch,
        status="running",
        started_at=now,
    )
    db.add(generation)
    await db.flush()
    return (TurnStart(turn.id, generation.id, generation.generation_epoch, False, "running"), turn.question_text)


def _public_turn(row: SAAiConsultTurn, generation_id: int | None) -> dict:
    """单一脱敏口径：未完成或没有有效依据的正文绝不返回。"""
    evidence = []
    if row.status == "completed" and row.evidence_refs_json:
        try:
            parsed = json.loads(row.evidence_refs_json)
            if isinstance(parsed, list) and all(isinstance(item, dict) for item in parsed):
                evidence = parsed
        except (TypeError, ValueError):
            pass
    complete = row.status == "completed" and bool(row.answer_text) and bool(evidence)
    return {
        "id": row.id,
        "generation_id": generation_id,
        "question": row.question_text,
        "status": "completed" if complete else "stopped" if row.status == "stopped" else "incomplete",
        "can_retry": row.status in {"failed", "stopped"} and generation_id is not None,
        "answer": row.answer_text if complete else None,
        "evidence": evidence if complete else [],
        "created_at": row.created_at.isoformat() + "Z",
        "feedback_value": row.feedback_value if complete else None,
        "feedback_reason": row.feedback_reason if complete else None,
    }


async def get_session_turn(db: AsyncSession, session_id: str, turn_id: int) -> dict | None:
    """只读一轮；调用方必须先验证 guest、报告、会话和当前同意。"""
    result = await db.execute(
        select(SAAiConsultTurn).where(
            SAAiConsultTurn.id == turn_id,
            SAAiConsultTurn.session_id == session_id,
        )
    )
    row = result.scalar_one_or_none()
    if row is None:
        return None
    generation_result = await db.execute(
        select(SAAiConsultGeneration.id)
        .where(SAAiConsultGeneration.turn_id == turn_id)
        .order_by(SAAiConsultGeneration.attempt_number.desc())
        .limit(1)
    )
    return _public_turn(row, generation_result.scalar_one_or_none())


async def list_session_turns(db: AsyncSession, session_id: str, *, limit: int = 100) -> list[dict]:
    """只读回放已授权会话的最近轮次；调用方必须先验证 guest 和报告归属。"""
    result = await db.execute(
        select(SAAiConsultTurn)
        .where(SAAiConsultTurn.session_id == session_id)
        .order_by(SAAiConsultTurn.sequence.desc())
        .limit(min(max(limit, 1), 100))
    )
    rows = list(result.scalars().all())
    latest_ids = {}
    if rows:
        latest_attempts = (
            select(
                SAAiConsultGeneration.turn_id,
                func.max(SAAiConsultGeneration.attempt_number).label("attempt_number"),
            )
            .where(SAAiConsultGeneration.turn_id.in_([row.id for row in rows]))
            .group_by(SAAiConsultGeneration.turn_id)
            .subquery()
        )
        generation_rows = await db.execute(
            select(SAAiConsultGeneration.turn_id, SAAiConsultGeneration.id)
            .join(latest_attempts, and_(
                SAAiConsultGeneration.turn_id == latest_attempts.c.turn_id,
                SAAiConsultGeneration.attempt_number == latest_attempts.c.attempt_number,
            ))
        )
        latest_ids = dict(generation_rows.all())
    return [_public_turn(row, latest_ids.get(row.id)) for row in reversed(rows)]
